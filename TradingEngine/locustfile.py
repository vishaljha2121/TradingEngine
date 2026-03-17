import random
import time
from locust import HttpUser, task, between, events

class HFTLoadUser(HttpUser):
    # Simulate a realistic High-Frequency Trading client
    # Wait between 0.01s and 0.1s between tasks to simulate aggressive algos
    wait_time = between(0.01, 0.1)
    
    symbols = ["BTCUSD", "ETHUSD", "SOLUSD", "DOGEUSD", "AAPL", "TSLA"]
    users = ["Alice", "Bob", "Charlie", "Dave", "Eve"]

    def on_start(self):
        # Authenticate / Set up state if necessary
        self.user_id = random.choice(self.users)
        
    @task(3)
    def submit_limit_order(self):
        # 70% chance to submit a standard limit order
        price = round(random.uniform(10.0, 100000.0), 2)
        size = random.randint(1, 100)
        is_buy = random.choice([True, False])
        
        payload = {
            "userId": self.user_id,
            "symbol": random.choice(self.symbols),
            "isBuy": is_buy,
            "price": price,
            "size": size
        }
        
        # Fire and forget POST request
        with self.client.post("/api/orders", json=payload, catch_response=True) as response:
            if response.status_code == 202:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")

    @task(1)
    def ping_event_stream(self):
        # 30% chance to ping the event stream to test read-path concurrency
        with self.client.get("/api/events/count", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Starting Distributed HFT Saturation Load Test...")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("Test Completed. Reviewing Saturation Metrics.")
