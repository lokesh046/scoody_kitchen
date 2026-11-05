"""Adds the landing-page top banners (Shop, Know Your Pet, Locate Your Vet, Count The Calories) to this database.

Safe to run more than once: a page that already has an active banner is skipped.
Dry run by default; nothing is written unless you pass --apply.

Run inside the backend container (no secrets needed, it uses the app's own connection):
  docker exec -i pet_platform_backend python - --apply < add_landing_page_banners.py

Source: the first three are the banners that beta already shows; the Count The Calories one is new. The Shop subtitle was reworded because
beta's said "Human-grade recipes ... every ingredient and its percentage published", which we
cannot back up. The Know Your Pet and Locate Your Vet text is unchanged.
"""
import sys

from app.core.database import SessionLocal
from app.models.banner import Banner

BANNERS = [
    dict(
        placement="shop_hero",
        title="Food you can read, start to finish.",
        subtitle="Recipes made in small batches, with each ingredient listed so you can check what goes into the bowl.",
        image_url="https://res.cloudinary.com/utnenyxi/image/upload/v1788521353/scooby_kitchen/l0pkroz1l1dt6d0filb9.jpg",
    ),
    dict(
        placement="pets_hero",
        title="Everything about your pet, in one place.",
        subtitle="Build a profile that captures your companion's essential details, unique characteristics, and everyday needs.",
        image_url="/images/hero/hero-2.webp",
    ),
    dict(
        placement="vet_hero",
        title="The right care starts closer than you think.",
        subtitle="Find veterinary clinics in your area and take the next step towards getting your companion the care they need.",
        image_url="/images/hero/vet-3.webp",
    ),
    dict(
        placement="calculator_hero",
        title="A little more clarity in every meal.",
        subtitle="Understand your pet's daily energy requirements and get a more informed starting point for planning their meals.",
        image_url="/images/hero/calculator-1.webp",
    ),
]

apply = "--apply" in sys.argv
db = SessionLocal()
added = skipped = 0
try:
    for b in BANNERS:
        existing = db.query(Banner).filter(Banner.placement == b["placement"], Banner.is_active == True).count()  # noqa: E712
        if existing:
            skipped += 1
            print(f"[{b['placement']}] skip: already has {existing} active banner(s)")
            continue
        added += 1
        print(f"[{b['placement']}] {'add' if apply else 'would add'}: {b['title']}")
        if apply:
            db.add(Banner(link_url=None, display_order=0, is_active=True, **b))
    if apply:
        db.commit()
        # Public banner lists are cached for 24 hours (app/api/banners.py); clear them or the new
        # banners will not appear until the cache expires.
        from app.core.cache import cache
        cache.clear_prefix("banners:active")
        print("cleared the banner cache")
    else:
        db.rollback()
    print(f"\n{'APPLIED' if apply else 'DRY RUN (nothing written)'}: {added} to add, {skipped} skipped")
finally:
    db.close()
