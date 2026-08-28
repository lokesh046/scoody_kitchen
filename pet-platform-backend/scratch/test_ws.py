import asyncio
import websockets
import jwt
from datetime import datetime, timedelta, UTC

JWT_SECRET_KEY = "a9F8xK3mP2qR7vW0zY4bN8cL1dE6fG9hJ3kM5nP8rT1uV4wX7zY0aB3cD6eF9gH2"
JWT_ALGORITHM = "HS256"

# Generate a mock valid access token for user ID 5 (admin)
payload = {
    "sub": "5",
    "type": "access",
    "exp": datetime.now(UTC) + timedelta(minutes=30)
}
token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

async def test_conn():
    url = f"ws://127.0.0.1:8000/notifications/ws?token={token}"
    print(f"Connecting to: {url}")
    try:
        async with websockets.connect(url) as websocket:
            print("Connected successfully!")
            print("Waiting for messages...")
            # Receive one message or timeout
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"Received: {message}")
            except asyncio.TimeoutError:
                print("No message received (timeout), but connection was held open successfully!")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
