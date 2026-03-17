import requests

order = {
    "userId": "Alice",
    "symbol": "BTCUSD",
    "isBuy": True,
    "price": 60000.0,
    "size": 1.5
}
try:
    response = requests.post("http://localhost:12000/api/orders", json=order)
    print(f"Status Code: {response.status_code}")
    print(f"Response Text: {response.text}")
except Exception as e:
    print(e)
