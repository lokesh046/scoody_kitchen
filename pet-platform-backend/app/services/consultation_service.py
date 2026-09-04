from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import uuid
from sqlalchemy import select, and_
from sqlalchemy.orm import Session, joinedload

from app.models.consultation import Consultation
from app.models.consultation_session import ConsultationSession, ConsultationParticipant
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import DayOfWeek, ConsultationStatus, UserRole
from app.models.pet import Pet
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationBookWithPayment,
    ConsultationPaymentIntentRequest,
    ConsultationPaymentIntentResponse,
)


# State Machine Transition Rules
VALID_CONSULTATION_TRANSITIONS: dict[ConsultationStatus, set[ConsultationStatus]] = {
    ConsultationStatus.PENDING: {ConsultationStatus.CONFIRMED, ConsultationStatus.IN_PROGRESS, ConsultationStatus.CANCELLED},
    ConsultationStatus.CONFIRMED: {ConsultationStatus.IN_PROGRESS, ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED},
    ConsultationStatus.IN_PROGRESS: {ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED},
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
    if current_status == new_status:
        return
    allowed = VALID_CONSULTATION_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Invalid consultation status transition from '{current_status.value}' to '{new_status.value}'"
        )


def _get_doctor_timezone(doctor: Doctor | None) -> ZoneInfo:
    from app.core.config import settings
    tz_str = getattr(doctor, "timezone", None) or getattr(settings, "DEFAULT_TIMEZONE", "Asia/Kolkata")
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return ZoneInfo("Asia/Kolkata")


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

    if not doctor.is_available:
        return []

    doctor_tz = _get_doctor_timezone(doctor)

    # Determine day of week in doctor's local calendar
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

    # Fetch existing active consultations for that doctor that fall within target_date in doctor's timezone
    day_start_utc = datetime.combine(target_date, time.min, tzinfo=doctor_tz).astimezone(timezone.utc)
    day_end_utc = datetime.combine(target_date, time.max, tzinfo=doctor_tz).astimezone(timezone.utc)

    existing_consultations = db.scalars(
        select(Consultation).where(
            Consultation.doctor_id == doctor_id,
            Consultation.status != ConsultationStatus.CANCELLED,
            Consultation.scheduled_at >= day_start_utc - timedelta(hours=1),
            Consultation.scheduled_at <= day_end_utc + timedelta(hours=1),
        )
    ).all()

    # Calculate booked time ranges in UTC
    booked_ranges: list[tuple[datetime, datetime]] = []
    for c in existing_consultations:
        sched_dt = c.scheduled_at
        if sched_dt.tzinfo is None:
            sched_dt = sched_dt.replace(tzinfo=timezone.utc)
        else:
            sched_dt = sched_dt.astimezone(timezone.utc)
        c_end = sched_dt + timedelta(minutes=c.duration_minutes)
        booked_ranges.append((sched_dt, c_end))

    # Generate valid slots in doctor's local timezone
    available_slots: list[str] = []
    now_utc = datetime.now(timezone.utc)

    for window in availabilities:
        local_curr_dt = datetime.combine(target_date, window.start_time, tzinfo=doctor_tz)
        local_window_end_dt = datetime.combine(target_date, window.end_time, tzinfo=doctor_tz)

        slot_delta = timedelta(minutes=duration_minutes)

        while local_curr_dt + slot_delta <= local_window_end_dt:
            local_slot_end_dt = local_curr_dt + slot_delta

            # Convert slot to UTC instant for overlap and past-time checks
            utc_slot_start = local_curr_dt.astimezone(timezone.utc)
            utc_slot_end = local_slot_end_dt.astimezone(timezone.utc)

            # Check overlap with booked consultations
            is_booked = False
            for b_start, b_end in booked_ranges:
                if max(utc_slot_start, b_start) < min(utc_slot_end, b_end):
                    is_booked = True
                    break

            if not is_booked and utc_slot_start > now_utc:
                available_slots.append(local_curr_dt.strftime("%H:%M"))

            local_curr_dt += slot_delta

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

    # 3. Convert and validate scheduled_at
    doctor_tz = _get_doctor_timezone(doctor)
    if create_data.scheduled_at.tzinfo is None:
        doctor_local_start = create_data.scheduled_at.replace(tzinfo=doctor_tz)
        requested_start_dt = doctor_local_start.astimezone(timezone.utc)
    else:
        requested_start_dt = create_data.scheduled_at.astimezone(timezone.utc)
        doctor_local_start = requested_start_dt.astimezone(doctor_tz)

    now_utc = datetime.now(timezone.utc)
    if requested_start_dt <= now_utc:
        raise ValueError("Scheduled time must be in the future")

    duration = 30
    requested_end_dt = requested_start_dt + timedelta(minutes=duration)
    doctor_local_end = doctor_local_start + timedelta(minutes=duration)

    # 4. Validate doctor availability for day of week & window in doctor's local calendar
    day_enum = WEEKDAY_TO_DAY_OF_WEEK[doctor_local_start.weekday()]
    req_start_time = doctor_local_start.time()
    req_end_time = doctor_local_end.time()

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

    # 6. Check overlapping existing consultations (in UTC)
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
        meeting_room_id=str(uuid.uuid4()),
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    return consultation


def create_consultation_payment_intent(
    db: Session,
    customer_id: int,
    intent_data: ConsultationPaymentIntentRequest,
) -> dict:
    # 1. Verify pet ownership
    pet = db.get(Pet, intent_data.pet_id)
    if pet is None or pet.user_id != customer_id:
        raise KeyError("Pet not found")

    # 2. Check doctor availability
    doctor = db.get(Doctor, intent_data.doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise ValueError("Doctor not found or not active/verified")

    if not doctor.is_available:
        raise ValueError("Doctor is currently not accepting consultations")

    # 3. Validate slot timing and doctor timezone
    doctor_tz = _get_doctor_timezone(doctor)
    if intent_data.scheduled_at.tzinfo is None:
        doctor_local_start = intent_data.scheduled_at.replace(tzinfo=doctor_tz)
        requested_start_dt = doctor_local_start.astimezone(timezone.utc)
    else:
        requested_start_dt = intent_data.scheduled_at.astimezone(timezone.utc)
        doctor_local_start = requested_start_dt.astimezone(doctor_tz)

    now_utc = datetime.now(timezone.utc)
    if requested_start_dt <= now_utc:
        raise ValueError("Scheduled time must be in the future")

    duration = 30
    requested_end_dt = requested_start_dt + timedelta(minutes=duration)
    doctor_local_end = doctor_local_start + timedelta(minutes=duration)

    day_enum = WEEKDAY_TO_DAY_OF_WEEK[doctor_local_start.weekday()]
    req_start_time = doctor_local_start.time()
    req_end_time = doctor_local_end.time()

    availabilities = db.scalars(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor.id,
            DoctorAvailability.day_of_week == day_enum,
            DoctorAvailability.is_available.is_(True),
        )
    ).all()

    has_window = any(
        _is_time_in_window(req_start_time, req_end_time, avail.start_time, avail.end_time)
        for avail in availabilities
    )

    if not has_window:
        raise ValueError("Requested time slot falls outside doctor's working schedule")

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

    # 4. Create Razorpay order if credentials configured
    from app.core.config import settings
    razorpay_order_id = None
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            import razorpay
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            amount_paise = int(doctor.consultation_fee * 100)
            razorpay_order = client.order.create(data={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"receipt_cons_d{doctor.id}_p{pet.id}",
                "payment_capture": 1
            })
            razorpay_order_id = razorpay_order.get("id")
        except Exception as e:
            raise ValueError(f"Failed to initiate Razorpay session: {str(e)}")

    return {
        "doctor_id": doctor.id,
        "amount": doctor.consultation_fee,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "razorpay_key_id": settings.RAZORPAY_KEY_ID,
    }


def book_consultation_with_payment(
    db: Session,
    customer_id: int,
    data: ConsultationBookWithPayment,
) -> Consultation:
    from app.core.config import settings

    doctor = db.get(Doctor, data.doctor_id)
    if doctor is None or not doctor.is_active or not doctor.is_verified:
        raise ValueError("Doctor not found or not active/verified")

    # Verify Razorpay signature if Razorpay is configured
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        if not data.razorpay_payment_id or not data.razorpay_signature or not data.razorpay_order_id:
            raise ValueError("Payment confirmation details are missing")
        try:
            import hmac
            import hashlib
            msg = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
            expected = hmac.new(
                key=settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                msg=msg.encode("utf-8"),
                digestmod=hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(expected, data.razorpay_signature):
                raise ValueError("Payment signature verification failed")
        except Exception as e:
            raise ValueError(f"Payment verification failed: {str(e)}")

    # Create consultation with CONFIRMED status
    create_dto = ConsultationCreate(
        pet_id=data.pet_id,
        doctor_id=data.doctor_id,
        scheduled_at=data.scheduled_at,
        reason=data.reason,
        customer_notes=data.customer_notes,
    )
    consultation = create_consultation(db, customer_id, create_dto)
    consultation.status = ConsultationStatus.CONFIRMED
    db.commit()
    db.refresh(consultation)

    # Disptach background Celery task for email invoice and notifications
    payment_id_str = data.razorpay_payment_id or f"PAY-CONS-{consultation.id}"
    try:
        from app.tasks.notification_tasks import dispatch_consultation_booking_confirmed_task
        dispatch_consultation_booking_confirmed_task.delay(
            consultation.id,
            float(doctor.consultation_fee),
            payment_id_str,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not enqueue Celery task, running inline background dispatch: {e}")
        try:
            from app.tasks.notification_tasks import dispatch_consultation_booking_confirmed_task
            dispatch_consultation_booking_confirmed_task(
                consultation.id,
                float(doctor.consultation_fee),
                payment_id_str,
            )
        except Exception as fallback_err:
            logging.getLogger(__name__).error(f"Failed fallback invoice dispatch: {fallback_err}")

    return consultation


def get_consultation_by_id(
    db: Session,
    consultation_id: int,
) -> Consultation | None:
    query = (
        select(Consultation)
        .options(
            joinedload(Consultation.pet),
            joinedload(Consultation.customer),
            joinedload(Consultation.doctor).joinedload(Doctor.user),
            joinedload(Consultation.doctor).joinedload(Doctor.clinic),
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
            joinedload(Consultation.customer),
            joinedload(Consultation.doctor).joinedload(Doctor.user),
            joinedload(Consultation.doctor).joinedload(Doctor.clinic),
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
            joinedload(Consultation.customer),
            joinedload(Consultation.doctor).joinedload(Doctor.user),
            joinedload(Consultation.doctor).joinedload(Doctor.clinic),
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
    old_status = consultation.status
    consultation.status = new_status
    if doctor_notes is not None:
        consultation.doctor_notes = doctor_notes

    now_utc = datetime.now(timezone.utc)
    if new_status == ConsultationStatus.IN_PROGRESS and consultation.started_at is None:
        consultation.started_at = now_utc

    if new_status in (ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED):
        if consultation.ended_at is None:
            consultation.ended_at = now_utc

        # Conclude any open sessions
        open_sessions = db.scalars(
            select(ConsultationSession).where(
                ConsultationSession.consultation_id == consultation.id,
                ConsultationSession.status == "ACTIVE",
            )
        ).all()
        for s in open_sessions:
            s.status = "CONCLUDED"
            s.ended_at = now_utc

        # Close unclosed participant attendance logs
        open_participants = db.scalars(
            select(ConsultationParticipant).where(
                ConsultationParticipant.consultation_id == consultation.id,
                ConsultationParticipant.left_at.is_(None),
            )
        ).all()
        for p in open_participants:
            p.left_at = now_utc
            p.duration_seconds = max(0, int((now_utc - p.joined_at).total_seconds()))

    db.commit()
    db.refresh(consultation)

    # Dispatch real-time WebSocket notification when status transitions
    if old_status != new_status:
        # Invalidate consultation detail cache key
        try:
            from app.core.cache import cache
            cache.delete(f"consultation:detail:{consultation.id}")
        except Exception:
            pass

        try:
            from app.services.notification_service import create_notification
            status_text = new_status.value.replace("_", " ").upper()

            # Format friendly doctor name
            doctor_name = "Veterinary Specialist"
            if consultation.doctor and consultation.doctor.user:
                doc_user = consultation.doctor.user
                doc_full = f"{doc_user.first_name or ''} {doc_user.last_name or ''}".strip()
                doctor_name = f"Dr. {doc_full}" if doc_full else "Specialist"
            elif consultation.doctor:
                doctor_name = f"Specialist #{consultation.doctor.id}"

            # Format friendly pet name
            pet_name = consultation.pet.name if consultation.pet else "Companion Patient"

            # Format friendly customer name
            customer_name = "Pet Parent"
            if consultation.customer:
                cust_full = f"{consultation.customer.first_name or ''} {consultation.customer.last_name or ''}".strip()
                customer_name = cust_full if cust_full else "Pet Parent"

            # Patient-facing message
            patient_msg = f"Consultation for {pet_name} with {doctor_name} is now {status_text}."
            
            # Doctor-facing message
            doctor_msg = f"Consultation for patient {pet_name} ({customer_name}) is now {status_text}."

            # Notify patient
            create_notification(
                db=db,
                user_id=consultation.customer_id,
                title="🩺 Consultation Status Update",
                message=patient_msg,
                type="CONSULTATION",
                link="/consultations"
            )
            
            # Notify doctor
            if consultation.doctor and consultation.doctor.user_id:
                create_notification(
                    db=db,
                    user_id=consultation.doctor.user_id,
                    title="🩺 Consultation Status Update",
                    message=doctor_msg,
                    type="CONSULTATION",
                    link="/doctor"
                )
        except Exception as e:
            import logging
            logging.getLogger("app.consultation").warning(f"Failed to send status update notification: {e}")

    return consultation


def calculate_session_timing(consultation: Consultation) -> dict:
    """
    Authoritative server-side calculation of consultation time window and access state.
    """
    now_utc = datetime.now(timezone.utc)
    scheduled_dt = consultation.scheduled_at
    if scheduled_dt.tzinfo is None:
        scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
    else:
        scheduled_dt = scheduled_dt.astimezone(timezone.utc)

    duration_mins = consultation.duration_minutes or 30
    session_end_dt = scheduled_dt + timedelta(minutes=duration_mins)
    grace_period_mins = 15
    hard_cutoff_dt = session_end_dt + timedelta(minutes=grace_period_mins)

    seconds_until_start = int((scheduled_dt - now_utc).total_seconds())
    seconds_remaining = int((session_end_dt - now_utc).total_seconds())
    is_expired = now_utc > hard_cutoff_dt

    status = consultation.status
    if status in (ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED):
        can_join = False
    elif is_expired:
        can_join = False
    elif seconds_until_start > 600:  # More than 10 minutes early (waiting room)
        can_join = False
    else:
        can_join = True

    return {
        "can_join": can_join,
        "time_until_start_seconds": max(0, seconds_until_start) if seconds_until_start > 0 else 0,
        "time_remaining_seconds": max(0, seconds_remaining) if seconds_remaining > 0 else 0,
        "is_expired": is_expired,
    }


def auto_complete_expired_consultations(db: Session) -> list[int]:
    """
    Finds and completes all active consultations whose session window + grace period has passed.
    """
    now_utc = datetime.now(timezone.utc)
    grace_period = timedelta(minutes=15)

    # Query active consultations
    active_statuses = [ConsultationStatus.CONFIRMED, ConsultationStatus.IN_PROGRESS]
    stmt = (
        select(Consultation)
        .options(joinedload(Consultation.doctor))
        .where(Consultation.status.in_(active_statuses))
    )
    consultations = db.scalars(stmt).all()

    completed_ids = []
    for consult in consultations:
        sched_dt = consult.scheduled_at
        if sched_dt.tzinfo is None:
            sched_dt = sched_dt.replace(tzinfo=timezone.utc)
        else:
            sched_dt = sched_dt.astimezone(timezone.utc)

        duration = consult.duration_minutes or 30
        hard_cutoff = sched_dt + timedelta(minutes=duration) + grace_period

        if now_utc >= hard_cutoff:
            try:
                update_consultation_status(
                    db=db,
                    consultation=consult,
                    new_status=ConsultationStatus.COMPLETED,
                    doctor_notes=consult.doctor_notes or "Session auto-completed on schedule expiration.",
                )
                completed_ids.append(consult.id)
            except Exception as e:
                import logging
                logging.getLogger("app.consultation").error(
                    f"Error auto-completing consultation #{consult.id}: {e}", exc_info=True
                )

    return completed_ids


def record_participant_join(
    db: Session,
    consultation_id: int,
    user_id: int,
    role: str,
    room_id: str,
) -> ConsultationParticipant:
    now_utc = datetime.now(timezone.utc)

    # 1. Find or create ACTIVE session for this consultation & room
    session = db.scalar(
        select(ConsultationSession)
        .where(
            ConsultationSession.consultation_id == consultation_id,
            ConsultationSession.status == "ACTIVE",
        )
        .order_by(ConsultationSession.created_at.desc())
    )
    if session is None:
        session = ConsultationSession(
            consultation_id=consultation_id,
            room_id=room_id,
            status="ACTIVE",
            started_at=now_utc,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # 2. Check if participant has an unclosed entry
    existing = db.scalar(
        select(ConsultationParticipant).where(
            ConsultationParticipant.session_id == session.id,
            ConsultationParticipant.user_id == user_id,
            ConsultationParticipant.left_at.is_(None),
        )
    )
    if existing:
        return existing

    # 3. Create participant join record
    participant = ConsultationParticipant(
        session_id=session.id,
        consultation_id=consultation_id,
        user_id=user_id,
        role=role,
        joined_at=now_utc,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def record_participant_leave(
    db: Session,
    consultation_id: int,
    user_id: int,
) -> ConsultationParticipant | None:
    now_utc = datetime.now(timezone.utc)
    participant = db.scalar(
        select(ConsultationParticipant)
        .where(
            ConsultationParticipant.consultation_id == consultation_id,
            ConsultationParticipant.user_id == user_id,
            ConsultationParticipant.left_at.is_(None),
        )
        .order_by(ConsultationParticipant.joined_at.desc())
    )
    if participant is None:
        return None

    participant.left_at = now_utc
    participant.duration_seconds = max(0, int((now_utc - participant.joined_at).total_seconds()))
    db.commit()
    db.refresh(participant)
    return participant


def get_consultation_audit_summary(
    db: Session,
    consultation_id: int,
) -> dict | None:
    consultation = db.scalar(
        select(Consultation)
        .options(
            joinedload(Consultation.sessions).joinedload(ConsultationSession.participants)
        )
        .where(Consultation.id == consultation_id)
    )
    if consultation is None:
        return None

    return {
        "consultation_id": consultation.id,
        "status": consultation.status,
        "scheduled_at": consultation.scheduled_at,
        "started_at": consultation.started_at,
        "ended_at": consultation.ended_at,
        "total_sessions": len(consultation.sessions),
        "sessions": consultation.sessions,
    }

