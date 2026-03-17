import asyncio
import aiohttp
import time
import json
import random

async def send_order(session, url, user_id):
    order = {
        "userId": user_id,
        "symbol": "BTCUSD",
        "isBuy": random.choice([True, False]),
        "price": round(random.uniform(60000, 65000), 2),
        "size": round(random.uniform(0.1, 5.0), 4)
    }
    try:
        async with session.post(url, json=order) as response:
            await response.read()
    except Exception as e:
        pass

async def load_test(duration=30):
    url = "http://localhost:12000/api/orders"
    users = ["Alice", "Bob", "Charlie", "David", "Eve"]
    
    print(f"Starting load test for {duration} seconds...")
    start_time = time.time()
    count = 0
    
    async with aiohttp.ClientSession() as session:
        while time.time() - start_time < duration:
            tasks = [send_order(session, url, random.choice(users)) for _ in range(500)]
            await asyncio.gather(*tasks)
            count += 500
            
    print(f"Load test complete. Sent roughly {count} orders.")

if __name__ == "__main__":
    asyncio.run(load_test(20))
