# Execution Coach
**A Pre-Trade Decision Support Engine**

## Overview
Execution Coach is a high-performance prototype designed to dynamically recommend ideal trading execution postures. It calculates real-time Execution Expected Cost and Risk based on deep market states, size constraints, and latency network models.

## Architecture

The project implements a modern Clean Architecture stack bridging high-fidelity web interfaces to raw high-frequency C++ code.

1. **Frontend (`/frontend`)**
   - Built on Vite, React, and TailwindCSS (TrueMarkets colors).
   - Responsive Dashboard showing empirical spread data and slippage metrics.
   - Throttles live WebSocket feeds (Gemini `BTCUSD` with 3-try mock fallback) via debounced React Hooks.

2. **API Proxy Layer (`/backend`)**
   - Lightweight Python FastAPI service.
   - Handles REST `JSON` from the frontend and securely translates context frames into memory-aligned Binary components.
   - Serializes data via **Apache FlatBuffers**, achieving the zero-copy industry standard for Big Data / HFT architectures.

3. **Execution Engine (`../TradingEngine/cpp_backtester`)**
   - Bypasses traditional disk I/O formats (like CSV) and reads the `.bin` FlatBuffers directly in RAM.
   - Models Execution Cost based on aggressive/passive spread logic.
   - Enforces **Inventory Risk Caps** by throwing hard +100 point penalties when position sizes breach dynamic thresholds.

## How to Run the Demo

To run the full stack locally:
```bash
./run_demo.sh
```

This will safely orchestrate the Python backend worker and boot the Vite server together. Access the dashboard at `http://localhost:5173`.

*Designed for the TrueMarkets 2026 Interview Superday.*
