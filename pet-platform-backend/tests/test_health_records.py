from datetime import date
from unittest.mock import MagicMock
import pytest

from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.enums import HealthRecordType
from app.models.health_record import HealthRecord
from app.models.pet import Pet
from app.schemas.health_record import HealthRecordCreate, HealthRecordUpdate
from app.services.health_record_service import (
    create_health_record_by_doctor,
    get_pet_health_records_for_customer,
    get_pet_health_records_for_doctor,
    update_health_record_by_doctor,
)


def test_customer_view_own_pet_records():
    db = MagicMock()
    # Customer 5 owns pet 10
    pet = Pet(id=10, user_id=5)
    db.get.return_value = pet

    record1 = HealthRecord(id=1, pet_id=10, title="Checkup", record_type=HealthRecordType.GENERAL)
    db.scalars.return_value.all.return_value = [record1]

    records = get_pet_health_records_for_customer(db, customer_id=5, pet_id=10)
    assert len(records) == 1
    assert records[0].title == "Checkup"


def test_customer_view_other_customer_pet_records_rejected():
    db = MagicMock()
    # Customer 5 owns pet 10
    pet = Pet(id=10, user_id=5)
    db.get.return_value = pet

    # Customer 999 attempts to access pet 10 -> Rejected with KeyError (404)
    with pytest.raises(KeyError) as exc:
        get_pet_health_records_for_customer(db, customer_id=999, pet_id=10)
    assert "Pet not found" in str(exc.value)


def test_doctor_create_health_record_clinical_relationship_required():
    db = MagicMock()
    pet = Pet(id=10, user_id=5)
    db.get.return_value = pet
    # Doctor 7 has no consultation relationship with pet 10
    db.scalar.return_value = None

    create_data = HealthRecordCreate(
        pet_id=10,
        record_type=HealthRecordType.DIAGNOSIS,
        title="Skin Rash",
        diagnosis="Mild dermatitis",
    )

    with pytest.raises(KeyError) as exc:
        create_health_record_by_doctor(db, doctor_id=7, create_data=create_data)
    assert "clinical relationship" in str(exc.value).lower()


def test_doctor_create_health_record_success():
    db = MagicMock()
    pet = Pet(id=10, user_id=5)
    consultation = Consultation(id=3, doctor_id=7, pet_id=10)
    db.get.side_effect = [pet, consultation]
    db.scalar.return_value = consultation  # Relationship verified

    create_data = HealthRecordCreate(
        pet_id=10,
        consultation_id=3,
        record_type=HealthRecordType.DIAGNOSIS,
        title="Skin Rash",
        diagnosis="Mild dermatitis",
    )

    record = create_health_record_by_doctor(db, doctor_id=7, create_data=create_data)
    assert record.pet_id == 10
    assert record.doctor_id == 7
    assert record.diagnosis == "Mild dermatitis"


def test_doctor_update_other_doctor_record_rejected():
    db = MagicMock()
    # Record created by doctor 7
    record = HealthRecord(id=1, doctor_id=7, title="Original Note")

    # Doctor 8 tries to update record created by doctor 7 -> Rejected with PermissionError (403)
    update_data = HealthRecordUpdate(title="Tampered Note")
    with pytest.raises(PermissionError) as exc:
        update_health_record_by_doctor(db, doctor_id=8, record=record, update_data=update_data)
    assert "Doctor cannot modify health records created by another doctor" in str(exc.value)
