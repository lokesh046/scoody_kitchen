from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.feature_flag import FeatureFlag
from app.core.cache import cache

# The public flag map is cached under this key (api/feature_flags.py) and cleared whenever an
# admin toggles a flag, so reading it here costs no database query unless the cache is empty.
PUBLIC_FLAGS_CACHE_KEY = "feature_flags:public"
# A day: the admin toggle clears this key, so a change still shows at once. A short lifetime
# made the scheduler job reload the flags from the database every hour, waking the compute.
PUBLIC_FLAGS_TTL_SECONDS = 86400

DEFAULT_FLAGS = [
    {
        "key": "home_recipe_coming_soon",
        "name": "Homepage Coming Soon Recipe Card",
        "description": "Adds a black ribbon with gold Coming soon text over the existing homepage Signature Recipes cards, keeping the recipes visible and ordering disabled. Turn off to restore their normal appearance and actions.",
        "category": "home",
        "is_enabled": False,
    },
    {
        "key": "consultations_suggest_alternative_doctors",
        "name": "Alternative Doctor Recommendations",
        "description": "Automatically recommends alternative verified specialists in the area when the selected doctor has no available time slots on the chosen date.",
        "category": "consultations",
        "is_enabled": True,
    },
    {
        "key": "consultations_booking",
        "name": "Online Consultation Booking",
        "description": "Allows pet parents to schedule and pay for telehealth veterinary consultations online.",
        "category": "consultations",
        "is_enabled": True,
    },
    {
        "key": "consultations_gps_locator",
        "name": "GPS Clinic Locator Tool",
        "description": "Enables GPS and IP detection to find nearby veterinary clinics and practitioners.",
        "category": "consultations",
        "is_enabled": True,
    },
    {
        "key": "consultations_reviews",
        "name": "Doctor Ratings & Reviews",
        "description": "Allows verified pet parents to rate and submit post-consultation reviews for veterinarians.",
        "category": "consultations",
        "is_enabled": True,
    },
    {
        "key": "pets_photo_upload",
        "name": "Pet Photo Upload & Camera Snap",
        "description": "Allows pet parents to upload or capture real photos of their companions during registration and profile updates.",
        "category": "pets",
        "is_enabled": True,
    },
    {
        "key": "shop_checkout",
        "name": "Online Meal Cart & Checkout",
        "description": "Allows customers to add items to cart and complete online purchases through Razorpay.",
        "category": "shop",
        "is_enabled": True,
    },
    {
        "key": "shop_subscriptions",
        "name": "Recurring Meal Subscriptions",
        "description": "Enables recurring weekly and monthly customized meal plan subscriptions.",
        "category": "shop",
        "is_enabled": True,
    },
    {
        "key": "ai_chatbot",
        "name": "AI Canine Health Assistant",
        "description": "Enables the floating AI nutrition and symptom advice chatbot across the store.",
        "category": "ai",
        "is_enabled": True,
    },
    {
        "key": "ai_pet_vision",
        "name": "AI Pet Vision Scanner",
        "description": "Enables the camera health and breed visual inspection service (port 8003).",
        "category": "ai",
        "is_enabled": True,
    },
    {
        "key": "shop_meal_planner",
        "name": "Customized Canine Meal Planner",
        "description": "Enables the interactive pet meal planning quiz and personalized diet recommendation tool.",
        "category": "shop",
        "is_enabled": True,
    },
    {
        "key": "pets_know_your_pet",
        "name": "Know Your Pet & Health Passport",
        "description": "Enables pet profiles, breed encyclopedias, vaccination calendars, and health passports.",
        "category": "pets",
        "is_enabled": True,
    },
    {
        "key": "home_fullscreen_hero",
        "name": "Full-Screen Homepage Hero",
        "description": "Switches the homepage hero banner to a full-viewport-height layout with the navigation header overlaid on top, instead of the normal contained carousel below a solid header.",
        "category": "home",
        "is_enabled": False,
    },
]

def seed_default_flags_if_missing(db: Session) -> None:
    """Ensure all standard platform feature flags exist in database."""
    existing_keys = {f.key for f in db.query(FeatureFlag.key).all()}
    added = False
    for item in DEFAULT_FLAGS:
        if item["key"] not in existing_keys:
            flag = FeatureFlag(
                key=item["key"],
                name=item["name"],
                description=item["description"],
                category=item["category"],
                is_enabled=item["is_enabled"],
                updated_at=datetime.utcnow(),
            )
            db.add(flag)
            added = True
    if added:
        db.commit()

def get_public_flags(db: Session) -> Dict[str, Dict[str, object]]:
    """
    Return {feature_key: {enabled, fallback_behavior}} for frontend clients.
    Enriched from a plain {key: bool} shape so clients can render a
    "coming soon" or "temporarily unavailable" placeholder instead of just
    hiding a disabled feature, while still reading `.enabled` for the
    common case that doesn't care about the fallback.
    """
    seed_default_flags_if_missing(db)
    flags = db.query(FeatureFlag).all()
    return {f.key: {"enabled": f.is_enabled, "fallback_behavior": f.fallback_behavior} for f in flags}

def is_feature_enabled(key: str, default: bool = True) -> bool:
    """Whether a feature is switched on, for background jobs that must stand down when it is off.

    Reads the cached public flag map; only when that cache is empty does it query the database
    (and refills the cache for an hour). Any failure returns `default`, so a flag problem never
    stops work that should run.
    """
    flags = cache.get(PUBLIC_FLAGS_CACHE_KEY)
    if flags is None:
        try:
            from app.core.database import SessionLocal
            db = SessionLocal()
            try:
                flags = get_public_flags(db)
            finally:
                db.close()
            cache.set(PUBLIC_FLAGS_CACHE_KEY, flags, ttl_seconds=PUBLIC_FLAGS_TTL_SECONDS)
        except Exception:
            return default
    state = flags.get(key)
    if state is None:
        return default
    return bool(state.get("enabled", default))


def get_all_flags_admin(db: Session) -> List[FeatureFlag]:
    """Return all feature flags with complete metadata for Admin Dashboard."""
    seed_default_flags_if_missing(db)
    return db.query(FeatureFlag).order_by(FeatureFlag.category, FeatureFlag.id).all()

def update_feature_flag(
    db: Session,
    key: str,
    is_enabled: bool,
    fallback_behavior: Optional[str] = None,
    admin_id: Optional[int] = None,
) -> Optional[FeatureFlag]:
    """Toggle a feature flag on or off, and optionally set its disabled-state
    fallback (hide / coming_soon / unavailable). Updates timestamp and
    auditing admin id."""
    seed_default_flags_if_missing(db)
    flag = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not flag:
        return None
    flag.is_enabled = is_enabled
    if fallback_behavior is not None:
        flag.fallback_behavior = fallback_behavior
    flag.updated_at = datetime.utcnow()
    if admin_id:
        flag.updated_by_id = admin_id
    db.commit()
    db.refresh(flag)
    return flag
