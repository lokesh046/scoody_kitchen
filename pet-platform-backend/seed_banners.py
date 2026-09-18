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
    'Hearth & Hound: Small-Batch Canine Nutrition',
    'Wholesome Chicken & Sweet Potato recipes hand-crafted with human-grade ingredients and zero rendering byproducts.',
    'https://res.cloudinary.com/utnenyxi/image/upload/v1788521361/scooby_kitchen/zfmzprttuoojru2qleeh.jpg',
    '/shop',
    1,
    TRUE
),
(
    'Honest Ingredients. Zero Filler.',
    'Every single recipe batch contains zero corn, wheat, soy, or synthetic preservatives. Tested by clinical pet nutritionists.',
    'https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg',
    '/shop',
    2,
    TRUE
),
(
    'Farm-To-Bowl Fresh Holistic Meals',
    'Real whole-food chicken and farm-fresh sweet potatoes slow-cooked daily to nurture mind, body, and vitality.',
    'https://res.cloudinary.com/utnenyxi/image/upload/v1788521315/scooby_kitchen/nji85annhntaovsycm9q.jpg',
    '/shop',
    3,
    TRUE
),
(
    'Raptor: High-Protein All-Meat Diet',
    'Pure primal nutrition engineered for athletic endurance, lean muscle development, and digestive resilience.',
    'https://res.cloudinary.com/utnenyxi/image/upload/v1788521296/scooby_kitchen/fcw2fhniavnni3qracok.jpg',
    '/shop',
    4,
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
