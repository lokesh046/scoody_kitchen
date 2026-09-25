from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from unittest.mock import MagicMock
import pytest

from app.models.consultation import Consultation
from app.models.consultation_session import ConsultationSession, ConsultationParticipant
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import DayOfWeek, ConsultationStatus
from app.models.pet import Pet
from app.schemas.consultation import ConsultationCreate, ConsultationPaymentIntentRequest
from app.services.consultation_service import (
    create_consultation,
    create_consultation_payment_intent,
    get_available_slots,
    get_consultation_audit_summary,
    record_participant_join,
    record_participant_leave,
    update_consultation_status,
    validate_consultation_transition,
)


def test_consultation_state_machine_valid_transitions():
    # Valid transitions
    validate_consultation_transition(ConsultationStatus.PENDING, ConsultationStatus.CONFIRMED)
    validate_consultation_transition(ConsultationStatus.PENDING, ConsultationStatus.CANCELLED)
    validate_consultation_transition(ConsultationStatus.CONFIRMED, ConsultationStatus.IN_PROGRESS)
    validate_consultation_transition(ConsultationStatus.CONFIRMED, ConsultationStatus.CANCELLED)
    validate_consultation_transition(ConsultationStatus.IN_PROGRESS, ConsultationStatus.COMPLETED)
    validate_consultation_transition(ConsultationStatus.IN_PROGRESS, ConsultationStatus.CANCELLED)


def test_consultation_state_machine_invalid_transitions():
    # Invalid transitions
    with pytest.raises(ValueError) as exc1:
        validate_consultation_transition(ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED)
    assert "Invalid consultation status transition" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        validate_consultation_transition(ConsultationStatus.CANCELLED, ConsultationStatus.CONFIRMED)
    assert "Invalid consultation status transition" in str(exc2.value)

    with pytest.raises(ValueError) as exc3:
        validate_consultation_transition(ConsultationStatus.PENDING, ConsultationStatus.COMPLETED)
    assert "Invalid consultation status transition" in str(exc3.value)

    # CONFIRMED -> COMPLETED is intentionally allowed (see
    # VALID_CONSULTATION_TRANSITIONS in consultation_service.py) — a doctor
    # can mark a confirmed consultation done without it ever passing through
    # IN_PROGRESS, so this is not an invalid transition to assert against.


def test_customer_pet_ownership_enforcement():
    db = MagicMock()
    # Pet belongs to user 5 (customer 5)
    pet = Pet(id=10, user_id=5)
    db.get.return_value = pet

    create_data = ConsultationCreate(
        pet_id=10,
        doctor_id=7,
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
        reason="Routine Checkup",
    )

    # Customer 999 tries to book pet 10 -> Should be rejected with KeyError (404)
    with pytest.raises(KeyError) as exc:
        create_consultation(db, customer_id=999, create_data=create_data)
    assert "Pet not found" in str(exc.value)


def test_past_date_booking_rejection():
    db = MagicMock()
    pet = Pet(id=10, user_id=5)
    doc = Doctor(id=7, user_id=20, is_active=True, is_verified=True, is_available=True)

    db.get.return_value = pet
    db.scalar.return_value = doc

    # Past datetime
    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    create_data = ConsultationCreate(
        pet_id=10,
        doctor_id=7,
        scheduled_at=past_time,
        reason="Routine Checkup",
    )

    with pytest.raises(ValueError) as exc:
        create_consultation(db, customer_id=5, create_data=create_data)
    assert "Scheduled time must be in the future" in str(exc.value)


def test_double_booking_conflict_rejection():
    db = MagicMock()
    pet = Pet(id=10, user_id=5)
    doc = Doctor(id=7, user_id=20, is_active=True, is_verified=True, is_available=True)

    db.get.return_value = pet

    # Calculate next Thursday dynamic date in doctor's timezone (Asia/Kolkata)
    doctor_tz = ZoneInfo("Asia/Kolkata")
    now_local = datetime.now(doctor_tz)
    days_ahead = 3 - now_local.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    future_local = (now_local + timedelta(days=days_ahead)).replace(hour=10, minute=0, second=0, microsecond=0)
    future_dt = future_local.astimezone(timezone.utc)

    # Availability for Thursday 09:00 - 13:00 (in doctor's local time)
    avail = DoctorAvailability(
        doctor_id=7,
        day_of_week=DayOfWeek.THURSDAY,
        start_time=time(9, 0),
        end_time=time(13, 0),
        is_available=True,
    )

    # Existing booked consultation for same slot
    existing_consultation = Consultation(
        id=1,
        doctor_id=7,
        customer_id=12,
        pet_id=3,
        scheduled_at=future_dt,
        duration_minutes=30,
        status=ConsultationStatus.CONFIRMED,
    )

    # First scalar returns doctor, second scalars returns availabilities, third scalar returns existing consultation
    db.scalar.side_effect = [doc, existing_consultation]
    db.scalars.return_value.all.return_value = [avail]

    create_data = ConsultationCreate(
        pet_id=10,
        doctor_id=7,
        scheduled_at=future_dt,
        reason="Routine Checkup",
    )

    with pytest.raises(MemoryError) as exc:
        create_consultation(db, customer_id=5, create_data=create_data)
    assert "already booked" in str(exc.value).lower()


def test_consultation_lifecycle_timestamps():
    db = MagicMock()
    consultation = Consultation(
        id=1,
        doctor_id=7,
        customer_id=5,
        pet_id=10,
        scheduled_at=datetime.now(timezone.utc),
        duration_minutes=30,
        status=ConsultationStatus.CONFIRMED,
        started_at=None,
        ended_at=None,
    )

    # 1. Transition CONFIRMED -> IN_PROGRESS sets started_at
    update_consultation_status(db, consultation, ConsultationStatus.IN_PROGRESS)
    assert consultation.status == ConsultationStatus.IN_PROGRESS
    assert consultation.started_at is not None
    assert consultation.ended_at is None
    initial_started_at = consultation.started_at

    # 2. Re-triggering IN_PROGRESS preserves initial started_at
    update_consultation_status(db, consultation, ConsultationStatus.IN_PROGRESS)
    assert consultation.started_at == initial_started_at

    # 3. Transition IN_PROGRESS -> COMPLETED sets ended_at
    update_consultation_status(db, consultation, ConsultationStatus.COMPLETED)
    assert consultation.status == ConsultationStatus.COMPLETED
    assert consultation.ended_at is not None
    assert consultation.ended_at >= initial_started_at


def test_participant_join_and_leave_telemetry():
    db = MagicMock()
    # Mock finding no active session initially -> creates new session
    db.scalar.side_effect = [None, None]  # 1st: no existing session, 2nd: no existing participant

    participant = record_participant_join(
        db=db,
        consultation_id=10,
        user_id=5,
        role="customer",
        room_id="scooby-room-10",
    )
    assert participant.consultation_id == 10
    assert participant.user_id == 5
    assert participant.role == "customer"
    assert participant.joined_at is not None
    assert participant.left_at is None
    assert participant.duration_seconds is None

    # Mock leave
    db.scalar.side_effect = [participant]
    left_part = record_participant_leave(db=db, consultation_id=10, user_id=5)
    assert left_part is not None
    assert left_part.left_at is not None
    assert left_part.duration_seconds is not None
    assert left_part.duration_seconds >= 0


def test_consultation_audit_summary_query():
    db = MagicMock()
    consultation = Consultation(
        id=10,
        customer_id=5,
        doctor_id=7,
        pet_id=3,
        scheduled_at=datetime.now(timezone.utc),
        duration_minutes=30,
        status=ConsultationStatus.COMPLETED,
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
    )
    session = ConsultationSession(
        id=1,
        consultation_id=10,
        room_id="scooby-room-10",
        status="CONCLUDED",
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
    )
    consultation.sessions = [session]
    db.scalar.return_value = consultation

    audit = get_consultation_audit_summary(db=db, consultation_id=10)
    assert audit is not None
    assert audit["consultation_id"] == 10
    assert audit["total_sessions"] == 1
    assert len(audit["sessions"]) == 1


def test_timezone_conversion_slot_and_booking():
    db = MagicMock()
    pet = Pet(id=10, user_id=5)
    doc = Doctor(id=7, user_id=20, is_active=True, is_verified=True, is_available=True)

    db.get.side_effect = lambda model, pk: doc if model == Doctor else pet
    db.scalar.side_effect = [doc, None, doc, None]  # 1st: doctor, 2nd: no overlap, 3rd: doctor, 4th: no overlap

    # Target date: next Tuesday in Asia/Kolkata
    doctor_tz = ZoneInfo("Asia/Kolkata")
    now_local = datetime.now(doctor_tz)
    days_ahead = 1 - now_local.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    target_date = (now_local + timedelta(days=days_ahead)).date()

    # Tuesday availability: 09:00 - 11:00 IST
    avail = DoctorAvailability(
        doctor_id=7,
        day_of_week=DayOfWeek.TUESDAY,
        start_time=time(9, 0),
        end_time=time(11, 0),
        is_available=True,
    )
    # Mock scalars: 1st call returns [avail] (availabilities), 2nd call returns [] (no existing consultations)
    mock_avail_res = MagicMock()
    mock_avail_res.all.return_value = [avail]
    mock_consult_res = MagicMock()
    mock_consult_res.all.return_value = []
    db.scalars.side_effect = [mock_avail_res, mock_consult_res, mock_avail_res, mock_avail_res, mock_avail_res]

    # 1. Test slot generation in doctor's timezone
    slots = get_available_slots(db=db, doctor_id=7, target_date=target_date, duration_minutes=30)
    assert "09:00" in slots
    assert "09:30" in slots
    assert "10:00" in slots
    assert "10:30" in slots

    # 2. Test booking for 10:00 AM IST (which is 04:30 UTC)
    booking_local = datetime.combine(target_date, time(10, 0), tzinfo=doctor_tz)
    booking_utc = booking_local.astimezone(timezone.utc)

    create_data = ConsultationCreate(
        pet_id=10,
        doctor_id=7,
        scheduled_at=booking_utc,
        reason="Ear infection check",
    )
    consultation = create_consultation(db, customer_id=5, create_data=create_data)
    assert consultation.scheduled_at == booking_utc

    # 3. Test booking with naive local ISO datetime (sent from frontend without timezone)
    booking_naive = datetime.combine(target_date, time(10, 30))
    create_naive = ConsultationCreate(
        pet_id=10,
        doctor_id=7,
        scheduled_at=booking_naive,
        reason="Skin allergy check",
    )
    db.scalar.side_effect = [doc, None]
    consult_naive = create_consultation(db, customer_id=5, create_data=create_naive)
    expected_utc = datetime.combine(target_date, time(10, 30), tzinfo=doctor_tz).astimezone(timezone.utc)
    assert consult_naive.scheduled_at == expected_utc

    # 4. Test booking outside working hours (e.g., 08:00 AM IST / 02:30 UTC) -> should be rejected
    invalid_local = datetime.combine(target_date, time(8, 0), tzinfo=doctor_tz)
    invalid_utc = invalid_local.astimezone(timezone.utc)
    create_invalid = ConsultationCreate(
        pet_id=10,
        doctor_id=7,
        scheduled_at=invalid_utc,
        reason="Early morning check",
    )
    db.scalar.side_effect = [doc, None]
    with pytest.raises(ValueError) as exc:
        create_consultation(db, customer_id=5, create_data=create_invalid)
    assert "falls outside doctor's working schedule" in str(exc.value)


def test_create_consultation_payment_intent_timezone_handling():
    db = MagicMock()
    pet = Pet(id=10, user_id=5)
    doc = Doctor(
        id=7,
        user_id=20,
        is_active=True,
        is_verified=True,
        is_available=True,
        consultation_fee=500.0,
    )

    doctor_tz = ZoneInfo("Asia/Kolkata")
    now_local = datetime.now(doctor_tz)
    days_ahead = (1 - now_local.weekday()) % 7
    if days_ahead == 0:
        days_ahead += 7
    target_date = (now_local + timedelta(days=days_ahead)).date()

    avail = DoctorAvailability(
        doctor_id=7,
        day_of_week=DayOfWeek.TUESDAY,
        start_time=time(9, 0),
        end_time=time(11, 0),
        is_available=True,
    )

    mock_avail_res = MagicMock()
    mock_avail_res.all.return_value = [avail]
    db.scalars.return_value = mock_avail_res
    db.scalar.return_value = None  # No overlapping consultations

    def mock_get(model, id_val):
        if model == Pet and id_val == 10:
            return pet
        if model == Doctor and id_val == 7:
            return doc
        return None

    db.get.side_effect = mock_get

    from unittest.mock import patch
    from app.core.config import settings

    with patch.object(settings, "RAZORPAY_KEY_ID", None), patch.object(settings, "RAZORPAY_KEY_SECRET", None):
        # 1. Timezone-aware booking at 10:00 AM IST (04:30 UTC)
        booking_local = datetime.combine(target_date, time(10, 0), tzinfo=doctor_tz)
        booking_utc = booking_local.astimezone(timezone.utc)

        intent_aware = ConsultationPaymentIntentRequest(
            pet_id=10,
            doctor_id=7,
            scheduled_at=booking_utc,
        )
        result_aware = create_consultation_payment_intent(db, customer_id=5, intent_data=intent_aware)
        assert result_aware["doctor_id"] == 7
        assert result_aware["amount"] == 500.0

        # 2. Timezone-naive booking at 10:30 AM local
        booking_naive = datetime.combine(target_date, time(10, 30))
        intent_naive = ConsultationPaymentIntentRequest(
            pet_id=10,
            doctor_id=7,
            scheduled_at=booking_naive,
        )
        result_naive = create_consultation_payment_intent(db, customer_id=5, intent_data=intent_naive)
        assert result_naive["doctor_id"] == 7
        assert result_naive["amount"] == 500.0

