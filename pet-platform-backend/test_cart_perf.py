import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

import time
from app.core.database import SessionLocal
from sqlalchemy import select
from app.models.cart import Cart
from app.models.product import Product
from app.models.user import User

db = SessionLocal()

print("Testing database connection speed (Query 1)...")
t0 = time.time()
db.execute(select(1))
print(f"Query 1: {time.time() - t0:.3f}s")

print("Testing database connection speed (Query 2)...")
t0 = time.time()
db.execute(select(1))
print(f"Query 2: {time.time() - t0:.3f}s")

print("Fetching first user in the database...")
user = db.scalar(select(User).limit(1))
if user:
    print(f"Found active user ID {user.id}")
    
    print("Fetching active user cart (Query 1)...")
    t0 = time.time()
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    print(f"Fetch cart 1: {time.time() - t0:.3f}s")

    print("Fetching active user cart (Query 2)...")
    t0 = time.time()
    cart = db.scalar(select(Cart).where(Cart.user_id == user.id))
    print(f"Fetch cart 2: {time.time() - t0:.3f}s")
else:
    print("No users found.")

db.close()
