import requests
import json
import csv
import time
import os

# Gemini public API endpoint for getting the orderbook
GEMINI_REST_URL = "https://api.gemini.com/v1/book"

def fetch_orderbook(symbol="btcusd", limit_bids=50, limit_asks=50):
    try:
        response = requests.get(f"{GEMINI_REST_URL}/{symbol}?limit_bids={limit_bids}&limit_asks={limit_asks}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from Gemini API: {e}")
        return None

def save_to_csv(orderbook, filename):
    if not orderbook:
        return
        
    print(f"Saving {len(orderbook.get('bids', []))} bids and {len(orderbook.get('asks', []))} asks to {filename}...")
    
    # We will format it as: side(buy/sell), price, amount
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["side", "price", "amount"])
        
        for bid in orderbook.get('bids', []):
            writer.writerow(["buy", bid['price'], bid['amount']])
            
        for ask in orderbook.get('asks', []):
            writer.writerow(["sell", ask['price'], ask['amount']])
            
    print("Done!")

if __name__ == "__main__":
    import sys
    
    symbol = "btcusd"
    if len(sys.argv) > 1:
        symbol = sys.argv[1].lower()
    
    # Ensure data directory exists
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    output_file = os.path.join(data_dir, f"gemini_{symbol}_orderbook.csv")
    
    print(f"Fetching Gemini orderbook for {symbol.upper()}...")
    ob = fetch_orderbook(symbol)
    save_to_csv(ob, output_file)
