from datetime import time
from unittest.mock import MagicMock
import pytest

from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.enums import DayOfWeek
from app.schemas.doctor_availability import (
    BulkScheduleCreate,
    DoctorAvailabilityCreate,
    DoctorAvailabilityUpdate,
)
from app.services.doctor_availability_service import (
    create_availability,
    delete_availability,
    get_doctor_availabilities,
    replace_doctor_schedule_bulk,
    update_availability,
)


def test_availability_time_range_validation():
    # Valid time range
    valid = DoctorAvailabilityCreate(
        day_of_week=DayOfWeek.MONDAY,
        start_time=time(9, 0),
        end_time=time(13, 0),
    )
    assert valid.start_time < valid.end_time

    # Equal start and end time -> Invalid
    with pytest.raises(ValueError) as exc1:
        DoctorAvailabilityCreate(
            day_of_week=DayOfWeek.MONDAY,
            start_time=time(10, 0),
            end_time=time(10, 0),
        )
    assert "start_time must be earlier than end_time" in str(exc1.value)

    # start_time later than end_time -> Invalid
    with pytest.raises(ValueError) as exc2:
        DoctorAvailabilityCreate(
            day_of_week=DayOfWeek.MONDAY,
            start_time=time(14, 0),
            end_time=time(10, 0),
        )
    assert "start_time must be earlier than end_time" in str(exc2.value)


def test_bulk_schedule_internal_overlap_prevention():
    # Valid bulk schedule (adjacent + non-overlapping)
    valid_bulk = BulkScheduleCreate(
        schedule=[
            DoctorAvailabilityCreate(
                day_of_week=DayOfWeek.MONDAY,
                start_time=time(9, 0),
                end_time=time(13, 0),
            ),
            DoctorAvailabilityCreate(
                day_of_week=DayOfWeek.MONDAY,
                start_time=time(13, 0),  # Adjacent touching range is allowed
                end_time=time(17, 0),
            ),
        ]
    )
    assert len(valid_bulk.schedule) == 2

    # Overlapping bulk schedule -> Invalid
    with pytest.raises(ValueError) as exc:
        BulkScheduleCreate(
            schedule=[
                DoctorAvailabilityCreate(
                    day_of_week=DayOfWeek.MONDAY,
                    start_time=time(9, 0),
                    end_time=time(13, 0),
                ),
                DoctorAvailabilityCreate(
                    day_of_week=DayOfWeek.MONDAY,
                    start_time=time(12, 0),  # Overlaps 12:00-13:00
                    end_time=time(15, 0),
                ),
            ]
        )
    assert "overlapping windows" in str(exc.value).lower()


def test_create_availability_service():
    db = MagicMock()
    doc = Doctor(id=7, user_id=10, is_available=True)
    db.get.return_value = doc
    db.scalar.return_value = None  # No existing overlap

    avail_create = DoctorAvailabilityCreate(
        day_of_week=DayOfWeek.WEDNESDAY,
        start_time=time(9, 0),
        end_time=time(12, 0),
    )

    rec = create_availability(db, doctor_id=7, availability_data=avail_create)
    assert rec.doctor_id == 7
    assert rec.day_of_week == DayOfWeek.WEDNESDAY
    assert rec.start_time == time(9, 0)
    assert rec.end_time == time(12, 0)


def test_create_availability_overlap_service():
    db = MagicMock()
    doc = Doctor(id=7, user_id=10, is_available=True)
    db.get.return_value = doc

    # Simulate existing overlap query returning a record
    existing_rec = DoctorAvailability(
        id=1,
        doctor_id=7,
        day_of_week=DayOfWeek.MONDAY,
        start_time=time(9, 0),
        end_time=time(13, 0),
    )
    db.scalar.return_value = existing_rec

    avail_create = DoctorAvailabilityCreate(
        day_of_week=DayOfWeek.MONDAY,
        start_time=time(12, 0),
        end_time=time(15, 0),
    )

    with pytest.raises(ValueError) as exc:
        create_availability(db, doctor_id=7, availability_data=avail_create)
    assert "overlaps with an existing schedule" in str(exc.value)


def test_delete_availability_service():
    db = MagicMock()
    rec = DoctorAvailability(
        id=5,
        doctor_id=7,
        day_of_week=DayOfWeek.FRIDAY,
        start_time=time(14, 0),
        end_time=time(18, 0),
    )

    delete_availability(db, rec)
    db.delete.assert_called_once_with(rec)
    db.commit.assert_called_once()
