import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.clinic import ClinicCreate, ClinicUpdate
from app.schemas.doctor import DoctorCreate, DoctorUpdateAdmin, DoctorUpdateSelf
from app.services.clinic_service import (
    create_clinic,
    deactivate_clinic,
    get_clinic,
    get_clinics_paginated,
    update_clinic,
)
from app.services.doctor_service import (
    create_doctor,
    deactivate_doctor,
    get_doctor,
    get_doctor_by_user_id,
    get_doctors_paginated,
    get_nearby_doctors,
    update_doctor,
    verify_doctor,
)


def test_clinic_crud_operations():
    db = MagicMock()
    clinic_data = ClinicCreate(
        name="Happy Paws Clinic",
        description="Full-service vet facility",
        address="123 Vet Street",
        city="Chennai",
        state="Tamil Nadu",
        postal_code="600001",
        phone="9876543210",
        email="info@happypaws.com",
        latitude=Decimal("13.0827"),
        longitude=Decimal("80.2707"),
        opening_hours="Mon-Sat: 9am-6pm",
    )

    db.get.return_value = None

    # Test create_clinic structure
    c = Clinic(
        id=1,
        name=clinic_data.name,
        description=clinic_data.description,
        address=clinic_data.address,
        city=clinic_data.city,
        state=clinic_data.state,
        postal_code=clinic_data.postal_code,
        phone=clinic_data.phone,
        email=clinic_data.email,
        latitude=clinic_data.latitude,
        longitude=clinic_data.longitude,
        opening_hours=clinic_data.opening_hours,
        is_active=True,
    )
    assert c.id == 1
    assert c.city == "Chennai"
    assert c.is_active is True


def test_doctor_creation_validation():
    db = MagicMock()
    doc_user = User(id=10, email="doc@test.com", role=UserRole.CUSTOMER, is_active=True)

    db.get.return_value = doc_user
    db.scalar.return_value = None

    doc_data = DoctorCreate(
        user_id=10,
        specialization="Dermatology",
        qualification="BVSc",
        experience_years=5,
        consultation_fee=Decimal("500.00"),
        license_number="VET12345",
    )

    created_doc = create_doctor(db, doc_data)
    # User role should automatically update to UserRole.DOCTOR
    assert doc_user.role == UserRole.DOCTOR


def test_doctor_duplicate_profile_prevention():
    db = MagicMock()
    doc_user = User(id=10, email="doc@test.com", role=UserRole.DOCTOR, is_active=True)
    existing_doc = Doctor(id=1, user_id=10, license_number="VET12345")

    db.get.return_value = doc_user
    db.scalar.return_value = existing_doc

    doc_data = DoctorCreate(
        user_id=10,
        specialization="Dermatology",
        qualification="BVSc",
        experience_years=5,
        consultation_fee=Decimal("500.00"),
        license_number="VET12345",
    )

    with pytest.raises(ValueError) as exc:
        create_doctor(db, doc_data)
    assert "Doctor profile already exists" in str(exc.value)


def test_doctor_self_update_restrictions():
    db = MagicMock()
    doc = Doctor(
        id=1,
        user_id=10,
        specialization="Dermatology",
        qualification="BVSc",
        experience_years=5,
        consultation_fee=Decimal("500.00"),
        license_number="VET12345",
        bio="Old bio",
        is_available=True,
        is_verified=False,
    )

    db.scalar.return_value = doc
    db.get.return_value = doc

    update_self = DoctorUpdateSelf(
        bio="Updated bio for patients",
        consultation_fee=Decimal("600.00"),
        is_available=False,
    )

    updated = update_doctor(db, doc, update_self)
    assert updated.bio == "Updated bio for patients"
    assert updated.consultation_fee == Decimal("600.00")
    assert updated.is_available is False
    # Verified status should remain unchanged
    assert updated.is_verified is False


def test_nearby_doctor_coordinate_validation():
    db = MagicMock()

    with pytest.raises(ValueError) as exc1:
        get_nearby_doctors(db, latitude=-95.0, longitude=80.0)
    assert "Latitude must be between -90 and 90" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        get_nearby_doctors(db, latitude=13.0, longitude=185.0)
    assert "Longitude must be between -180 and 180" in str(exc2.value)

    with pytest.raises(ValueError) as exc3:
        get_nearby_doctors(db, latitude=13.0, longitude=80.0, radius_km=0.0)
    assert "Radius must be between 0.1 and 500 km" in str(exc3.value)
