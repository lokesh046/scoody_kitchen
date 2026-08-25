import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.doctor_application import DoctorApplication
from app.dependencies.auth import get_current_user
from app.core.database import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_submit_and_approve_application_lifecycle(db_session):
    # 1. Create a unique customer test user in DB
    email = "testonboardingvet@example.com"
    existing_user = db_session.scalar(select(User).where(User.email == email))
    if existing_user:
        # Clean up if exists
        db_session.execute(
            Doctor.__table__.delete().where(Doctor.user_id == existing_user.id)
        )
        db_session.execute(
            DoctorApplication.__table__.delete().where(DoctorApplication.user_id == existing_user.id)
        )
        db_session.delete(existing_user)
        db_session.commit()

    user = User(
        email=email,
        first_name="Alice",
        last_name="Green",
        phone="+919876543210",
        role=UserRole.CUSTOMER,
        auth_provider="magic_link",
        is_email_verified=True,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Override get_current_user dependency to our test customer
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        # 2. Check initial application status -> None
        status_res = client.get("/doctor-applications/status")
        assert status_res.status_code == 200
        assert status_res.json() is None

        # 3. Post a valid doctor application
        payload = {
            "first_name": "Alice",
            "last_name": "Green",
            "email": email,
            "phone": "+919876543210",
            "specialization": "Companion Dermatologist",
            "qualification": "B.V.Sc & A.H",
            "experience_years": 8,
            "consultation_fee": 750.00,
            "license_number": "VET-LIC-1192-DERM",
            "bio": "Expert companion pet dermatologist based in Chennai.",
            "degree_start_year": 2010,
            "degree_end_year": 2015,
            "nationality": "Indian",
            "clinic_name": "Green Adyar Clinic",
            "clinic_address": "8 Gandhi Road, Adyar",
            "clinic_city": "Chennai",
            "clinic_state": "Tamil Nadu",
            "aadhaar_card_url": "http://res.cloudinary.com/dummy/image/upload/aadhaar.jpg",
            "pan_card_url": "http://res.cloudinary.com/dummy/image/upload/pan.jpg",
            "medical_certificate_url": "http://res.cloudinary.com/dummy/image/upload/cert.jpg",
        }

        res = client.post("/doctor-applications", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "PENDING"
        assert data["first_name"] == "Alice"
        assert data["clinic_city"] == "Chennai"
        app_id = data["id"]

        # 4. Attempting duplicate submission should be blocked (400 Bad Request)
        dup_res = client.post("/doctor-applications", json=payload)
        assert dup_res.status_code == 400
        assert "already have" in dup_res.json()["detail"].lower()

        # 5. Fetch status again -> PENDING
        status_res_2 = client.get("/doctor-applications/status")
        assert status_res_2.status_code == 200
        assert status_res_2.json()["status"] == "PENDING"
        assert status_res_2.json()["id"] == app_id

        # 6. Admin operations: Override get_current_user to Admin
        admin_user = User(
            id=9999,
            email="admin_audit@example.com",
            role=UserRole.ADMIN,
            is_active=True
        )
        app.dependency_overrides[get_current_user] = lambda: admin_user

        # List applications as Admin
        list_res = client.get("/doctor-applications")
        assert list_res.status_code == 200
        assert len(list_res.json()) >= 1
        assert any(item["id"] == app_id for item in list_res.json())

        # Export CSV as Admin
        export_res = client.get("/doctor-applications/export")
        assert export_res.status_code == 200
        assert "text/csv" in export_res.headers["content-type"]
        assert "attachment" in export_res.headers["content-disposition"]
        assert "first_name,last_name,email" in export_res.text

        # Approve the application
        approve_res = client.patch(
            f"/doctor-applications/{app_id}/status",
            json={"status": "APPROVED"}
        )
        assert approve_res.status_code == 200
        assert approve_res.json()["status"] == "APPROVED"

        # 7. Verify user role updated to DOCTOR & profile created in DB
        db_session.expire_all()
        updated_user = db_session.get(User, user.id)
        assert updated_user.role == UserRole.DOCTOR

        doctor_profile = db_session.scalar(select(Doctor).where(Doctor.user_id == user.id))
        assert doctor_profile is not None
        assert doctor_profile.specialization == "Companion Dermatologist"
        assert doctor_profile.qualification == "B.V.Sc & A.H"
        assert doctor_profile.experience_years == 8
        assert doctor_profile.consultation_fee == Decimal("750.00")
        assert doctor_profile.is_verified is True
        assert doctor_profile.is_active is True

    finally:
        app.dependency_overrides.clear()
        # Clean up database records
        db_session.execute(
            Doctor.__table__.delete().where(Doctor.user_id == user.id)
        )
        db_session.execute(
            DoctorApplication.__table__.delete().where(DoctorApplication.user_id == user.id)
        )
        db_session.delete(user)
        db_session.commit()
