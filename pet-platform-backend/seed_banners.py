import socket
orig = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, type=0, proto=0, flags=0: orig(host, port, socket.AF_INET, type, proto, flags)

from app.core.database import engine
from sqlalchemy import text

check_query = "SELECT COUNT(*) FROM banners;"
insert_query = """
INSERT INTO banners (title, subtitle, image_url, link_url, display_order, is_active)
VALUES
(
    'Welcome to Scooby''s Kitchen',
    'Human-grade, small-batch recipes cooked for active pet health. Sourced with 100% transparent ingredients.',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=1200',
    '/shop',
    1,
    TRUE
),
(
    'Honest Ingredients. Zero Filler.',
    'Every single recipe batch contains zero corn, wheat, soy, or rendering byproducts. Certified by pet nutritionists.',
    'https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=80&w=1200',
    '/shop',
    2,
    TRUE
),
(
    'Veterinary Audited Diets',
    'Schedule online consultations and log active nutritional diagnostics directly with certified pet doctors.',
    'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=1200',
    '/consultations',
    3,
    TRUE
);
"""

print("Checking banners table content...")
with engine.connect() as conn:
    count = conn.execute(text(check_query)).scalar()
    if count == 0:
        print("Banners table is empty. Inserting sample banners...")
        conn.execute(text(insert_query))
        conn.commit()
        print("Sample banners seeded successfully!")
    else:
        print(f"Banners table already has {count} entries. Skipping seeding.")
