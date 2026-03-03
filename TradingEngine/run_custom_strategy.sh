#!/bin/bash

# Ensure we exit on failure
set -e

SYMBOL=${1:-"btcusd"}
STRATEGY_TYPE=${2:-"momentum"}
AGGR=${3:-1.0}
BUY_THRESH=${4:-0.0001}
SELL_THRESH=${5:-0.0001}
TIMEFRAME=${6:-"1h"}

echo "Running Custom Strategy with Symbol=$SYMBOL Strategy=$STRATEGY_TYPE Aggression=$AGGR Timeframe=$TIMEFRAME"

# Candle-based famous strategies use the candle CSV
if [[ "$STRATEGY_TYPE" == "sma_crossover" || "$STRATEGY_TYPE" == "rsi_mean_reversion" || "$STRATEGY_TYPE" == "bollinger_breakout" || "$STRATEGY_TYPE" == "macd_signal" ]]; then
    # Fetch candle data
    python3 scripts/fetch_gemini_data.py $SYMBOL --candles --timeframe $TIMEFRAME > /dev/null
    # Execute Backtester with candle CSV
    ./cpp_backtester/build/backtester data/gemini_${SYMBOL}_candles_${TIMEFRAME}.csv $STRATEGY_TYPE $AGGR $BUY_THRESH $SELL_THRESH
else
    # Orderbook-based strategies (momentum, spread_arbitrage)
    python3 scripts/fetch_gemini_data.py $SYMBOL > /dev/null
    ./cpp_backtester/build/backtester data/gemini_${SYMBOL}_orderbook.csv $STRATEGY_TYPE $AGGR $BUY_THRESH $SELL_THRESH
fi
