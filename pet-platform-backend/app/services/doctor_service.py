import math
from decimal import Decimal
from sqlalchemy import select, func, or_, and_, Float
from sqlalchemy.orm import Session, joinedload

from app.core.pagination import paginate_query

from app.models.doctor import Doctor
from app.models.clinic import Clinic
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.doctor import DoctorCreate, DoctorUpdateAdmin, DoctorUpdateSelf


def create_doctor(db: Session, doctor_data: DoctorCreate) -> Doctor:
    user = db.get(User, doctor_data.user_id)
    if user is None:
        raise ValueError("User not found")

    if user.role != UserRole.DOCTOR:
        user.role = UserRole.DOCTOR
        db.add(user)

    existing_profile = db.scalar(
        select(Doctor).where(Doctor.user_id == doctor_data.user_id)
    )
    if existing_profile is not None:
        raise ValueError("Doctor profile already exists for this user")

    existing_license = db.scalar(
        select(Doctor).where(Doctor.license_number == doctor_data.license_number)
    )
    if existing_license is not None:
        raise ValueError("License number is already registered")

    if doctor_data.clinic_id is not None:
        clinic = db.get(Clinic, doctor_data.clinic_id)
        if clinic is None:
            raise ValueError("Clinic not found")

    doctor = Doctor(**doctor_data.model_dump())
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    return get_doctor(db, doctor.id) or doctor


def get_doctor(db: Session, doctor_id: int) -> Doctor | None:
    statement = (
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.clinic)
        )
        .where(Doctor.id == doctor_id)
    )
    return db.scalar(statement)


def get_doctor_by_user_id(db: Session, user_id: int) -> Doctor | None:
    statement = (
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.clinic)
        )
        .where(Doctor.user_id == user_id)
    )
    return db.scalar(statement)


def get_doctors_paginated(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    specialization: str | None = None,
    clinic_id: int | None = None,
    city: str | None = None,
    is_available: bool | None = None,
    is_verified_only: bool = True,
    is_active_only: bool = True,
) -> dict:
    if page < 1:
        raise ValueError("Page number must be at least 1")
    if limit < 1 or limit > 100:
        raise ValueError("Limit must be between 1 and 100")

    query = (
        select(Doctor)
        .outerjoin(Doctor.user)
        .outerjoin(Doctor.clinic)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.clinic)
        )
    )

    if is_active_only:
        query = query.where(Doctor.is_active.is_(True))

    if is_verified_only:
        query = query.where(Doctor.is_verified.is_(True))

    if is_available is not None:
        query = query.where(Doctor.is_available.is_(is_available))

    if clinic_id is not None:
        query = query.where(Doctor.clinic_id == clinic_id)

    if specialization and specialization.strip():
        query = query.where(Doctor.specialization.ilike(f"%{specialization.strip()}%"))

    if city and city.strip():
        query = query.where(func.lower(Clinic.city) == city.strip().lower())

    if search and search.strip():
        search_str = search.strip()
        search_pattern = f"%{search_str}%"
        doc_tsvector = func.to_tsvector(
            "english",
            func.coalesce(Doctor.specialization, "")
            + " "
            + func.coalesce(Doctor.qualification, "")
            + " "
            + func.coalesce(Doctor.bio, "")
        )
        doc_tsquery = func.plainto_tsquery("english", search_str)

        query = query.where(
            or_(
                doc_tsvector.op("@@")(doc_tsquery),
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern),
                Doctor.specialization.ilike(search_pattern),
                Doctor.qualification.ilike(search_pattern),
                Doctor.bio.ilike(search_pattern),
                Clinic.name.ilike(search_pattern),
                Clinic.city.ilike(search_pattern),
            )
        )

    query = query.order_by(Doctor.id.desc())
    return paginate_query(db, query, page=page, limit=limit)


def update_doctor(
    db: Session,
    doctor: Doctor,
    update_data: DoctorUpdateAdmin | DoctorUpdateSelf,
) -> Doctor:
    data_dict = update_data.model_dump(exclude_unset=True)

    if "license_number" in data_dict and data_dict["license_number"] != doctor.license_number:
        existing = db.scalar(
            select(Doctor).where(Doctor.license_number == data_dict["license_number"])
        )
        if existing is not None and existing.id != doctor.id:
            raise ValueError("License number is already registered")

    if "clinic_id" in data_dict and data_dict["clinic_id"] is not None:
        clinic = db.get(Clinic, data_dict["clinic_id"])
        if clinic is None:
            raise ValueError("Clinic not found")

    for key, value in data_dict.items():
        setattr(doctor, key, value)

    db.commit()
    db.refresh(doctor)
    return get_doctor(db, doctor.id) or doctor


def verify_doctor(db: Session, doctor: Doctor, is_verified: bool) -> Doctor:
    doctor.is_verified = is_verified
    db.commit()
    db.refresh(doctor)
    return get_doctor(db, doctor.id) or doctor


def deactivate_doctor(db: Session, doctor: Doctor) -> Doctor:
    doctor.is_active = False
    db.commit()
    db.refresh(doctor)
    return get_doctor(db, doctor.id) or doctor


def get_nearby_doctors(
    db: Session,
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    limit: int = 20,
) -> list[dict]:
    if latitude < -90.0 or latitude > 90.0:
        raise ValueError("Latitude must be between -90 and 90")
    if longitude < -180.0 or longitude > 180.0:
        raise ValueError("Longitude must be between -180 and 180")
    if radius_km <= 0 or radius_km > 500.0:
        raise ValueError("Radius must be between 0.1 and 500 km")

    lat_rad = math.radians(latitude)
    lon_rad = math.radians(longitude)

    # Use coalesce to prefer doctor coordinates if specified, else clinic coordinates
    effective_lat = func.coalesce(Doctor.latitude, Clinic.latitude)
    effective_lon = func.coalesce(Doctor.longitude, Clinic.longitude)

    # Haversine distance formula in kilometers
    dlat = func.radians(effective_lat - latitude)
    dlon = func.radians(effective_lon - longitude)

    a = (
        func.pow(func.sin(dlat / 2.0), 2)
        + func.cos(lat_rad)
        * func.cos(func.radians(effective_lat))
        * func.pow(func.sin(dlon / 2.0), 2)
    )

    c = 2.0 * func.atan2(func.sqrt(a), func.sqrt(1.0 - a))
    distance_expr = (6371.0 * c).label("distance_km")

    statement = (
        select(Doctor, distance_expr)
        .outerjoin(Doctor.clinic)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.clinic)
        )
        .where(
            Doctor.is_active.is_(True),
            Doctor.is_verified.is_(True),
            effective_lat.isnot(None),
            effective_lon.isnot(None),
            (6371.0 * c) <= radius_km,
        )
        .order_by(distance_expr)
        .limit(limit)
    )

    results = db.execute(statement).all()

    nearby_list = []
    for doc, dist in results:
        doc_name = f"{doc.user.first_name} {doc.user.last_name}".strip() if doc.user else None
        nearby_list.append({
            "doctor": doc,
            "name": doc_name,
            "distance_km": round(float(dist), 2),
        })

    return nearby_list
