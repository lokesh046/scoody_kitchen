from datetime import time
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import DayOfWeek
from app.schemas.doctor_availability import (
    BulkScheduleCreate,
    DoctorAvailabilityCreate,
    DoctorAvailabilityUpdate,
)


def _check_overlap(
    db: Session,
    doctor_id: int,
    day_of_week: DayOfWeek,
    start_time: time,
    end_time: time,
    exclude_id: int | None = None,
) -> bool:
    """
    Checks if a time window [start_time, end_time] overlaps with an existing window.
    Two windows [A_start, A_end] and [B_start, B_end] overlap if max(A_start, B_start) < min(A_end, B_end).
    Adjacent windows where A_end == B_start are permitted and do not count as overlaps.
    """
    query = select(DoctorAvailability).where(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.day_of_week == day_of_week,
        and_(
            DoctorAvailability.start_time < end_time,
            DoctorAvailability.end_time > start_time,
        ),
    )

    if exclude_id is not None:
        query = query.where(DoctorAvailability.id != exclude_id)

    existing = db.scalar(query)
    return existing is not None


def create_availability(
    db: Session,
    doctor_id: int,
    availability_data: DoctorAvailabilityCreate,
) -> DoctorAvailability:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise ValueError("Doctor profile not found")

    if availability_data.start_time >= availability_data.end_time:
        raise ValueError("start_time must be earlier than end_time")

    if _check_overlap(
        db=db,
        doctor_id=doctor_id,
        day_of_week=availability_data.day_of_week,
        start_time=availability_data.start_time,
        end_time=availability_data.end_time,
    ):
        raise ValueError("Availability window overlaps with an existing schedule for this day")

    record = DoctorAvailability(
        doctor_id=doctor_id,
        day_of_week=availability_data.day_of_week,
        start_time=availability_data.start_time,
        end_time=availability_data.end_time,
        is_available=availability_data.is_available,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_doctor_availabilities(
    db: Session,
    doctor_id: int,
    day_of_week: DayOfWeek | None = None,
    is_available_only: bool = False,
) -> list[DoctorAvailability]:
    query = select(DoctorAvailability).where(DoctorAvailability.doctor_id == doctor_id)

    if day_of_week is not None:
        query = query.where(DoctorAvailability.day_of_week == day_of_week)

    if is_available_only:
        query = query.where(DoctorAvailability.is_available.is_(True))

    query = query.order_by(
        DoctorAvailability.day_of_week,
        DoctorAvailability.start_time,
    )
    return list(db.scalars(query).all())


def get_availability_by_id(
    db: Session,
    availability_id: int,
) -> DoctorAvailability | None:
    return db.get(DoctorAvailability, availability_id)


def update_availability(
    db: Session,
    availability: DoctorAvailability,
    update_data: DoctorAvailabilityUpdate,
) -> DoctorAvailability:
    data_dict = update_data.model_dump(exclude_unset=True)

    new_start = data_dict.get("start_time", availability.start_time)
    new_end = data_dict.get("end_time", availability.end_time)

    if new_start >= new_end:
        raise ValueError("start_time must be earlier than end_time")

    if _check_overlap(
        db=db,
        doctor_id=availability.doctor_id,
        day_of_week=availability.day_of_week,
        start_time=new_start,
        end_time=new_end,
        exclude_id=availability.id,
    ):
        raise ValueError("Availability window overlaps with an existing schedule for this day")

    for key, value in data_dict.items():
        setattr(availability, key, value)

    db.commit()
    db.refresh(availability)
    return availability


def delete_availability(
    db: Session,
    availability: DoctorAvailability,
) -> None:
    db.delete(availability)
    db.commit()


def replace_doctor_schedule_bulk(
    db: Session,
    doctor_id: int,
    bulk_data: BulkScheduleCreate,
) -> list[DoctorAvailability]:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise ValueError("Doctor profile not found")

    try:
        # Delete existing schedule for this doctor within transaction
        existing_records = db.scalars(
            select(DoctorAvailability).where(DoctorAvailability.doctor_id == doctor_id)
        ).all()
        for rec in existing_records:
            db.delete(rec)

        db.flush()

        new_records = []
        for item in bulk_data.schedule:
            rec = DoctorAvailability(
                doctor_id=doctor_id,
                day_of_week=item.day_of_week,
                start_time=item.start_time,
                end_time=item.end_time,
                is_available=item.is_available,
            )
            db.add(rec)
            new_records.append(rec)

        db.commit()

        for rec in new_records:
            db.refresh(rec)

        return new_records

    except Exception:
        db.rollback()
        raise
