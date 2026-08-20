import math
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from app.core.pagination import paginate_query

from app.models.clinic import Clinic
from app.schemas.clinic import ClinicCreate, ClinicUpdate


def create_clinic(db: Session, clinic_data: ClinicCreate) -> Clinic:
    clinic = Clinic(**clinic_data.model_dump())
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return clinic


def get_clinic(db: Session, clinic_id: int) -> Clinic | None:
    return db.get(Clinic, clinic_id)


def get_clinics_paginated(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    city: str | None = None,
    is_active_only: bool = True,
) -> dict:
    if page < 1:
        raise ValueError("Page number must be at least 1")
    if limit < 1 or limit > 100:
        raise ValueError("Limit must be between 1 and 100")

    query = select(Clinic)

    if is_active_only:
        query = query.where(Clinic.is_active.is_(True))

    if city:
        query = query.where(func.lower(Clinic.city) == city.strip().lower())

    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Clinic.name.ilike(search_pattern),
                Clinic.address.ilike(search_pattern),
                Clinic.city.ilike(search_pattern),
                Clinic.description.ilike(search_pattern),
            )
        )

    query = query.order_by(Clinic.id.desc())
    return paginate_query(db, query, page=page, limit=limit)


def update_clinic(db: Session, clinic: Clinic, clinic_data: ClinicUpdate) -> Clinic:
    update_dict = clinic_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(clinic, key, value)

    db.commit()
    db.refresh(clinic)
    return clinic


def deactivate_clinic(db: Session, clinic: Clinic) -> Clinic:
    clinic.is_active = False
    db.commit()
    db.refresh(clinic)
    return clinic
