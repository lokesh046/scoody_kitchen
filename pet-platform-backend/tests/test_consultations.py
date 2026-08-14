from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import MagicMock
import pytest

from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import DayOfWeek, ConsultationStatus
from app.models.pet import Pet
from app.schemas.consultation import ConsultationCreate
from app.services.consultation_service import (
    create_consultation,
    get_available_slots,
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

    future_dt = datetime(2026, 8, 20, 10, 0, tzinfo=timezone.utc)  # Thursday 10:00

    # Availability for Thursday 09:00 - 13:00
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
