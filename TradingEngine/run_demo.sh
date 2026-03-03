#!/bin/bash

# Ensure we exit on failure
set -e

echo "=========================================================="
echo "🚀 STARTING HFT POC PIPELINE LIVE DEMO 🚀"
echo "=========================================================="
echo "Simulating a low-latency environment workflow..."
echo ""

# 1. Fetch live market data
echo "[1/3] 📡 Connecting to Gemini REST API for live BTC/USD L2 Orderbook..."
python3 scripts/fetch_gemini_data.py
echo ""

# 2. Rebuild the C++ engine (just in case) and run the backtester
echo "[2/3] ⚡ Running Cache-Aligned C++17 Core Matching Engine..."
# Build
cd cpp_backtester
mkdir -p build && cd build
cmake .. > /dev/null
make > /dev/null
cd ../../
# Execute Backtester
./cpp_backtester/build/backtester data/gemini_btcusd_orderbook.csv
echo ""

# 3. Agent Review
echo "[3/3] 🧠 Triggering LLM Agent Insight Reviewer..."
python3 scripts/ai_reviewer.py

echo "=========================================================="
echo "✅ DEMO COMPLETE: Metrics and insights have been logged."
echo "=========================================================="
