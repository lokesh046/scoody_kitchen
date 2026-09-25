from decimal import Decimal
from typing import Literal
from pydantic import BaseModel


class NearbyClinicResult(BaseModel):
    """
    One row in the merged "vets near me" list — either a vet already
    registered on the platform, or a real-world clinic from Google Places.
    Frontend distinguishes them via `source` (required, per the spec, to
    keep registered vets clearly separate from external listings).
    """
    source: Literal["registered", "google"]
    distance_km: float
    # Populated for both sources when known — used to build a "Directions"
    # link to Google Maps without needing another geocoding round trip.
    latitude: float | None = None
    longitude: float | None = None

    # Populated when source == "registered" — comes straight from our own
    # DB via get_nearby_doctors(), so it's already rich (rating, fee, etc.)
    doctor_id: int | None = None
    name: str | None = None
    specialization: str | None = None
    consultation_fee: Decimal | None = None
    profile_image_url: str | None = None
    average_rating: float | None = None
    review_count: int | None = None
    clinic_name: str | None = None
    address: str | None = None
    # Free to show for a registered vet (straight from our own Clinic row —
    # no extra API cost). Left None for a Google result on this list
    # response; those are only ever fetched lazily via place details.
    phone: str | None = None
    opening_hours: list[str] | None = None

    # Populated when source == "google" — only list-view fields (name,
    # address); phone/hours are fetched separately via the place details
    # endpoint only when the user opens this specific result.
    place_id: str | None = None


class NearbyClinicsResponse(BaseModel):
    results: list[NearbyClinicResult]
    # The radius actually used — may be larger than what was requested if
    # the initial preset came back empty and the search auto-escalated.
    radius_km_used: float
    # True if Google had nothing even at the largest preset (or the Places
    # API call failed) — frontend uses this to show the "book an online
    # consultation instead" prompt rather than a bare empty state.
    fallback_to_registered_only: bool


class PlaceDetailsResponse(BaseModel):
    place_id: str
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    opening_hours: list[str] | None = None
    # Relative path to our own photo-proxy endpoint (not a Google URL) —
    # None when Places has no photo for this clinic.
    photo_url: str | None = None
