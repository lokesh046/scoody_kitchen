from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.doctor import DoctorResponse, DoctorPublicResponse, NearbyDoctorResponse, PaginatedDoctorResponse, PaginatedDoctorPublicResponse
from app.schemas.vet_clinic import NearbyClinicResult, NearbyClinicsResponse, PlaceDetailsResponse
from app.services.doctor_service import (
    get_doctor,
    get_doctors_paginated,
    get_nearby_doctors,
)
from app.services.places_service import search_nearby_vet_clinics, get_place_details, get_place_photo
from app.schemas.doctor_availability import DoctorSchedulePublicResponse
from app.services.doctor_availability_service import get_doctor_availabilities

# Server-controlled presets, per the plan's cost-control requirement —
# arbitrary radius values are rejected below rather than accepted as-is,
# so a client can't drive up Places API cost with unbounded radii.
NEARBY_CLINIC_RADIUS_PRESETS_KM = [2.0, 5.0, 10.0]



router = APIRouter(
    prefix="/doctors",
    tags=["Doctor Discovery"]
)


@router.get(
    "",
    response_model=PaginatedDoctorPublicResponse,
)
def list_public_doctors(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    specialization: str | None = None,
    clinic_id: int | None = None,
    city: str | None = None,
    is_available: bool | None = None,
    db: Session = Depends(get_db),
):
    try:
        return get_doctors_paginated(
            db=db,
            page=page,
            limit=limit,
            search=search,
            specialization=specialization,
            clinic_id=clinic_id,
            city=city,
            is_available=is_available,
            is_verified_only=True,
            is_active_only=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/nearby",
    response_model=list[NearbyDoctorResponse],
)
def search_nearby_doctors(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(default=10.0, gt=0.0, le=500.0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        results = get_nearby_doctors(
            db=db,
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            limit=limit,
        )
        output = []
        for item in results:
            doc = item["doctor"]
            output.append({
                "id": doc.id,
                "user_id": doc.user_id,
                "name": item["name"],
                "specialization": doc.specialization,
                "qualification": doc.qualification,
                "experience_years": doc.experience_years,
                "consultation_fee": doc.consultation_fee,
                "bio": doc.bio,
                "profile_image_url": doc.profile_image_url,
                "is_available": doc.is_available,
                "is_verified": doc.is_verified,
                "distance_km": item["distance_km"],
                "clinic": doc.clinic,
            })
        return output
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _format_registered_result(item: dict) -> NearbyClinicResult:
    doc = item["doctor"]
    return NearbyClinicResult(
        source="registered",
        distance_km=round(item["distance_km"], 2),
        latitude=float(doc.clinic.latitude) if doc.clinic and doc.clinic.latitude is not None else None,
        longitude=float(doc.clinic.longitude) if doc.clinic and doc.clinic.longitude is not None else None,
        doctor_id=doc.id,
        name=item["name"],
        specialization=doc.specialization,
        consultation_fee=doc.consultation_fee,
        profile_image_url=doc.profile_image_url,
        average_rating=getattr(doc, "average_rating", None),
        review_count=getattr(doc, "review_count", None),
        clinic_name=doc.clinic.name if doc.clinic else None,
        address=doc.clinic.address if doc.clinic else None,
        phone=doc.clinic.phone if doc.clinic else None,
        opening_hours=[doc.clinic.opening_hours] if doc.clinic and doc.clinic.opening_hours else None,
    )


def _format_google_result(place: dict) -> NearbyClinicResult:
    return NearbyClinicResult(
        source="google",
        distance_km=place["distance_km"],
        latitude=place.get("latitude"),
        longitude=place.get("longitude"),
        name=place.get("name"),
        address=place.get("address"),
        place_id=place.get("place_id"),
    )


@router.get(
    "/nearby-clinics",
    response_model=NearbyClinicsResponse,
)
@limiter.limit("30/minute")
async def search_nearby_clinics(
    request: Request,
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(default=5.0),
    db: Session = Depends(get_db),
):
    """
    Merges vets already registered on the platform with real-world clinics
    from Google Places, clearly tagged by source. If the requested radius
    comes back with zero Google results, automatically retries the next
    larger preset; if even the largest preset is empty (or Places itself is
    unreachable), falls back to registered-vets-only and tells the frontend
    via `fallback_to_registered_only` so it can prompt an online
    consultation instead of showing a dead-end empty list.
    """
    if radius_km not in NEARBY_CLINIC_RADIUS_PRESETS_KM:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"radius_km must be one of {NEARBY_CLINIC_RADIUS_PRESETS_KM}",
        )

    try:
        registered_raw = get_nearby_doctors(
            db=db, latitude=latitude, longitude=longitude, radius_km=radius_km, limit=20,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    registered_results = [_format_registered_result(item) for item in registered_raw]

    google_results: list[NearbyClinicResult] = []
    used_radius = radius_km
    places_unavailable = False

    for preset in [r for r in NEARBY_CLINIC_RADIUS_PRESETS_KM if r >= radius_km]:
        used_radius = preset
        places = await search_nearby_vet_clinics(latitude, longitude, preset)
        if places is None:
            places_unavailable = True
            break
        if places:
            google_results = [_format_google_result(p) for p in places]
            break
        # Empty (not None) — Places call succeeded but found nothing at
        # this radius, so loop continues to the next larger preset.

    fallback_to_registered_only = places_unavailable or not google_results

    combined = sorted(registered_results + google_results, key=lambda r: r.distance_km)

    return NearbyClinicsResponse(
        results=combined,
        radius_km_used=used_radius,
        fallback_to_registered_only=fallback_to_registered_only,
    )


@router.get(
    "/nearby-clinics/{place_id}",
    response_model=PlaceDetailsResponse,
)
@limiter.limit("30/minute")
async def get_nearby_clinic_details(request: Request, place_id: str):
    """Lazy details for one Google-sourced clinic — phone + opening hours,
    fetched only when a user opens this specific result, not for every row
    in the search list (see places_service.py's cost-control comments)."""
    details = await get_place_details(place_id)
    if details is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic details not found.")
    details["photo_url"] = f"/doctors/nearby-clinics/{place_id}/photo" if details.get("photo_name") else None
    return details


@router.get("/nearby-clinics/{place_id}/photo")
@limiter.limit("30/minute")
async def get_nearby_clinic_photo(
    request: Request,
    place_id: str,
    max_width_px: int = Query(default=480, ge=100, le=1600),
):
    """
    Proxies the clinic's photo bytes from Google Places — never exposes the
    API key to the browser, and is only ever called lazily (an <img> tag
    inside an already-expanded clinic card), matching the same lazy pattern
    as the details endpoint above.
    """
    details = await get_place_details(place_id)
    photo_name = details.get("photo_name") if details else None
    if not photo_name:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo available for this clinic.")

    result = await get_place_photo(photo_name, max_width_px)
    if result is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch clinic photo.")

    photo_bytes, content_type = result
    return Response(
        content=photo_bytes,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get(
    "/{doctor_id}",
    response_model=DoctorPublicResponse,
)
def get_public_doctor_detail(
    doctor_id: int,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
    return doctor




@router.get(
    "/{doctor_id}/availability",
    response_model=DoctorSchedulePublicResponse,
)
def get_public_doctor_schedule(
    doctor_id: int,
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    availabilities = get_doctor_availabilities(db, doctor_id, is_available_only=True)
    return {
        "doctor_id": doctor.id,
        "is_accepting_consultations": doctor.is_available,
        "schedule": availabilities,
    }


from datetime import date
from app.schemas.consultation import DoctorSlotsResponse
from app.services.consultation_service import get_available_slots


@router.get(
    "/{doctor_id}/slots",
    response_model=DoctorSlotsResponse,
)
def get_public_doctor_slots(
    doctor_id: int,
    date_param: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
):
    try:
        slots = get_available_slots(
            db=db,
            doctor_id=doctor_id,
            target_date=date_param,
        )
        return {
            "doctor_id": doctor_id,
            "date": date_param.isoformat(),
            "duration_minutes": 30,
            "slots": slots,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
