import requests
import json
import csv
import time
import os
import sys

# Gemini public API endpoints
GEMINI_BOOK_URL = "https://api.gemini.com/v1/book"
GEMINI_CANDLES_URL = "https://api.gemini.com/v2/candles"

def fetch_orderbook(symbol="btcusd", limit_bids=50, limit_asks=50):
    try:
        response = requests.get(f"{GEMINI_BOOK_URL}/{symbol}?limit_bids={limit_bids}&limit_asks={limit_asks}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from Gemini API: {e}")
        return None

def fetch_candles(symbol="btcusd", timeframe="1h"):
    """Fetch candle data from Gemini v2 API.
    Returns array of [timestamp, open, high, low, close, volume]
    """
    try:
        url = f"{GEMINI_CANDLES_URL}/{symbol}/{timeframe}"
        print(f"Fetching candles from: {url}")
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching candle data from Gemini API: {e}")
        return None

def save_orderbook_to_csv(orderbook, filename):
    if not orderbook:
        return
    print(f"Saving {len(orderbook.get('bids', []))} bids and {len(orderbook.get('asks', []))} asks to {filename}...")
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["side", "price", "amount"])
        for bid in orderbook.get('bids', []):
            writer.writerow(["buy", bid['price'], bid['amount']])
        for ask in orderbook.get('asks', []):
            writer.writerow(["sell", ask['price'], ask['amount']])
    print("Done!")

def save_candles_to_csv(candles, filename):
    """Save candles as CSV with columns: timestamp,open,high,low,close,volume"""
    if not candles:
        return
    # Gemini returns newest first, reverse for chronological order
    candles = sorted(candles, key=lambda c: c[0])
    print(f"Saving {len(candles)} candles to {filename}...")
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        for candle in candles:
            # candle = [timestamp_ms, open, high, low, close, volume]
            writer.writerow(candle)
    print("Done!")

if __name__ == "__main__":
    symbol = "btcusd"
    mode = "orderbook"  # default
    timeframe = "1h"

    # Parse arguments
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--candles":
            mode = "candles"
        elif args[i] == "--timeframe" and i + 1 < len(args):
            timeframe = args[i + 1]
            i += 1
        else:
            symbol = args[i].lower()
        i += 1

    # Ensure data directory exists
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

    if mode == "candles":
        output_file = os.path.join(data_dir, f"gemini_{symbol}_candles_{timeframe}.csv")
        print(f"Fetching Gemini candles for {symbol.upper()} ({timeframe})...")
        candles = fetch_candles(symbol, timeframe)
        save_candles_to_csv(candles, output_file)
    else:
        output_file = os.path.join(data_dir, f"gemini_{symbol}_orderbook.csv")
        print(f"Fetching Gemini orderbook for {symbol.upper()}...")
        ob = fetch_orderbook(symbol)
        save_orderbook_to_csv(ob, output_file)
