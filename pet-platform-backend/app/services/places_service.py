import asyncio
import base64
import logging
import math
import httpx

from app.core.config import settings
from app.core.cache import cache

# Google Places "includedTypes" per category. Pharmacy results come from
# Google only -- our own registered-doctor DB has no pharmacy concept, so
# callers skip that half of the merge for this category (see
# public_doctors.py).
PLACE_TYPE_BY_CATEGORY = {
    "clinic": "veterinary_care",
    "pharmacy": "pharmacy",
}

# Google has no distinct place TYPE for a pet/veterinary pharmacy -- its
# "pharmacy" type covers every drugstore (Apollo Pharmacy, generic chains),
# which is what Nearby Search returns if asked for plain "pharmacy". Text
# Search with an actual query string lets Google's own relevance ranking
# bias toward places whose name/category data mention pets, instead of
# surfacing the nearest human pharmacy. Clinic search stays on Nearby
# Search + includedTypes, which is accurate as-is (veterinary_care has no
# such ambiguity).
TEXT_QUERY_BY_CATEGORY = {
    "pharmacy": "pet pharmacy OR veterinary pharmacy OR animal pharmacy",
}

logger = logging.getLogger(__name__)

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

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


def _grid_cache_key(latitude: float, longitude: float, radius_km: float, category: str) -> str:
    grid_lat = round(latitude, GRID_PRECISION)
    grid_lng = round(longitude, GRID_PRECISION)
    # "v2" scopes this to the switch from generic includedTypes=pharmacy
    # Nearby Search to a pet-focused Text Search query -- without it, a
    # pharmacy search done just before this shipped would keep being
    # served its old (generic drugstore) cached result for up to 24h.
    cache_variant = f"{category}v2" if category in TEXT_QUERY_BY_CATEGORY else category
    return f"vets:nearby:{cache_variant}:{grid_lat}:{grid_lng}:{radius_km}"


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
    category: str = "clinic",
    max_results: int = 20,
) -> list[dict] | None:
    """
    Returns a list of {place_id, name, address, distance_km} dicts for
    real-world vet clinics (or pharmacies, per `category`) near the given
    point, or None if the Places API call itself failed (network error, bad
    key, non-200) — distinct from an empty list, which means the call
    succeeded but found nothing. Callers should treat None as "try the
    registered-vets-only fallback", not as "zero clinics exist here".

    Cached for 24h under a coordinate-grid + radius + category key so nearby
    users searching the same area share one billed Places API call instead
    of each triggering their own.
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not configured — skipping Places search.")
        return None

    cache_key = _grid_cache_key(latitude, longitude, radius_km, category)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    location_circle = {
        "center": {"latitude": latitude, "longitude": longitude},
        "radius": radius_km * 1000.0,
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

    type_body = {
        "includedTypes": [PLACE_TYPE_BY_CATEGORY.get(category, "veterinary_care")],
        "maxResultCount": max_results,
        "locationRestriction": {"circle": location_circle},
    }

    text_query = TEXT_QUERY_BY_CATEGORY.get(category)
    requests_to_run = [_run_places_request(PLACES_SEARCH_URL, type_body, headers)]
    if text_query:
        text_body = {
            "textQuery": text_query,
            "maxResultCount": max_results,
            # Restriction (hard filter), not bias, so these stay within the
            # radius the user actually picked, same as the type-based call.
            "locationRestriction": {"circle": location_circle},
        }
        requests_to_run.append(_run_places_request(PLACES_TEXT_SEARCH_URL, text_body, headers))

    responses = await asyncio.gather(*requests_to_run)

    # Both calls failing outright (not just "found nothing") is the only
    # case callers should treat as a Places API outage. If the pet-pharmacy
    # text search is the one that fails while the plain pharmacy type
    # search succeeds, that's not an outage -- still show what we have
    # rather than discarding real, successful results.
    if all(r is None for r in responses):
        return None

    # Merge: show every normal pharmacy/clinic, plus any pet-pharmacy-named
    # place the text search found that the type search missed (places don't
    # always carry Google's generic "pharmacy" type even when they sell pet
    # medication) -- deduped by place_id since the same place often appears
    # in both result sets.
    merged: dict[str, dict] = {}
    for data in responses:
        if data is None:
            continue
        for place in data.get("places", []):
            loc = place.get("location") or {}
            place_lat = loc.get("latitude")
            place_lng = loc.get("longitude")
            place_id = place.get("id")
            if place_lat is None or place_lng is None or not place_id or place_id in merged:
                continue
            merged[place_id] = {
                "place_id": place_id,
                "name": (place.get("displayName") or {}).get("text"),
                "address": place.get("formattedAddress"),
                "distance_km": round(_haversine_km(latitude, longitude, place_lat, place_lng), 2),
                "latitude": place_lat,
                "longitude": place_lng,
            }

    results = sorted(merged.values(), key=lambda r: r["distance_km"])[:max_results]

    cache.set(cache_key, results, ttl_seconds=CACHE_TTL_SECONDS)
    return results


async def _run_places_request(url: str, body: dict, headers: dict) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(url, json=body, headers=headers)
            if res.status_code != 200:
                logger.warning("Places API search returned %s: %s", res.status_code, res.text[:300])
                return None
            return res.json()
    except Exception as e:
        logger.warning("Places API search call failed: %s", e)
        return None


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


async def get_place_photo_reference(place_id: str) -> str | None:
    """
    Resolves just the photo reference (e.g. "places/XYZ/photos/ABC") for a
    place, with a field mask that deliberately excludes phone/opening-hours
    -- those are Enterprise-tier fields, and bundling them into this call
    would bill the pricier tier for every card's photo even though list
    cards don't need phone/hours at all (that richer call still happens,
    unchanged, only when a user opens the full detail view below).
    """
    if not settings.GOOGLE_PLACES_API_KEY:
        logger.warning("GOOGLE_PLACES_API_KEY not configured — skipping Place Details lookup.")
        return None

    cache_key = f"vets:photoref:{place_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached.get("photo_name")

    headers = {
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "id,photos",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{PLACE_DETAILS_URL}/{place_id}", headers=headers)
            if res.status_code != 200:
                logger.warning("Places API Details (photo ref) returned %s for %s: %s", res.status_code, place_id, res.text[:300])
                return None
            data = res.json()
    except Exception as e:
        logger.warning("Places API Details (photo ref) call failed for %s: %s", place_id, e)
        return None

    photos = data.get("photos") or []
    photo_name = photos[0].get("name") if photos else None
    cache.set(cache_key, {"photo_name": photo_name}, ttl_seconds=DETAILS_CACHE_TTL_SECONDS)
    return photo_name


PLACE_PHOTO_BASE_URL = "https://places.googleapis.com/v1"
PHOTO_CACHE_TTL_SECONDS = 86400


async def get_place_photo(photo_name: str, max_width_px: int = 480) -> tuple[bytes, str] | None:
    """
    Fetches the actual image bytes for a photo reference from Place Details.
    This is a THIRD, separately-billed Places API call (distinct from search
    and details) — kept server-side only so the API key is never exposed to
    the browser, per the same constraint as the other two calls.

    Cached for 24h by photo reference + requested width, same pattern as
    search/details above, so the same clinic's photo is only ever billed
    once across however many different users' cards render it that day.
    """
    cache_key = f"vets:photo:{photo_name}:{max_width_px}"
    cached = cache.get(cache_key)
    if cached is not None:
        return base64.b64decode(cached["data_b64"]), cached["content_type"]

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
            content_type = res.headers.get("content-type", "image/jpeg")
            cache.set(
                cache_key,
                {"data_b64": base64.b64encode(res.content).decode("ascii"), "content_type": content_type},
                ttl_seconds=PHOTO_CACHE_TTL_SECONDS,
            )
            return res.content, content_type
    except Exception as e:
        logger.warning("Places API Photo fetch failed for %s: %s", photo_name, e)
        return None
