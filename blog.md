# Engineering Blog: Securing and Profiling an Ultra-Low Latency Trading Engine

Building an exchange matching engine is only half the battle; ensuring it behaves correctly under extreme stress and recovers deterministically from failure is what separates a toy project from a production system. In our latest sprint on the **TrueMarkets Trading Engine**, we set out to harden the core infrastructure through Event Sourcing and push it to its limits with industry-standard performance profiling. 

Here is what we did, why we did it, and what we learned.

---

## 1. What We Did: Event Sourcing & Rigorous Testing

**The Goal:** Ensure 100% deterministic reproducibility of the trading state and mathematically verify all edge cases with >80% code coverage.

**How We Did It:**
*   **Deterministic Replay Engine:** We implemented the *Event Sourcing* pattern. Every state mutation (New Order, Cancel, Execution) is serialized into a highly compact `EngineEvent` struct and written to an append-only binary log. If the server crashes, an isolated `ReplayEngine` component can stream this log and reconstruct the `OrderBook` to its exact pre-crash state. 
*   **Full Test Suite:** We introduced `xUnit` and `Moq` to the C# Backend. We built 29 isolated unit tests covering the `ref in` struct modifications in the lock-free ring buffer and simulated concurrency behavior on the order book.
*   **Integration Tests:** We utilized `WebApplicationFactory` to spin up the entire Kestrel HTTP pipeline in memory, validating the REST APIs and Game Room state transitions end-to-end.

**The Result:** The codebase successfully achieved **81.2% Code Coverage**, verifying deterministic behavior and ensuring our Game Room loops behave as mathematically expected.

---

## 2. Pushing the Limits: Performance Profiling

**The Goal:** We knew our matching engine and lock-free thread queues were fast, but we needed empirical data to spot hidden latency bottlenecks occurring under mass saturation.

### Tracing the C++ Quantitative Backend
We integrated **Google Performance Tools (`gperftools`)** directly into the `CMakeLists.txt` for our C++ execution core. 

*   **The Test:** We wrapped the execution loop in `ProfilerStart` and looped the `sma_crossover` strategy 1,000 times over high-resolution historical Gemini candles, dumping the output to a `.prof` flamegraph.
*   **The Inference:** The raw processing of the order book was effectively instantaneous. The actual CPU bottlenecks were entirely concentrated in the math libraries computing exponential moving averages (`calcEMA`) and the square-root heavy standard deviation calculations for Bollinger Bands (`calcStdDev`). 

### Tracing the C# Web Ingestion API
We utilized the `.NET Global Tools` (`dotnet-trace` and `dotnet-counters`) and built a custom Python `aiohttp` benchmarking script to fire 5,000+ unthrottled concurrent requests at the `POST /api/orders` endpoint.

*   **The GC Bottleneck:** While the core execution thread was zero-allocation, `dotnet-counters` flagged a staggering **479 MB of Gen0 Garbage Collection** occurring within seconds. This GC pausing was creating latency spikes and forcing the `json` parser to throw thousands of `JsonExceptions` as server threads starved. 
*   **How We Fixed It:** The bottleneck was identified in the REST API ingestion layer. We were using `StreamReader.ReadToEndAsync()` to buffer the incoming HTTP body into a contiguous string before deserializing. By refactoring the endpoints to use `System.Text.Json.JsonSerializer.DeserializeAsync<T>()`, the framework now streams the JSON bytes *directly* from the Kestrel socket into the struct representations. This completely eliminated the massive string allocations and resolved the GC pressure.

---

## 3. Further Explorations & Next Steps

With the application-level data structures optimized and the Hot-Path allocation-free, the next frontiers for latency reduction lie closer to the operating system logic:

1.   **Kernel Bypass (DPDK):** Currently, our locks are gone, but packet data still flows through the standard Linux/macOS network stack. Exploring proper DPDK integration would allow the application to read orders natively from the Network Interface Card (NIC), bypassing OS interrupts entirely.
2.   **eBPF Tracing:** We used application-level profilers. Next, we plan to use eBPF to profile the actual TCP packet drops and kernel-level context switching times.
3.   **Distributed Load Testing:** Our simple Python script maxed out the local port limits. We plan to deploy the engine to a dedicated AWS bare-metal instance and bombard it using a distributed tester like clustered `Locust` to simulate global market volatility accurately.
