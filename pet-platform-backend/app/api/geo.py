from fastapi import APIRouter, Request
import httpx
import logging

from app.core.cache import cache

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/geo",
    tags=["Geolocation"],
)

DEFAULT_LOCATION = {
    "latitude": 13.0827,
    "longitude": 80.2707,
    "city": "Chennai",
    "country": "India",
    "countryCode": "in",
    "is_fallback": True,
}


def is_local_or_private_ip(ip: str) -> bool:
    if not ip or ip in ("127.0.0.1", "localhost", "::1", "testclient"):
        return True
    if ip.startswith("10.") or ip.startswith("192.168."):
        return True
    if ip.startswith("172."):
        parts = ip.split(".")
        if len(parts) >= 2 and parts[1].isdigit() and 16 <= int(parts[1]) <= 31:
            return True
    return False


@router.get("/ip-locate")
async def ip_locate(request: Request):
    """
    Server-side IP Geolocation endpoint with 24-hour Redis caching.
    Extracts the client's public IP address from proxy headers (Cloudflare, Nginx, ALB)
    and resolves geographic coordinates server-side to prevent ad-blocker issues and CORS errors.
    """
    client_ip = ""

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    elif request.headers.get("cf-connecting-ip"):
        client_ip = request.headers.get("cf-connecting-ip", "").strip()
    elif request.client and request.client.host:
        client_ip = request.client.host.strip()

    # Local development or private network IP
    if is_local_or_private_ip(client_ip):
        return {
            **DEFAULT_LOCATION,
            "ip": client_ip or "127.0.0.1",
            "message": "Local development network detected. Using headquarters default.",
        }

    cache_key = f"geo:ip:{client_ip}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Query external service securely from server
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(f"https://freeipapi.com/api/json/{client_ip}")
            if res.status_code == 200:
                data = res.json()
                lat = data.get("latitude")
                lon = data.get("longitude")
                if lat is not None and lon is not None:
                    result = {
                        "latitude": float(lat),
                        "longitude": float(lon),
                        "city": data.get("cityName") or data.get("city") or DEFAULT_LOCATION["city"],
                        "country": data.get("countryName") or data.get("country") or DEFAULT_LOCATION["country"],
                        "countryCode": (data.get("countryCode") or "in").lower(),
                        "ip": client_ip,
                        "is_fallback": False,
                    }
                    cache.set(cache_key, result, ttl_seconds=86400)
                    return result
    except Exception as e:
        logger.warning("Server-side IP geolocation lookup failed for %s: %s", client_ip, e)

    return {
        **DEFAULT_LOCATION,
        "ip": client_ip,
        "message": "Lookup service unavailable. Using headquarters default.",
    }


@router.get("/reverse")
async def reverse_geocode(lat: float, lon: float):
    """
    Reverse geocoding with Redis coordinate clustering cache.
    Coordinates rounded to 3 decimal places (~110m precision) share the exact same cached address.
    """
    rounded_lat = round(lat, 3)
    rounded_lon = round(lon, 3)
    cache_key = f"geo:rev:{rounded_lat}:{rounded_lon}"

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": "ScoobyPetsPlatform/1.0 (support@scoobypets.com)"},
            )
            if res.status_code == 200:
                data = res.json()
                cache.set(cache_key, data, ttl_seconds=604800)  # 7-day TTL
                return data
    except Exception as e:
        logger.warning("Reverse geocoding error for (%s, %s): %s", lat, lon, e)

    return {"error": "Unable to resolve coordinates", "lat": lat, "lon": lon}


@router.get("/pincode")
async def pincode_lookup(code: str):
    """
    Pincode search with Redis caching.
    """
    clean_code = code.strip().upper()
    cache_key = f"geo:pin:{clean_code}"

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"postalcode": clean_code, "format": "json", "limit": 1},
                headers={"User-Agent": "ScoobyPetsPlatform/1.0 (support@scoobypets.com)"},
            )
            if res.status_code == 200:
                data = res.json()
                cache.set(cache_key, data, ttl_seconds=604800)  # 7-day TTL
                return data
    except Exception as e:
        logger.warning("Pincode lookup error for %s: %s", clean_code, e)

    return []
