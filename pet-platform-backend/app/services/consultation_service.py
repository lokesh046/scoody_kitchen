from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import select, and_
from sqlalchemy.orm import Session, joinedload

from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import DayOfWeek, ConsultationStatus, UserRole
from app.models.pet import Pet
from app.schemas.consultation import ConsultationCreate


# State Machine Transition Rules
VALID_CONSULTATION_TRANSITIONS: dict[ConsultationStatus, set[ConsultationStatus]] = {
    ConsultationStatus.PENDING: {ConsultationStatus.CONFIRMED, ConsultationStatus.CANCELLED},
    ConsultationStatus.CONFIRMED: {ConsultationStatus.IN_PROGRESS, ConsultationStatus.CANCELLED},
    ConsultationStatus.IN_PROGRESS: {ConsultationStatus.COMPLETED},
    ConsultationStatus.COMPLETED: set(),
    ConsultationStatus.CANCELLED: set(),
}

WEEKDAY_TO_DAY_OF_WEEK: dict[int, DayOfWeek] = {
    0: DayOfWeek.MONDAY,
    1: DayOfWeek.TUESDAY,
    2: DayOfWeek.WEDNESDAY,
    3: DayOfWeek.THURSDAY,
    4: DayOfWeek.FRIDAY,
    5: DayOfWeek.SATURDAY,
    6: DayOfWeek.SUNDAY,
}


def validate_consultation_transition(
    current_status: ConsultationStatus,
    new_status: ConsultationStatus,
) -> None:
    allowed = VALID_CONSULTATION_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Invalid consultation status transition from '{current_status.value}' to '{new_status.value}'"
        )


def _is_time_in_window(requested_start: time, requested_end: time, avail_start: time, avail_end: time) -> bool:
    return requested_start >= avail_start and requested_end <= avail_end


def get_available_slots(
    db: Session,
    doctor_id: int,
    target_date: date,
    duration_minutes: int = 30,
) -> list[str]:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise ValueError("Doctor not found or not active/verified")

    # Determine day of week
    day_enum = WEEKDAY_TO_DAY_OF_WEEK[target_date.weekday()]

    # Fetch active doctor availability windows for target_date
    availabilities = db.scalars(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_enum,
            DoctorAvailability.is_available.is_(True),
        ).order_by(DoctorAvailability.start_time)
    ).all()

    if not availabilities:
        return []

    # Fetch existing active consultations for that doctor on target_date
    day_start_dt = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    day_end_dt = datetime.combine(target_date, time.max, tzinfo=timezone.utc)

    existing_consultations = db.scalars(
        select(Consultation).where(
            Consultation.doctor_id == doctor_id,
            Consultation.status != ConsultationStatus.CANCELLED,
            Consultation.scheduled_at >= day_start_dt,
            Consultation.scheduled_at <= day_end_dt,
        )
    ).all()

    # Calculate booked time ranges
    booked_ranges: list[tuple[datetime, datetime]] = []
    for c in existing_consultations:
        c_end = c.scheduled_at + timedelta(minutes=c.duration_minutes)
        booked_ranges.append((c.scheduled_at, c_end))

    # Generate valid slots
    available_slots: list[str] = []

    for window in availabilities:
        curr_dt = datetime.combine(target_date, window.start_time, tzinfo=timezone.utc)
        window_end_dt = datetime.combine(target_date, window.end_time, tzinfo=timezone.utc)

        slot_delta = timedelta(minutes=duration_minutes)

        while curr_dt + slot_delta <= window_end_dt:
            slot_end_dt = curr_dt + slot_delta

            # Check overlap with booked consultations
            is_booked = False
            for b_start, b_end in booked_ranges:
                if max(curr_dt, b_start) < min(slot_end_dt, b_end):
                    is_booked = True
                    break

            if not is_booked:
                available_slots.append(curr_dt.strftime("%H:%M"))

            curr_dt += slot_delta

    return available_slots


def create_consultation(
    db: Session,
    customer_id: int,
    create_data: ConsultationCreate,
) -> Consultation:
    # 1. Verify pet ownership
    pet = db.get(Pet, create_data.pet_id)
    if pet is None or pet.user_id != customer_id:
        raise KeyError("Pet not found")

    # 2. Pessimistically lock doctor row for double-booking protection
    doctor = db.scalar(
        select(Doctor).where(Doctor.id == create_data.doctor_id).with_for_update()
    )
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise ValueError("Doctor not found or not active/verified")

    if not doctor.is_available:
        raise ValueError("Doctor is currently not accepting consultations")

    # 3. Validate scheduled_at is in the future
    now_utc = datetime.now(timezone.utc)
    requested_start_dt = create_data.scheduled_at
    if requested_start_dt.tzinfo is None:
        requested_start_dt = requested_start_dt.replace(tzinfo=timezone.utc)
    else:
        requested_start_dt = requested_start_dt.astimezone(timezone.utc)

    if requested_start_dt <= now_utc:
        raise ValueError("Scheduled time must be in the future")

    duration = 30
    requested_end_dt = requested_start_dt + timedelta(minutes=duration)

    # 4. Validate doctor availability for day of week & window
    day_enum = WEEKDAY_TO_DAY_OF_WEEK[requested_start_dt.weekday()]
    req_start_time = requested_start_dt.time()
    req_end_time = requested_end_dt.time()

    availabilities = db.scalars(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor.id,
            DoctorAvailability.day_of_week == day_enum,
            DoctorAvailability.is_available.is_(True),
        )
    ).all()

    has_window = False
    for avail in availabilities:
        if _is_time_in_window(req_start_time, req_end_time, avail.start_time, avail.end_time):
            has_window = True
            break

    if not has_window:
        raise ValueError("Requested time slot falls outside doctor's working schedule")

    # 5. Check overlapping existing consultations
    overlapping = db.scalar(
        select(Consultation).where(
            Consultation.doctor_id == doctor.id,
            Consultation.status != ConsultationStatus.CANCELLED,
            and_(
                Consultation.scheduled_at < requested_end_dt,
                (Consultation.scheduled_at + timedelta(minutes=duration)) > requested_start_dt,
            ),
        )
    )

    if overlapping is not None:
        raise MemoryError("Requested slot is already booked")

    # 6. Create consultation
    consultation = Consultation(
        customer_id=customer_id,
        pet_id=create_data.pet_id,
        doctor_id=create_data.doctor_id,
        scheduled_at=requested_start_dt,
        duration_minutes=duration,
        status=ConsultationStatus.PENDING,
        reason=create_data.reason,
        customer_notes=create_data.customer_notes,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    return consultation


def get_consultation_by_id(
    db: Session,
    consultation_id: int,
) -> Consultation | None:
    query = (
        select(Consultation)
        .options(
            joinedload(Consultation.pet),
            joinedload(Consultation.doctor),
        )
        .where(Consultation.id == consultation_id)
    )
    return db.scalar(query)


from app.core.pagination import paginate_query


def get_customer_consultations(
    db: Session,
    customer_id: int,
    page: int = 1,
    limit: int = 20,
    status_filter: ConsultationStatus | None = None,
) -> dict:
    query = (
        select(Consultation)
        .options(
            joinedload(Consultation.pet),
            joinedload(Consultation.doctor),
        )
        .where(Consultation.customer_id == customer_id)
    )

    if status_filter is not None:
        query = query.where(Consultation.status == status_filter)

    query = query.order_by(Consultation.created_at.desc())
    return paginate_query(db, query, page=page, limit=limit)


def get_doctor_consultations(
    db: Session,
    doctor_id: int,
    page: int = 1,
    limit: int = 20,
    status_filter: ConsultationStatus | None = None,
) -> dict:
    query = (
        select(Consultation)
        .options(
            joinedload(Consultation.pet),
            joinedload(Consultation.doctor),
        )
        .where(Consultation.doctor_id == doctor_id)
    )

    if status_filter is not None:
        query = query.where(Consultation.status == status_filter)

    query = query.order_by(Consultation.created_at.desc())
    return paginate_query(db, query, page=page, limit=limit)


def update_consultation_status(
    db: Session,
    consultation: Consultation,
    new_status: ConsultationStatus,
    doctor_notes: str | None = None,
) -> Consultation:
    validate_consultation_transition(consultation.status, new_status)
    consultation.status = new_status
    if doctor_notes is not None:
        consultation.doctor_notes = doctor_notes
    db.commit()
    db.refresh(consultation)
    return consultation
