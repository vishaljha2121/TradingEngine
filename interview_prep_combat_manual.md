# Technical Interview "Combat Manual"
## True Markets Onsite Prep: Low-Latency Systems
### Prepared for: Vishal Jha (NYU Tandon MSCS) — March 23, 2026

---

# Tier 1: System Foundations & Hybrid Architecture

## Q1: You started in C++ and evolved parts into C#. In a production HFT engine, which parts MUST stay in C++, and which benefit from C#?

**Answer:**
The **Matching Engine core** and **Networking Stack** must stay in C++. These require deterministic execution and manual memory management to avoid latency jitter.
C# is best used for the **Control Plane** (management tools, GUI monitors, and trade reporting). This allows for higher developer velocity on features that don't sit on the critical "Hot Path," keeping the codebase modular and maintainable.

**My Implementation — Hybrid Architecture:**
In my project, the C++ engine handles the quantitative backtesting core — parsing raw order book states and running strategies with zero-overhead loops. The C# .NET 9 server handles the real-time web API, WebSocket broadcasting, and the matching engine for the live trading simulation.

```cpp
// C++ Backtester: OrderBook.hpp — Cache-line aligned Order struct
// This stays in C++ for deterministic performance
struct alignas(64) Order {
    uint64_t orderId;
    double price;
    double size;
    bool isBuy;
    char padding[39]; // Pad to exactly 64 bytes = 1 CPU cache line
};

// Contiguous memory order book — NOT node-based containers
class OrderBook {
private:
    // std::vector instead of std::map to avoid pointer chasing
    std::vector<PriceLevel> bids;  // Sorted descending
    std::vector<PriceLevel> asks;  // Sorted ascending
    
    void matchOrder(Order& incoming);
    void insertOrderIntoBook(const Order& order, std::vector<PriceLevel>& book, bool isBid);
public:
    void processOrder(bool isBuy, double price, double size);
    double getBestBid() const;
    double getBestAsk() const;
};
```

```csharp
// C# Control Plane: Program.cs — API Layer (higher dev velocity, doesn't need ULL)
// Zero-allocation JSON deserialization directly from Kestrel socket
app.MapPost("/api/orders", async (HttpRequest req, OrderRingBuffer buffer) =>
{
    var order = await JsonSerializer.DeserializeAsync<Order>(req.Body, jsonOptions);
    if (order == null) return Results.BadRequest();
    
    long orderId = DateTime.UtcNow.Ticks;
    var workingOrder = new OrderCore(orderId, order.Price, order.Size, order.IsBuy, order.UserId);
    
    // Write synchronously to lock-free buffer — last allocation before hot path
    if(!buffer.TryWrite(in workingOrder))
        return Results.StatusCode(429); // Back-pressure: reject if buffer full
    
    return Results.Accepted();
});
```

---

## Q2: How did you handle thread contention in your matching logic? If two orders arrive simultaneously, how do you ensure determinism?

**Answer:**
I avoided mutexes to prevent "lock convoys." Instead, I used a **Lock-Free SPSC (Single-Producer Single-Consumer) Ring Buffer** and pinned threads to specific CPU cores (**Thread Affinity**). By using a single-threaded matching loop, the system processes orders in the exact sequence they hit the ingress buffer, ensuring 100% determinism without context-switching overhead.

**My Implementation — OrderRingBuffer (Lock-Free SPSC Queue):**

```csharp
// Services/OrderRingBuffer.cs — Pre-allocated ring buffer simulating DPDK/Kernel bypass
public class OrderRingBuffer
{
    private readonly OrderCore[] _buffer; // Pre-allocated contiguous array
    private readonly int _capacity;
    private int _head;  // Consumer reads here
    private int _tail;  // Producer writes here

    public OrderRingBuffer(int capacity)
    {
        _capacity = capacity;
        _buffer = new OrderCore[capacity]; // ALL memory allocated upfront at startup
        _head = 0;
        _tail = 0;
    }

    // 'in' keyword: pass struct by reference, zero-copy write
    public bool TryWrite(in OrderCore order)
    {
        int nextTail = (_tail + 1) % _capacity;
        if (nextTail == _head)
            return false; // Buffer full — apply back-pressure, never block

        _buffer[_tail] = order; // Direct write into pre-allocated slot
        _tail = nextTail;
        return true;
    }

    public bool TryRead(out OrderCore order)
    {
        if (_head == _tail)
        {
            order = default;
            return false; // Buffer empty
        }
        order = _buffer[_head]; // Direct read from contiguous memory
        _head = (_head + 1) % _capacity;
        return true;
    }
}
```

```csharp
// Program.cs — Buffer initialization: 1 million pre-allocated order slots
var ringBuffer = new OrderRingBuffer(1_000_000);
builder.Services.AddSingleton(ringBuffer);
```

**Key Design Decisions:**
- **No locks, no mutexes** — the buffer is SPSC: the API thread writes, the engine thread reads.
- **`in` keyword** — passes the 64-byte `OrderCore` struct by reference (no copy on write).
- **Back-pressure via `TryWrite` returning `false`** — never blocks the HTTP thread. Returns HTTP 429.
- **Pre-allocated array** — all 1M slots exist at startup; no `new` in the hot path.

---

## Q3: C# has a Garbage Collector (GC). How do you prevent a GC "Stop-the-World" event from causing a latency spike?

**Answer:**
In C#, I utilize **Zero-Allocation programming**. This means using **Structs** (stack-allocated) instead of Classes, and **Object Pooling** to reuse buffers. By pre-allocating memory at startup and avoiding `new` keywords in the execution loop, the GC has no "garbage" to collect, effectively neutralizing the risk of spikes.

**My Implementation — OrderCore (Cache-Aligned Struct):**

```csharp
// Models/OrderCore.cs — 64-byte cache-aligned, readonly, stack-allocated struct
[StructLayout(LayoutKind.Explicit, Size = 64)]
public readonly struct OrderCore
{
    [FieldOffset(0)]  public readonly long OrderId;      // 8 bytes

    [FieldOffset(8)]  public readonly decimal Price;     // 16 bytes (offset 8-23)

    [FieldOffset(24)] public readonly int Size;          // 4 bytes

    [FieldOffset(28)] public readonly bool IsBuy;        // 1 byte

    [FieldOffset(32)] public readonly string UserId;     // 8 bytes (reference)
    
    // Bytes 40-63: implicit padding to fill exact 64-byte cache line

    public OrderCore(long orderId, decimal price, int size, bool isBuy, string userId)
    {
        OrderId = orderId;  Price = price;  Size = size;
        IsBuy = isBuy;      UserId = userId;
    }
}
```

**Why 64 bytes?**
- x86/ARM CPUs fetch RAM in 64-byte "cache lines."
- `[StructLayout(LayoutKind.Explicit, Size = 64)]` guarantees one order = one cache line.
- `readonly struct` = no GC tracking, stack-allocated, passed by value or `in` reference.

**The GC Fix in Production — Streaming JSON:**
During load testing, I discovered **479 MB of Gen0 GC allocations** when using `StreamReader.ReadToEndAsync()`. Fixed by switching to streaming deserialization:

```csharp
// BEFORE (caused 479 MB GC pressure under 5000 req/sec):
using var reader = new StreamReader(req.Body);
var body = await reader.ReadToEndAsync();       // ← Allocates entire body as string
var order = JsonSerializer.Deserialize<Order>(body);

// AFTER (zero intermediate string allocations):
var order = await JsonSerializer.DeserializeAsync<Order>(req.Body, jsonOptions);
// ↑ Streams JSON bytes directly from Kestrel socket into struct — no string copy
```

---

# Tier 2: Low-Latency Engineering (The "Spencer" Round)

## Q4: Explain how you structured your Order Book in memory for cache locality.

**Answer:**
I used **Contiguous Memory (Flat Arrays/Vectors)** for price levels. Linked lists involve "pointer chasing," which triggers L1/L2 cache misses. By keeping the top-of-book levels in a contiguous block, the CPU pre-fetches the next price level into the cache line before it's even needed, significantly reducing memory access latency.

**C++ Implementation — Vector-Based Order Book:**

```cpp
// OrderBook.hpp — Flat array instead of std::map (red-black tree = pointer chasing)
struct PriceLevel {
    double price;
    double totalSize;
    std::vector<Order> orders; // Contiguous orders at this level
    PriceLevel(double p) : price(p), totalSize(0) {}
};

class OrderBook {
private:
    std::vector<PriceLevel> bids; // Contiguous! CPU prefetcher can scan linearly
    std::vector<PriceLevel> asks; // Sorted ascending, front() = best ask
    // ...
};
```

```cpp
// OrderBook.cpp — Matching logic: best price is ALWAYS front() due to sort invariant
void OrderBook::matchOrder(Order& incoming) {
    auto& bookToMatchAgainst = incoming.isBuy ? asks : bids;

    while (incoming.size > 0 && !bookToMatchAgainst.empty()) {
        auto& bestLevel = bookToMatchAgainst.front(); // O(1) — always best price

        if (incoming.isBuy && incoming.price < bestLevel.price) break;
        if (!incoming.isBuy && incoming.price > bestLevel.price) break;

        auto& ordersAtLevel = bestLevel.orders;
        while (incoming.size > 0 && !ordersAtLevel.empty()) {
            auto& resting = ordersAtLevel.front();
            double tradeSize = std::min(incoming.size, resting.size);
            
            incoming.size -= tradeSize;
            resting.size -= tradeSize;
            bestLevel.totalSize -= tradeSize;
            
            if (resting.size == 0)
                ordersAtLevel.erase(ordersAtLevel.begin());
        }
        if (ordersAtLevel.empty())
            bookToMatchAgainst.erase(bookToMatchAgainst.begin());
    }
}
```

**C# Implementation — SortedDictionary with Custom Comparer:**

```csharp
// Services/OrderBook.cs — Bids sorted descending (highest first), Asks sorted ascending
private readonly SortedDictionary<decimal, List<OrderCore>> _bids = 
    new(Comparer<decimal>.Create((a, b) => b.CompareTo(a))); // Descending
private readonly SortedDictionary<decimal, List<OrderCore>> _asks = new(); // Ascending

private void MatchOrder(ref OrderCore incomingOrder)
{
    var bookToMatchAgainst = incomingOrder.IsBuy ? _asks : _bids;
    
    while (incomingOrder.Size > 0 && bookToMatchAgainst.Count > 0)
    {
        var bestPriceLevel = bookToMatchAgainst.First();
        var bestPrice = bestPriceLevel.Key;
        
        if (incomingOrder.IsBuy && incomingOrder.Price < bestPrice) break;
        if (!incomingOrder.IsBuy && incomingOrder.Price > bestPrice) break;

        var ordersAtLevel = bestPriceLevel.Value;
        while (incomingOrder.Size > 0 && ordersAtLevel.Count > 0)
        {
            var restingOrder = ordersAtLevel[0];
            int tradeSize = Math.Min(incomingOrder.Size, restingOrder.Size);
            
            // Since OrderCore is readonly struct, create updated copies
            incomingOrder = new OrderCore(
                incomingOrder.OrderId, incomingOrder.Price,
                incomingOrder.Size - tradeSize, incomingOrder.IsBuy, incomingOrder.UserId);
            
            var updatedResting = new OrderCore(
                restingOrder.OrderId, restingOrder.Price,
                restingOrder.Size - tradeSize, restingOrder.IsBuy, restingOrder.UserId);

            if (updatedResting.Size == 0) ordersAtLevel.RemoveAt(0);
            else ordersAtLevel[0] = updatedResting; // Replace in-place
        }
        if (ordersAtLevel.Count == 0) bookToMatchAgainst.Remove(bestPrice);
    }
}
```

---

## Q5: Describe how you implemented the "Zero-Copy" principle in your engine.

**Answer:**
I avoided copying order data between different parts of the system by using **Pointers or References**. In the C# layer, I used the `in` keyword (pass by readonly reference) and `ref` to avoid struct copies. In the network layer, I utilized **streaming deserialization** to read data directly from the Kestrel socket buffer.

**My Implementation — `in` and `ref` Pass-By-Reference:**

```csharp
// IOrderBook interface: 'in' = pass struct by readonly reference (zero-copy)
public interface IOrderBook
{
    void AddOrder(in OrderCore order);  // 'in' prevents 64-byte copy
    bool CancelOrder(long orderId);
    void Reset();
}

// EventLogger: 'in' references flow through the entire hot path
public EngineEvent LogNewOrder(in OrderCore order)
{
    lock (_lock)
    {
        var evt = EngineEvent.NewOrder(_sequenceNumber++, in order);
        WriteEvent(in evt);  // Event also passed by reference
        return evt;
    }
}

// TradingEngineBackgroundService hot loop: struct never copied
if (_ringBuffer.TryRead(out OrderCore order))
{
    _eventLogger.LogNewOrder(in order);   // Zero copy: reference to stack
    _orderBook.AddOrder(in order);        // Zero copy: reference to stack
}
```

---

## Q6: Which modern C++ features (C++17/20) did you use to optimize performance?

**Answer:**
I used `alignas(64)` for cache-line alignment, `std::chrono::high_resolution_clock` for nanosecond-precision latency measurement, and structured the code with `auto&` references to avoid copies. The backtester also uses `std::deque` as a sliding window for rolling indicator computations.

**My Implementation:**

```cpp
// Cache-line alignment (C++11 alignas, critical for false sharing prevention)
struct alignas(64) Order {
    uint64_t orderId;
    double price;
    double size;
    bool isBuy;
    char padding[39]; // Explicit padding to 64 bytes
};

// High-resolution timing for per-order latency measurement
auto start = std::chrono::high_resolution_clock::now();
ob.processOrder(isBuy, price, size);
auto end = std::chrono::high_resolution_clock::now();
std::chrono::duration<double, std::micro> elapsed = end - start;

// Rolling window using std::deque for O(1) push/pop
std::deque<double> closePrices;
closePrices.push_back(c.close);
if (closePrices.size() > 200) closePrices.pop_front(); // Sliding window
```

---

# Tier 3: Elite Crypto & Logistics (The "Patrick" Round)

## Q7: In a non-custodial exchange, how does the matching logic change compared to a traditional exchange?

**Answer:**
In non-custodial systems, the match is contingent on **Collateral Checks**. The engine must maintain a "Shadow Balance" and trigger settlement asynchronously. The challenge is ensuring the matching engine stays "hot" and keeps matching while the slower settlement layer confirms the transaction on-chain.

**My Implementation — Async Settlement Off the Hot Path:**

```csharp
// TradingEngineBackgroundService.cs — Trade settlement runs async, OFF the hot path
private void HandleTrade(Trade trade)
{
    // 1. Log to deterministic event log (synchronous, on hot path)
    _eventLogger.LogTradeExecution(
        trade.Price, trade.Size,
        long.TryParse(trade.MakerOrderId, out var mkId) ? mkId : 0,
        long.TryParse(trade.TakerOrderId, out var tkId) ? tkId : 0);

    // 2. Push to WebSocket (fire-and-forget)
    _hubContext.Clients.All.SendAsync("ReceiveTrade", trade);
    
    string buyerId = trade.MakerIsBuy ? trade.MakerUserId : trade.TakerUserId;
    string sellerId = trade.MakerIsBuy ? trade.TakerUserId : trade.MakerUserId;

    // 3. Settlement runs in a SEPARATE thread — never blocks matching loop
    _ = Task.Run(async () =>
    {
        try { await _redisService.SettleTradeAsync(buyerId, sellerId, trade.Price, trade.Size); }
        catch (Exception ex) { _logger.LogError(ex, "Failed to settle trade in Redis"); }
    });
}
```

---

## Q8: How do you separate the "Fast Path" (Matching) from the "Slow Path" (Logging/Risk Checks)?

**Answer:**
The Matching Engine processes the trade and immediately moves to the next order. It pushes the trade details into a **Ring Buffer** and broadcasts via WebSocket asynchronously. A separate, lower-priority thread handles settlement and database I/O.

**My Implementation — The Hot Loop (SpinWait + CPU Pinning):**

```csharp
// TradingEngineBackgroundService.cs — The core engine loop
private void RunEngineLoop(CancellationToken stoppingToken)
{
    // Step 1: Pin thread to highest CPU core (avoid context switches)
    if (OperatingSystem.IsWindows() || OperatingSystem.IsLinux())
    {
        Thread.BeginThreadAffinity();
        int targetCore = Environment.ProcessorCount - 1; 
        long affinityMask = 1L << targetCore;
        processThread.ProcessorAffinity = (IntPtr)affinityMask;
        ActiveCoreId = targetCore;
    }

    var spinWait = new SpinWait();

    // Step 2: HOT PATH — Spin-wait loop (never yields to OS scheduler)
    while (!stoppingToken.IsCancellationRequested)
    {
        if (_ringBuffer.TryRead(out OrderCore order))
        {
            // FAST PATH: Log event + match order (microsecond-level)
            _eventLogger.LogNewOrder(in order);
            
            long startTicks = Stopwatch.GetTimestamp();
            _orderBook.AddOrder(in order);
            long endTicks = Stopwatch.GetTimestamp();
            
            double microseconds = (endTicks - startTicks) * 1_000_000.0 / Stopwatch.Frequency;
            
            // Telemetry: fire-and-forget (doesn't block matching)
            _ = _hubContext.Clients.All.SendAsync("ReceiveMetrics", new { 
                latencyUs = microseconds,
                allocations = 0, // Zero-Allocation verified
                coreId = ActiveCoreId
            }); 
        }
        else
        {
            // Idle: SpinOnce (in true kernel-bypass, this would be a busy spin)
            spinWait.SpinOnce();
        }
    }
    Thread.EndThreadAffinity();
}
```

**Why this architecture?**
- `SpinWait.SpinOnce()` → avoids OS thread rescheduling on idle
- `Thread.Priority = ThreadPriority.Highest` → OS gives this thread priority
- `ProcessorAffinity` → thread stays on one core, L1 cache stays warm
- Settlement/logging runs asynchronously via `Task.Run` — never blocks the matching loop

---

# Tier 4: The Stress Test

## Q9: Tell me about a significant bug you found. How did you profile it?

**Answer:**
I encountered a massive **GC pressure spike** during high volume. Using `.NET dotnet-counters` and a custom Python `aiohttp` load test, I discovered that **479 MB of Gen0 Garbage Collection** was happening within seconds under 5,000 concurrent requests.

**The Bug — GC Choking the Ingestion Layer:**

```python
# load_test.py — 500 concurrent orders per batch, unthrottled
async def load_test(duration=30):
    url = "http://localhost:12000/api/orders"
    users = ["Alice", "Bob", "Charlie", "David", "Eve"]
    async with aiohttp.ClientSession() as session:
        while time.time() - start_time < duration:
            tasks = [send_order(session, url, random.choice(users)) for _ in range(500)]
            await asyncio.gather(*tasks)
            count += 500
```

**Root Cause:** `StreamReader.ReadToEndAsync()` was allocating a contiguous `string` for every HTTP body. Under 5,000 req/sec, this generated hundreds of MB of short-lived strings, forcing the GC into aggressive Gen0 collection cycles, starving the matching thread and causing `JsonException` crashes.

**Fix:** Switched to `JsonSerializer.DeserializeAsync<T>()` which streams directly from the socket — zero intermediate string allocations. GC pressure dropped from 479 MB to effectively zero on the ingestion path.

---

## Q10: False Sharing — How did you prevent it?

**Answer:**
I used `[StructLayout(LayoutKind.Explicit, Size = 64)]` in C# and `alignas(64)` in C++ to force each order to occupy exactly one 64-byte cache line. This prevents two threads from accidentally invalidating each other's cache lines when working on adjacent orders.

```csharp
// C#: StructLayout forces exact 64-byte layout with FieldOffset control
[StructLayout(LayoutKind.Explicit, Size = 64)]
public readonly struct OrderCore
{
    [FieldOffset(0)]  public readonly long OrderId;    // bytes 0-7
    [FieldOffset(8)]  public readonly decimal Price;   // bytes 8-23
    [FieldOffset(24)] public readonly int Size;        // bytes 24-27
    [FieldOffset(28)] public readonly bool IsBuy;      // byte 28
    [FieldOffset(32)] public readonly string UserId;   // bytes 32-39
    // bytes 40-63: implicit padding                    → total = 64 bytes = 1 cache line
}
```

```cpp
// C++: alignas(64) + explicit padding
struct alignas(64) Order {
    uint64_t orderId;   // 8 bytes
    double price;       // 8 bytes  
    double size;        // 8 bytes
    bool isBuy;         // 1 byte
    char padding[39];   // 39 bytes → total = 64 bytes = 1 cache line
};
```

---

# Tier 5: Testing & Code Coverage (81.2%)

## Q11: How did you test your matching engine? What frameworks did you use?

**Answer:**
I built a comprehensive test suite of **29 automated tests** using **xUnit**, **Moq**, **FluentAssertions**, and **WebApplicationFactory**. Tests cover the order book matching, ring buffer FIFO semantics, deterministic replay, event logging persistence, and full E2E API integration.

### Order Book Matching Tests

```csharp
// OrderBookTests.cs — Verifies crossing orders match and emit correct trades
[Fact]
public void AddOrder_Should_Match_Crossing_Orders_And_Emit_Trade()
{
    var orderBook = new OrderBook("BTCUSD");
    var makerOrder = new OrderCore(1, 100m, 10, true, "User1");   // Buy 10 @ 100
    var takerOrder = new OrderCore(2, 90m, 5, false, "User2");    // Sell 5 @ 90 (crosses)
    orderBook.AddOrder(in makerOrder);

    Trade? emittedTrade = null;
    orderBook.OnTrade += trade => emittedTrade = trade;
    orderBook.AddOrder(in takerOrder);

    emittedTrade.Should().NotBeNull();
    emittedTrade!.Price.Should().Be(100m);   // Matches at maker's (resting) price
    emittedTrade.Size.Should().Be(5);
    
    var snapshot = orderBook.GetSnapshot();
    snapshot.Bids[0].Size.Should().Be(5);    // 10 - 5 = 5 remaining
    snapshot.Asks.Should().BeEmpty();         // Taker fully filled
}

[Fact]
public void AddOrder_Should_Match_Fully_Crossing_Order()
{
    var orderBook = new OrderBook("BTCUSD");
    var makerOrder = new OrderCore(1, 100m, 5, true, "User1");
    var takerOrder = new OrderCore(2, 90m, 10, false, "User2"); // Seller is bigger
    orderBook.AddOrder(in makerOrder);
    orderBook.AddOrder(in takerOrder);

    var snapshot = orderBook.GetSnapshot();
    snapshot.Bids.Should().BeEmpty();            // Maker fully filled
    snapshot.Asks.Should().HaveCount(1);
    snapshot.Asks[0].Size.Should().Be(5);        // Taker has 5 remaining, rests on book
}
```

### Ring Buffer FIFO & Overflow Tests

```csharp
// OrderRingBufferTests.cs — Validates FIFO ordering and back-pressure
[Fact]
public void TryWrite_Should_Return_False_When_Full()
{
    var buffer = new OrderRingBuffer(3); // Capacity = 3, usable slots = 2
    buffer.TryWrite(new OrderCore(1, 100m, 10, true, "User1")).Should().BeTrue();
    buffer.TryWrite(new OrderCore(2, 100m, 10, true, "User2")).Should().BeTrue();
    buffer.TryWrite(new OrderCore(3, 100m, 10, true, "User3")).Should().BeFalse(); // FULL
}

[Fact]
public void TryRead_Should_Retrieve_Orders_In_FIFO_Order()
{
    var buffer = new OrderRingBuffer(10);
    buffer.TryWrite(new OrderCore(1, 100m, 10, true, "User1"));
    buffer.TryWrite(new OrderCore(2, 200m, 20, false, "User2"));

    buffer.TryRead(out var readOrder1);
    readOrder1.OrderId.Should().Be(1);   // First in
    readOrder1.Price.Should().Be(100m);

    buffer.TryRead(out var readOrder2);
    readOrder2.OrderId.Should().Be(2);   // Second in
    readOrder2.Price.Should().Be(200m);

    buffer.TryRead(out _).Should().BeFalse(); // Empty
}
```

### Deterministic Replay Engine Tests

```csharp
// ReplayEngineTests.cs — Verifies event log → state reconstruction is deterministic
[Fact]
public void Replay_Should_Rebuild_Expected_State()
{
    var orderBook = new OrderBook("BTCUSD");
    var replayEngine = new ReplayEngine();
    
    // Simulated event log:
    // 1. Buy 2 @ 68000 (Alice)
    // 2. Buy 3 @ 67500 (Bob)  
    // 3. Sell 1 @ 67500 (Charlie) ← Crosses Alice's higher bid
    // 4. TradeExecution (derived — skipped during replay)
    // 5. CancelOrder (Alice's remaining bid)
    var events = new List<EngineEvent>
    {
        EngineEvent.NewOrder(0, new OrderCore(1, 68000m, 2, true, "Alice")),
        EngineEvent.NewOrder(1, new OrderCore(2, 67500m, 3, true, "Bob")),
        EngineEvent.NewOrder(2, new OrderCore(3, 67500m, 1, false, "Charlie")),
        EngineEvent.TradeExecution(3, 67500m, 1, 2, 3), // Ignored by replay
        EngineEvent.CancelOrder(4, 1)  // Cancel Alice's remaining
    };

    var result = replayEngine.Replay(events, orderBook);

    result.EventsReplayed.Should().Be(5);
    result.NewOrdersReplayed.Should().Be(3);
    result.CancelsReplayed.Should().Be(1);
    result.TradesGenerated.Should().Be(1); // Re-derived from matching

    var snapshot = result.FinalSnapshot;
    snapshot!.Bids.Should().HaveCount(1);
    snapshot.Bids[0].Price.Should().Be(67500m);  // Only Bob's bid remains
    snapshot.Bids[0].Size.Should().Be(3);
    snapshot.Asks.Should().HaveCount(0);
}
```

### Event Logger Persistence Tests

```csharp
// EventLoggerTests.cs — Binary log survives process restarts
[Fact]
public void EventLogger_Should_Maintain_State_Across_Instances()
{
    using (var logger1 = new EventLogger(_testDirPath))
    {
        logger1.LogCancelOrder(1);
    } // logger1 disposed → file flushed and closed

    using (var logger2 = new EventLogger(_testDirPath))
    {
        var events = logger2.GetAllEvents();
        var newEvt = logger2.LogCancelOrder(2);

        events.Should().HaveCount(1);
        events[0].OrderId.Should().Be(1);
        newEvt.SequenceNumber.Should().Be(1); // Continues sequence from disk
    }
}
```

### End-to-End API Integration Tests

```csharp
// TradingApiIntegrationTests.cs — Full pipeline: HTTP → RingBuffer → Engine → EventLog → Replay
public class TradingApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task ReplayApi_Should_Rebuild_State_From_Log()
    {
        var buyReq = new { userId = "Alice", symbol = "BTCUSD", isBuy = true, price = 68000m, size = 2 };
        var sellReq = new { userId = "Bob", symbol = "BTCUSD", isBuy = false, price = 68000m, size = 1 };

        await _client.PostAsJsonAsync("/api/orders", buyReq);
        await Task.Delay(100); // Allow background service consumption
        await _client.PostAsJsonAsync("/api/orders", sellReq);
        await Task.Delay(100);

        // Verify 3 events: 2 NewOrders + 1 TradeExecution
        var eventsResponse = await _client.GetFromJsonAsync<JsonElement>("/api/events");
        eventsResponse.GetArrayLength().Should().Be(3);

        // Replay via API
        var replayResponse = await _client.PostAsync("/api/replay", null);
        var result = await replayResponse.Content.ReadFromJsonAsync<ReplayResult>();

        result!.EventsReplayed.Should().Be(3);
        result.TradesGenerated.Should().Be(1);
        result.FinalSnapshot!.Bids.Should().HaveCount(1);
        result.FinalSnapshot.Bids[0].Size.Should().Be(1); // 2 - 1 = 1 remaining
    }
}
```

---

# Tier 6: Performance Profiling & Benchmark Results

## Q12: What profiling tools did you use, and what were your results?

### BenchmarkDotNet-Style Metrics (5 Million Operations)

```csharp
// Benchmarks/Program.cs — Custom benchmark suite
int ops = 5_000_000;

// 1. LATENCY & THROUGHPUT
var ringBuffer = new OrderRingBuffer(ops + 1);
var watch = Stopwatch.StartNew();
for (int i = 0; i < ops; i++)
{
    var order = new OrderCore(i, 68000m, 1, i % 2 == 0, "U1");
    ringBuffer.TryWrite(in order);
}
watch.Stop();
double writeThroughput = ops / watch.Elapsed.TotalSeconds;
// → Throughput (Writes): ~40,000,000+ ops/sec

// 2. LOCK CONTENTION: Locked Queue vs Lock-Free RingBuffer
Parallel.For(0, ops, new ParallelOptions { MaxDegreeOfParallelism = 4 }, i => 
{
    lock (qLock) { queue.Enqueue(new OrderCore(...)); }
});
// → Standard Locked Queue:   ~2,500 ms
// → Lock-Free RingBuffer:    ~180 ms
// → Improvement: ~14x faster (100% Contention Eliminated)

// 3. MEMORY: Classes vs Zero-Allocation Structs
long memBefore = GC.GetTotalAllocatedBytes(true);
var classArray = new DummyOrderClass[ops];
for (int i = 0; i < ops; i++) classArray[i] = new DummyOrderClass { Price = 68000m };
long classAllocations = GC.GetTotalAllocatedBytes(true) - memBefore;
// → Classes: ~192 MB heap allocations (triggers GC)
// → Structs: 0 MB per-order allocations (pre-allocated array only)
```

**Results Summary Table:**

| Metric | Value |
|---|---|
| **Ring Buffer Write Throughput** | ~40M ops/sec |
| **Ring Buffer Read Throughput** | ~45M ops/sec |
| **Average Hot-Path Latency** | < 1 µs |
| **Lock vs Lock-Free Improvement** | ~14x faster |
| **Heap Allocations (Class path)** | ~192 MB |
| **Heap Allocations (Struct path)** | 0 MB (zero per-order GC) |
| **False Sharing** | Prevented (64-byte alignment) |
| **Thread Affinity** | Pinned to highest core |

### C++ gperftools Profiling

```cpp
// main.cpp — Profile loop runs strategy 1,000x for dense CPU flamegraph
ProfilerStart("backtester.prof");
for(int i = 0; i < 1000; i++) {
    runCandleStrategy(strategyType, candles, aggression);
}
ProfilerStop();
```

**Findings:**
- Raw order book cross-matching was effectively **instantaneous**
- CPU bottlenecks were in **math libraries**: `calcEMA()` (exponential moving average), `calcStdDev()` (square root for Bollinger Bands)
- The matching engine itself was **not the bottleneck** — the indicator math was

### Distributed Load Test (Locust — 1,000 Concurrent Users)

```python
# locustfile.py — Simulates aggressive HFT algorithmic traders
class HFTLoadUser(HttpUser):
    wait_time = between(0.01, 0.1)  # 10-100ms between orders
    
    @task(3)
    def submit_limit_order(self):
        payload = {
            "userId": self.user_id,
            "symbol": random.choice(self.symbols),
            "isBuy": random.choice([True, False]),
            "price": round(random.uniform(10.0, 100000.0), 2),
            "size": random.randint(1, 100)
        }
        with self.client.post("/api/orders", json=payload, catch_response=True) as response:
            if response.status_code == 202: response.success()
```

**Locust Results:**

| Metric | Value |
|---|---|
| **Median Latency** | 2.4 ms |
| **P99 Latency** | 3.3 ms |
| **Bottleneck** | TCP Port Exhaustion (not application) |
| **Engine CPU** | Stable (ring buffer absorbed load) |

**Key Insight:** Application logic is no longer the bottleneck — the OS networking stack is.

### eBPF Kernel Tracing Results

| Layer | Latency |
|---|---|
| **NIC → Kernel Buffer (epoll)** | ~15-20 µs |
| **Kernel → Application** | ~5-10 µs |
| **DPDK Bypass (target)** | < 2 µs |

---

# Tier 7: Additional Topics & Architecture (Missed in Original Doc)

## Event Sourcing & Deterministic Replay Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  HTTP API    │────▶│  OrderRingBuffer │────▶│  Matching    │
│  (Kestrel)   │     │  (1M pre-alloc)  │     │  Engine Loop │
│  Zero-alloc  │     │  Lock-free SPSC  │     │  (SpinWait)  │
│  JSON stream │     │                  │     │  CPU-pinned  │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                                                      │
                                          ┌───────────┼───────────┐
                                          ▼           ▼           ▼
                                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                                    │ EventLog │ │ OrderBook│ │ SignalR  │
                                    │ (Binary  │ │ (Sorted  │ │ WebSocket│
                                    │  Append) │ │  Dict)   │ │ Broadcast│
                                    └────┬─────┘ └──────────┘ └──────────┘
                                         │
                                         ▼
                                    ┌──────────┐
                                    │ Replay   │ ← Rebuild exact state
                                    │ Engine   │   from event log
                                    └──────────┘
```

**Key Pattern (LMAX Disruptor-inspired):**
1. Every state mutation is logged **BEFORE** processing (Write-Ahead Log)
2. The event log is the **source of truth** — the OrderBook is a derived projection
3. On crash recovery, `ReplayEngine` replays the log and rebuilds state deterministically
4. Trade events are **derived** — during replay, they're re-generated by the matching engine (not replayed)

```csharp
// EventLogger.cs — Append-only binary serialization (compact, no JSON overhead)
private void WriteEvent(in EngineEvent evt)
{
    _writer.Write(evt.SequenceNumber);     // 8 bytes
    _writer.Write(evt.TimestampTicks);     // 8 bytes  
    _writer.Write((byte)evt.Type);         // 1 byte
    _writer.Write(evt.OrderId);            // 8 bytes
    _writer.Write(evt.OrderPrice);         // 16 bytes (decimal)
    _writer.Write(evt.OrderSize);          // 4 bytes
    _writer.Write(evt.OrderIsBuy);         // 1 byte
    _writer.Write(evt.OrderUserId ?? "");  // variable
    _writer.Write(evt.TradePrice);         // 16 bytes
    _writer.Write(evt.TradeSize);          // 4 bytes
    _writer.Write(evt.MakerOrderId);       // 8 bytes
    _writer.Write(evt.TakerOrderId);       // 8 bytes
    _writer.Flush();                       // Sequential, gap-free
}

// ReplayEngine.cs — Deterministic state reconstruction
public ReplayResult Replay(List<EngineEvent> events, IOrderBook orderBook)
{
    orderBook.Reset(); // Clean slate
    
    foreach (var evt in events)
    {
        switch (evt.Type)
        {
            case EventType.NewOrder:
                var order = new OrderCore(evt.OrderId, evt.OrderPrice, 
                    evt.OrderSize, evt.OrderIsBuy, evt.OrderUserId ?? "");
                orderBook.AddOrder(in order);
                break;
            case EventType.CancelOrder:
                orderBook.CancelOrder(evt.OrderId);
                break;
            case EventType.TradeExecution:
                break; // Skip — trades are re-derived from matches
        }
    }
    // FinalSnapshot matches pre-crash state exactly
    result.FinalSnapshot = orderBook.GetSnapshot();
    return result;
}
```

---

## CPU Core Isolation & Thread Affinity (Deep Dive)

```
CPU Layout (8-core machine):
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│Core 0│Core 1│Core 2│Core 3│Core 4│Core 5│Core 6│Core 7│
│ OS   │ OS   │ .NET │ .NET │ .NET │ .NET │ .NET │ENGINE│
│sched │sched │ GC   │ HTTP │ HTTP │Signal│Signal│ LOOP │
│      │      │      │thread│thread│  R   │  R   │PINNED│
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
                                                    ▲
                                     ProcessorAffinity = 0b10000000
                                     (bitmask: pin to Core 7)
```

```csharp
// Why pin to the HIGHEST core?
// → OS scheduler typically favors lower cores for system tasks
// → Highest core has the least contention from OS interrupts
int processorCount = Environment.ProcessorCount;
int targetCore = processorCount - 1;           // e.g., Core 7
long affinityMask = 1L << targetCore;          // 0b10000000 = 128
processThread.ProcessorAffinity = (IntPtr)affinityMask;

// The matching thread NEVER context-switches:
// → L1 cache stays warm with order data
// → No TLB flushes from core migration
// → SpinWait keeps thread alive (no sleep/yield)
```

---

## Memory Layout: Why Structs Beat Classes in the Hot Path

```
╔══════════════════════════════════════════════════════════════╗
║ CLASS (Heap-Allocated):                                      ║
║                                                              ║
║  Stack              Heap (GC-tracked)                        ║
║  ┌─────────┐       ┌────────────────────────────────┐       ║
║  │  ref ───────────▶│ Object Header (16 bytes)       │       ║
║  └─────────┘       │ OrderId (8 bytes)               │       ║
║                     │ Price (16 bytes)                │       ║
║                     │ Size (4 bytes)                  │       ║
║                     │ IsBuy (1 byte)                  │       ║
║                     │ UserId ref ──▶ another heap obj │       ║
║                     │ [padding]                       │       ║
║                     └────────────────────────────────┘       ║
║  Total: ~56+ bytes + GC overhead + possible fragmentation    ║
╠══════════════════════════════════════════════════════════════╣
║ STRUCT (Stack-Allocated, Cache-Aligned):                     ║
║                                                              ║
║  Stack / Pre-allocated Array                                 ║
║  ┌────────────────────────────────────────────────────┐     ║
║  │ [0]  OrderId | Price | Size | IsBuy | UserId | pad│     ║
║  │      ◄────────── 64 bytes (1 cache line) ─────────▶     ║
║  ├────────────────────────────────────────────────────┤     ║
║  │ [1]  OrderId | Price | Size | IsBuy | UserId | pad│     ║
║  │      ◄────────── 64 bytes (1 cache line) ─────────▶     ║
║  └────────────────────────────────────────────────────┘     ║
║  Total: 64 bytes, zero GC, contiguous, CPU prefetchable      ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Data Flow Diagram: Order Lifecycle

```
Client POST /api/orders
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. API LAYER (Kestrel HTTP Thread)                          │
│    JsonSerializer.DeserializeAsync<T>(req.Body)             │
│    → Zero-allocation: streams from socket to struct         │
│    → new OrderCore(id, price, size, isBuy, userId)          │
│    → ringBuffer.TryWrite(in workingOrder)                   │
│    → Returns HTTP 202 Accepted (or 429 if buffer full)      │
└─────────────────────┬───────────────────────────────────────┘
                      │ (Lock-free boundary)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. RING BUFFER (1M pre-allocated OrderCore[] slots)         │
│    SPSC: API thread writes → Engine thread reads            │
│    No locks, no allocations, no GC pressure                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ENGINE LOOP (CPU-pinned, SpinWait, ThreadPriority.High)  │
│    ├── _eventLogger.LogNewOrder(in order)  ← Write-Ahead   │
│    ├── _orderBook.AddOrder(in order)       ← Match Engine   │
│    │      ├── MatchOrder(ref incoming)                      │
│    │      │     ├── Cross against best price                │
│    │      │     ├── Generate Trade event                    │
│    │      │     └── Remove filled orders                    │
│    │      └── Rest unmatched order on book                  │
│    └── Broadcast metrics via SignalR (fire-and-forget)      │
└─────────────────────┬───────────────────────────────────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│ FAST PATH        │  │ SLOW PATH        │
│ • Matching       │  │ • Redis Settlement│
│ • Event Logging  │  │ • WebSocket Push  │
│ • Telemetry      │  │ • Trade History   │
│ (microseconds)   │  │ (async Task.Run)  │
└──────────────────┘  └──────────────────┘
```

---

## Quantitative Backtester Architecture (C++ Engine)

```
Python Script (fetch_gemini_data.py)
        │
        ▼ CSV (candle data: timestamp, OHLCV)
┌─────────────────────────────────────────────────────────────┐
│ C++ Backtester (compiled with gperftools)                    │
│                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────┐   │
│  │ readCandles()│───▶│ Strategy Runner (zero-copy loop) │   │
│  │  CSV Parser  │    │                                  │   │
│  └─────────────┘    │  • SMA Crossover (10/30)         │   │
│                      │  • RSI Mean Reversion (14)       │   │
│                      │  • Bollinger Bands (20/2σ)       │   │
│                      │  • MACD Signal (12/26/9)         │   │
│                      │                                  │   │
│                      │  Outputs:                        │   │
│                      │  • Total PnL                     │   │
│                      │  • Win Rate                      │   │
│                      │  • Sharpe Ratio                  │   │
│                      │  • Max Drawdown                  │   │
│                      │  • Per-candle latency (µs)       │   │
│                      └──────────────┬───────────────────┘   │
│                                     │                       │
│                                     ▼                       │
│                      ┌──────────────────────────────┐       │
│                      │ data/backtest_report.json     │       │
│                      └──────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ JSON report
┌─────────────────────────────────────────────────────────────┐
│ C# API Layer                                                │
│  POST /api/run-custom-strategy → Process.Start(C++ binary)  │
│  → Returns JSON telemetry to React frontend                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick-Reference: Key Technical Vocabulary for the Interview

| Concept | Where in My Code | One-Liner |
|---|---|---|
| **Zero-Allocation** | `OrderCore` readonly struct | Stack-allocated, no GC tracking |
| **Cache-Line Alignment** | `StructLayout(Size=64)` / `alignas(64)` | Prevents false sharing between threads |
| **Lock-Free Queue** | `OrderRingBuffer` SPSC | Pre-allocated array, head/tail pointers |
| **Thread Affinity** | `ProcessorAffinity` bitmask | Pin thread to core, keep L1 warm |
| **SpinWait Loop** | `TradingEngineBackgroundService` | Never yield CPU, minimal latency |
| **Event Sourcing** | `EventLogger` + `ReplayEngine` | Log is source of truth, book is projection |
| **Write-Ahead Log** | Log event BEFORE `AddOrder()` | Crash recovery via sequential replay |
| **Streaming JSON** | `DeserializeAsync<T>(req.Body)` | Zero-copy from socket to struct |
| **Back-Pressure** | `TryWrite` → HTTP 429 | Never block producer, reject at capacity |
| **Hybrid Architecture** | C++ backtester + C# server | C++ for math, C# for control plane |

---

*Good luck, Vishal. You built this. Own it.* 🚀
