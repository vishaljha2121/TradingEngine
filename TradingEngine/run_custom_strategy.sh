#!/bin/bash

# Ensure we exit on failure
set -e

SYMBOL=${1:-"btcusd"}
STRATEGY_TYPE=${2:-"momentum"}
AGGR=${3:-1.0}
BUY_THRESH=${4:-0.0001}
SELL_THRESH=${5:-0.0001}

echo "Running Custom Strategy with Symbol=$SYMBOL Strategy=$STRATEGY_TYPE Aggression=$AGGR BuyThresh=$BUY_THRESH SellThresh=$SELL_THRESH"

# 1. Fetch the data for the requested symbol
python3 scripts/fetch_gemini_data.py $SYMBOL > /dev/null

# 2. Execute Backtester
./cpp_backtester/build/backtester data/gemini_${SYMBOL}_orderbook.csv $STRATEGY_TYPE $AGGR $BUY_THRESH $SELL_THRESH
