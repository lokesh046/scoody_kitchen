from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.feature_flag import FeatureFlag

DEFAULT_FLAGS = [
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
