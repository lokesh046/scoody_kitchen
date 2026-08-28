from app.core.database import SessionLocal
from app.models.banner import Banner

db = SessionLocal()
banners = db.query(Banner).all()
print(f"Total banners in DB: {len(banners)}")
for b in banners:
    print(f"ID: {b.id}, Title: {b.title}, Subtitle: {b.subtitle}, Image URL: {b.image_url}, Active: {b.is_active}")
db.close()
