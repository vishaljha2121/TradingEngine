# .NET Ultra-Low Latency Trading Engine & Real-Time Visualizer

## Project Overview

This project is a high-performance, real-time Trading Engine built with `.NET 9` and `React`. It simulates the core matching logic found in financial exchanges, incorporating advanced performance engineering techniques often required in High-Frequency Trading (HFT) and ultra-low latency (ULL) environments. 

The accompanying frontend visualizer connects via WebSockets (SignalR) to display live order book depth, trade execution history, and real-time performance telemetry.

---

## 🏗️ Architecture & Core Components

### 1. The Backend (C# .NET 9)
The backend is a unified `.NET WebApplication` that hosts both a REST API for ingestion and a long-running background service for processing.

*   **API Layer (`Minimal APIs`)**: Exposes a `POST /api/orders` endpoint. It receives raw JSON orders from clients, converts them into memory-efficient structs, and immediately writes them to a lock-free ring buffer without blocking the HTTP thread.
*   **Message Bus / Queuing (`OrderRingBuffer`)**: Acts as the high-throughput bridge between the web API threads and the core matching engine thread.
*   **The Matching Engine (`TradingEngineBackgroundService`)**: A dedicated, long-running thread that continuously polls the ring buffer. It takes incoming orders and routes them to the `OrderBook`.
*   **The Order Book (`OrderBook` using `SortedDictionary`)**: The stateful memory structure representing Bids and Asks. It performs continuous cross-matching to execute trades when Buy and Sell prices overlap.
*   **Broadcasting Layer (`SignalR Hub`)**: Pushes state changes (Trades and Order Book Snapshots) out to all connected websocket clients (the frontend) in real-time.

### 2. The Frontend (React + Vite)
The front end is designed as a standalone trading terminal:
*   **Order Entry**: Form for submitting BUY and SELL orders.
*   **Real-Time Depth Chart**: Visualizes the `OrderBookSnapshot` pushed from the server using dynamic CSS depth bars.
*   **Trade Ticker**: A scrolling history of executed trades.
*   **Telemetry Dashboard**: Live metrics displaying the engine's sub-millisecond execution times and memory allocations.

---

## 🚀 Advanced Performance Engineering 

To demonstrate systems-level optimizations, several techniques were implemented to minimize Garbage Collection (GC) pauses, prevent CPU cache misses, and isolate execution contexts.

### 1. Zero-Allocation Memory Modeling (Simulating [Kernel Bypass](https://en.wikipedia.org/wiki/Data_Plane_Development_Kit))
*   **What was implemented?** We eliminated the use of standard garbage-collected classes (e.g., `class Order`) on the "hot path" (the continuous execution loop). Instead, orders are passed as memory-efficient, stack-allocated `readonly struct OrderCore`. 
*   **Why?** In high-throughput systems, constantly generating `new Object()` forces the .NET Garbage Collector to run frequently. GC pauses stop the entire application ("Stop The World" events), causing unacceptable microsecond latency spikes (jitter).
*   **The Component:** The `OrderRingBuffer`. Instead of standard queues, the engine utilizes a lock-free Ring Buffer (an implementation of the [Object Pool Pattern](https://en.wikipedia.org/wiki/Object_pool_pattern)) that pre-allocates an array of `1,000,000` structs on startup. Incoming API requests write data *directly into this pre-allocated block of memory*, simulating the direct-memory-access (DMA) properties of Kernel Bypass networking (like DPDK).

### 2. Cache-Line Alignment & [False Sharing](https://en.wikipedia.org/wiki/False_sharing) Prevention
*   **What was implemented?** The core data structure was explicitly laid out in memory using `[StructLayout(LayoutKind.Explicit, Size = 64)]`.
*   **Why?** Modern CPUs fetch memory from RAM into their incredibly fast L1/L2 caches in chunks called "Cache Lines" (which are exactly 64 bytes long on standard x86/ARM architectures). If two separate threads write to different variables that happen to sit next to each other in the same 64-byte chunk of RAM, the hardware will constantly invalidate and re-fetch the entire cache line across CPU cores. This performance killer is called "False Sharing".
*   **The Fix:** By strictly forcing the `OrderCore` struct to be exactly 64-bytes (using `[FieldOffset]` and padding), we guarantee that one individual order perfectly fills exactly one CPU Cache Line. Thread A and Thread B will never accidentally share a cache line while processing different orders.

### 3. CPU Core Isolation & [Thread Affinity](https://en.wikipedia.org/wiki/Processor_affinity)
*   **What was implemented?** The core execution loop utilizes native OS system calls (`ProcessThread.ProcessorAffinity`) to pin the matching thread to a specific, physical hardware CPU Core.
*   **Why?** The OS thread scheduler normally moves application threads across different physical CPU cores dynamically to balance heat and power. Every time a thread changes physical cores, the CPU's local L1 cache is wiped. By pinning our `SpinWait` loop to the highest available processor (e.g., Core 7 on an 8-core machine), we guarantee the thread never context-switches, keeping the CPU cache perfectly "warm" with order data.
*   **Fallback:** Core Affinity is a low-level OS feature. `TradingEngineBackgroundService` checks the OS environment using `OperatingSystem.IsWindows()` or `OperatingSystem.IsLinux()`. If the application is run on a local development machine running macOS (which restricts processor affinity binding), the engine gracefully falls back to a standard unbound thread and marks the telemetry panel as "Unpinned".

## 🧪 Advanced Backtest Playground & Multi-Coin Integration

To enhance the visualizer and provide tools for quantitative research, a hybrid backtesting environment was implemented:

### 1. Dynamic Market Data (Python & Gemini API)
*   **What was implemented?** A real-time data ingestion script (`fetch_gemini_data.py`) querying the live Gemini public API.
*   **Why?** Order books need realistic, deep liquidity snapshots to test strategy impacts accurately. By supporting dynamic coin pairs (e.g., `BTC/USD`, `ETH/USD`, `SOL/USD`), the backtester evaluates strategies against current market conditions instantly. The frontend pulls this directly via a `/api/marketdata/{symbol}` endpoint.

### 2. High-Performance Quantitative Engine (C++17)
*   **What was implemented?** A bespoke C++ execution core parsing raw order book states and running dynamic, parameter-driven strategies (e.g., *Momentum / Trend*, *Spread Arbitrage*) with zero-overhead loops.
*   **Why?** Backtesting requires processing thousands of simulated order executions in fractions of a second. The C++ core strictly handles logic and math, dumping the calculated JSON state back to the C# wrapper.
*   **The Metrics:** The engine calculates industry-standard metrics:
    *   **Total PnL:** The absolute value gained or lost purely on spread captures and price delta.
    *   **Win Rate:** Percentage of placed orders that resolved profitably over the spread.
    *   **Sharpe Ratio:** Evaluates strategy return against volatility risk logic.
    *   **Max Drawdown:** Highlights the worst-case capital loss observed during the simulation path.

### 3. Agentic LLM Strategy Feedback
*   **What was implemented?** A deep integration routing the backtest reports (JSON telemetry + quantitative readouts) to an AI analysis endpoint.
*   **Why?** For rapid iterative development, having an LLM review latency bottlenecks, structural code inefficiencies (like checking lock-free queues), or trading logic flaws directly from the playground UI accelerates the tuning of high-frequency strategies.

### 4. Famous Strategy Templates (Candle-Based Backtesting)
*   **What was implemented?** Four industry-standard trading strategies were built directly into the C++ backtester, each operating on historical candlestick data fetched from the [Gemini v2 Candles API](https://docs.gemini.com/rest-api#list-candles):
    *   **SMA Crossover (10/30)** — Detects Golden Cross (buy) and Death Cross (sell) events between a short-period and long-period Simple Moving Average.
    *   **RSI Mean Reversion (14-period)** — Identifies oversold (RSI < 30) and overbought (RSI > 70) conditions to trade counter-trend reversals.
    *   **Bollinger Bands Breakout (20/2σ)** — Trades when price touches the lower band (buy) or upper band (sell), calculated as 2 standard deviations from a 20-period SMA.
    *   **MACD Signal Line (12/26/9)** — Generates buy/sell signals when the MACD line (12-EMA minus 26-EMA) crosses above or below its 9-period signal line.
*   **Why?** These are the most widely-taught and backtested strategies in quantitative finance. Offering them as one-click templates lets novice users immediately see how different strategies behave across different market conditions — without needing to understand the underlying indicator math.
*   **Timeframe Selection:** Users can choose from 7 candle intervals (`1m`, `5m`, `15m`, `30m`, `1hr`, `6hr`, `1day`), allowing the same strategy to be evaluated across intraday scalping to daily swing-trading horizons.

---

## 📈 Summary of Telemetry Metrics
When the system is running:
*   **Latency (µs)**: Measures the time it takes the `TradingEngineBackgroundService` to pull an order from the Ring Buffer, match it against the `OrderBook`, and generate a trade event, measured in microseconds (1/1,000,000th of a second).
*   **Allocations**: Validates the "Zero-Allocation" pipeline perfectly tracking 0 heap allocations during the hot path.
*   **Core ID**: Validates the successful application of the Thread Affinity bitmask.
