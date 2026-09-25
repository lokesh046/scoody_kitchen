import logging
import math
import httpx

from app.core.config import settings
from app.core.cache import cache

logger = logging.getLogger(__name__)

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"

# ~1.1km grid cells at the equator (narrower east-west nearer the poles,
# which is fine — the goal is cache sharing between nearby users, not exact
# geometry). Matches geo.py's own "round coordinates for cache clustering"
# precedent (see reverse-geocode there, which rounds to 3 decimals for a
# tighter ~110m cell — 2 decimals is deliberately coarser here since
# multiple people searching "vets near me" from the same neighborhood is
# the common case this is optimizing for, not exact-location precision).
GRID_PRECISION = 2

# 24h matches geo.py's TTL for external coordinate-based API lookups — long
# enough that repeat searches in the same area over a day hit cache, short
# enough that a newly opened/closed clinic shows up within a day.
CACHE_TTL_SECONDS = 86400


def _grid_cache_key(latitude: float, longitude: float, radius_km: float) -> str:
    grid_lat = round(latitude, GRID_PRECISION)
    grid_lng = round(longitude, GRID_PRECISION)
    return f"vets:nearby:{grid_lat}:{grid_lng}:{radius_km}"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_r, lon1_r, lat2_r, lon2_r = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def search_nearby_vet_clinics(
    latitude: float,
    longitude: float,
    radius_km: float,
    max_results: int = 20,
) -> list[dict] | None:
    """
    Returns a list of {place_id, name, address, distance_km} dicts for
    real-world vet clinics near the given point, or None if the Places API
    call itself failed (network error, bad key, non-200) — distinct from an
    empty list, which means the call succeeded but found nothing. Callers
    should treat None as "try the registered-vets-only fallback", not as
    "zero clinics exist here".

    Cached for 24h under a coordinate-grid + radius key so nearby users
    searching the same area share one billed Places API call instead of
    each triggering their own.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not configured — skipping Places search.")
        return None

    cache_key = _grid_cache_key(latitude, longitude, radius_km)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    body = {
        "includedTypes": ["veterinary_care"],
        "maxResultCount": max_results,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius_km * 1000.0,
            }
        },
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        # List-view fields only (Basic SKU) — deliberately excludes rating,
        # phone, hours, and photos, which push a call into a pricier SKU.
        # Those are fetched separately, only for a clinic the user opens
        # (see get_place_details below).
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(PLACES_SEARCH_URL, json=body, headers=headers)
            if res.status_code != 200:
                logger.warning("Places API searchNearby returned %s: %s", res.status_code, res.text[:300])
                return None
            data = res.json()
    except Exception as e:
        logger.warning("Places API searchNearby call failed: %s", e)
        return None

    results = []
    for place in data.get("places", []):
        loc = place.get("location") or {}
        place_lat = loc.get("latitude")
        place_lng = loc.get("longitude")
        if place_lat is None or place_lng is None:
            continue
        results.append({
            "place_id": place.get("id"),
            "name": (place.get("displayName") or {}).get("text"),
            "address": place.get("formattedAddress"),
            "distance_km": round(_haversine_km(latitude, longitude, place_lat, place_lng), 2),
            "latitude": place_lat,
            "longitude": place_lng,
        })

    cache.set(cache_key, results, ttl_seconds=CACHE_TTL_SECONDS)
    return results


PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places"
DETAILS_CACHE_TTL_SECONDS = 86400


async def get_place_details(place_id: str) -> dict | None:
    """
    Fetches the richer fields (phone, opening hours) for one clinic, only
    called when a user actually opens it — this is the "lazy details" call,
    kept separate from search results specifically to avoid paying for
    these fields on every result in a list.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not configured — skipping Place Details lookup.")
        return None

    cache_key = f"vets:details:{place_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    headers = {
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,nationalPhoneNumber,regularOpeningHours,photos",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{PLACE_DETAILS_URL}/{place_id}", headers=headers)
            if res.status_code != 200:
                logger.warning("Places API Details returned %s for %s: %s", res.status_code, place_id, res.text[:300])
                return None
            data = res.json()
    except Exception as e:
        logger.warning("Places API Details call failed for %s: %s", place_id, e)
        return None

    opening_hours = data.get("regularOpeningHours") or {}
    photos = data.get("photos") or []
    result = {
        "place_id": data.get("id"),
        "name": (data.get("displayName") or {}).get("text"),
        "address": data.get("formattedAddress"),
        "phone": data.get("nationalPhoneNumber"),
        "opening_hours": opening_hours.get("weekdayDescriptions"),
        # Resource reference (e.g. "places/XYZ/photos/ABC"), not a URL — the
        # actual image bytes need a separate billed call (get_place_photo),
        # kept lazy so a photo is only fetched once a clinic card is opened.
        "photo_name": photos[0].get("name") if photos else None,
    }

    cache.set(cache_key, result, ttl_seconds=DETAILS_CACHE_TTL_SECONDS)
    return result


PLACE_PHOTO_BASE_URL = "https://places.googleapis.com/v1"


async def get_place_photo(photo_name: str, max_width_px: int = 480) -> tuple[bytes, str] | None:
    """
    Fetches the actual image bytes for a photo reference from Place Details.
    This is a THIRD, separately-billed Places API call (distinct from search
    and details) — kept server-side only so the API key is never exposed to
    the browser, per the same constraint as the other two calls.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not configured — skipping Place Photo fetch.")
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            res = await client.get(
                f"{PLACE_PHOTO_BASE_URL}/{photo_name}/media",
                params={"maxWidthPx": max_width_px, "key": settings.GOOGLE_PLACES_API_KEY},
            )
            if res.status_code != 200:
                logger.warning("Places API Photo media returned %s for %s", res.status_code, photo_name)
                return None
            return res.content, res.headers.get("content-type", "image/jpeg")
    except Exception as e:
        logger.warning("Places API Photo fetch failed for %s: %s", photo_name, e)
        return None
