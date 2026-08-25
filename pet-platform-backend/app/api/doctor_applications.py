from datetime import datetime, timezone
import csv
from io import StringIO
from typing import Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.enums import UserRole
from app.models.user import User
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.doctor_application import DoctorApplication
from app.schemas.doctor_application import (
    DoctorApplicationCreate,
    DoctorApplicationResponse,
    DoctorApplicationUpdateStatus,
)
from app.services.storage_service import get_storage_provider, validate_image_file
from app.services.email_service import send_doctor_verification_email

router = APIRouter(prefix="/doctor-applications", tags=["Doctor Onboarding"])

@router.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an Aadhaar, PAN, or Medical Certificate image to Cloudinary/local storage.
    """
    file_bytes = await file.read()
    validate_image_file(file, file_bytes)
    
    provider = get_storage_provider()
    doc_url = provider.upload_image(
        file_bytes=file_bytes,
        original_filename=file.filename or "document.jpg",
        content_type=file.content_type or "image/jpeg",
    )
    return {"url": doc_url}

@router.post("", response_model=DoctorApplicationResponse)
def submit_application(
    application_data: DoctorApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a new onboarding doctor application. Enforces that only one pending application can exist.
    """
    existing = db.scalar(
        select(DoctorApplication).where(
            DoctorApplication.user_id == current_user.id,
            DoctorApplication.status.in_(["PENDING", "APPROVED"])
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a {existing.status.lower()} application status. Resubmission is blocked."
        )

    # 1. Validate starting & ending year span (must be min 3 years difference)
    if application_data.degree_end_year < application_data.degree_start_year + 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The degree ending year must be at least 3 years after the start year."
        )
        
    if application_data.education_history:
        import json
        try:
            history = json.loads(application_data.education_history)
            if isinstance(history, list):
                for entry in history:
                    start = int(entry.get("start_year", 0))
                    end = int(entry.get("end_year", 0))
                    if end < start + 3:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="For each academic history entry, the end year must be at least 3 years after the start year."
                        )
        except json.JSONDecodeError:
            pass

    # Instantiate application
    app_record = DoctorApplication(
        user_id=current_user.id,
        first_name=application_data.first_name.strip(),
        last_name=application_data.last_name.strip(),
        email=application_data.email.strip().lower(),
        phone=application_data.phone.strip(),
        specialization=application_data.specialization.strip(),
        qualification=application_data.qualification.strip(),
        experience_years=application_data.experience_years,
        consultation_fee=application_data.consultation_fee,
        license_number=application_data.license_number.strip(),
        bio=application_data.bio.strip() if application_data.bio else None,
        degree_start_year=application_data.degree_start_year,
        degree_end_year=application_data.degree_end_year,
        nationality=application_data.nationality.strip(),
        education_history=application_data.education_history,
        clinic_name=application_data.clinic_name.strip(),
        clinic_address=application_data.clinic_address.strip(),
        clinic_city=application_data.clinic_city.strip(),
        clinic_state=application_data.clinic_state.strip(),
        aadhaar_card_url=application_data.aadhaar_card_url,
        pan_card_url=application_data.pan_card_url,
        medical_certificate_url=application_data.medical_certificate_url,
        status="PENDING",
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)
    return app_record

@router.get("/status", response_model=DoctorApplicationResponse | None)
def get_my_application_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the current logged-in user's latest doctor application.
    """
    statement = (
        select(DoctorApplication)
        .where(DoctorApplication.user_id == current_user.id)
        .order_by(DoctorApplication.created_at.desc())
    )
    return db.scalar(statement)

# ==================================================
# ADMIN MANAGEMENT ENDPOINTS
# ==================================================

@router.get("", response_model=list[DoctorApplicationResponse])
def list_doctor_applications_admin(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Admin endpoint to retrieve a list of onboarding applications.
    """
    query = select(DoctorApplication)
    if status_filter:
        query = query.where(DoctorApplication.status == status_filter.upper())
    query = query.order_by(DoctorApplication.created_at.desc())
    return db.scalars(query).all()

@router.get("/export")
def export_applications_csv(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Admin endpoint to export applications to CSV, filtered by date range.
    """
    query = select(DoctorApplication)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            query = query.where(DoctorApplication.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
            
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            query = query.where(DoctorApplication.created_at <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")

    apps = db.scalars(query).all()

    output = StringIO()
    writer = csv.writer(output)
    
    # Write CSV Header
    writer.writerow([
        "first_name", "last_name", "email", "phone", "specialization", "qualification",
        "experience_years", "consultation_fee", "license_number", "bio", "degree_start_year",
        "degree_end_year", "nationality", "clinic_name", "clinic_address", "clinic_city", "clinic_state",
        "status", "created_at"
    ])
    
    for app in apps:
        writer.writerow([
            app.first_name, app.last_name, app.email, app.phone, app.specialization, app.qualification,
            app.experience_years, app.consultation_fee, app.license_number, app.bio or "", app.degree_start_year,
            app.degree_end_year, app.nationality, app.clinic_name, app.clinic_address, app.clinic_city, app.clinic_state,
            app.status, app.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
    
    output.seek(0)
    
    # Return response as a streamable file
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=doctor_applications_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )

@router.post("/import-csv")
async def import_verified_doctors_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Upload CSV to bulk-verify and elevate doctor roles.
    """
    contents = await file.read()
    try:
        csv_text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Failed to decode CSV. Ensure file is UTF-8 encoded.")
        
    reader = csv.DictReader(StringIO(csv_text))
    
    success_count = 0
    warnings = []
    
    for idx, row in enumerate(reader, start=1):
        email = row.get("email", "").strip().lower()
        if not email:
            warnings.append(f"Row {idx}: Missing email address. Skipping.")
            continue
            
        first_name = row.get("first_name", "").strip() or "Specialist"
        last_name = row.get("last_name", "").strip() or ""
        phone = row.get("phone", "").strip() or "+919876543210"
        specialization = row.get("specialization", "").strip() or "veterinarian surgeon"
        qualification = row.get("qualification", "").strip() or "Degree in Veterinary Medicine"
        
        try:
            exp_years = int(row.get("experience_years", "0").strip() or "0")
        except ValueError:
            exp_years = 0
            
        try:
            fee = Decimal(row.get("consultation_fee", "0.0").strip() or "0.0")
        except Exception:
            fee = Decimal("0.00")
            
        license_number = row.get("license_number", "").strip() or f"LIC-{func.random()}"
        bio = row.get("bio", "").strip() or None
        
        # Check user existence
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            # Create user
            user = User(
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                role=UserRole.DOCTOR,
                auth_provider="magic_link",
                is_email_verified=True,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Promote role to doctor
            if user.role != UserRole.DOCTOR and user.role != UserRole.ADMIN:
                user.role = UserRole.DOCTOR
                db.add(user)
                db.commit()
                db.refresh(user)
                
        # Resolve Clinic
        clinic_id = None
        clinic_name = row.get("clinic_name", "").strip()
        if clinic_name:
            clinic_city = row.get("clinic_city", "").strip() or "Chennai"
            clinic_address = row.get("clinic_address", "").strip() or "Default Address"
            clinic_state = row.get("clinic_state", "").strip() or "Default State"
            
            clinic = db.scalar(
                select(Clinic).where(
                    func.lower(Clinic.name) == clinic_name.lower(),
                    func.lower(Clinic.city) == clinic_city.lower()
                )
            )
            if not clinic:
                clinic = Clinic(
                    name=clinic_name,
                    address=clinic_address,
                    city=clinic_city,
                    state=clinic_state,
                    postal_code="600001",
                    phone="+919876543210",
                    is_active=True,
                )
                db.add(clinic)
                db.commit()
                db.refresh(clinic)
            clinic_id = clinic.id
            
        # Create Doctor Profile
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
        if not doctor:
            doctor = Doctor(
                user_id=user.id,
                clinic_id=clinic_id,
                specialization=specialization,
                qualification=qualification,
                experience_years=exp_years,
                consultation_fee=fee,
                license_number=license_number,
                bio=bio,
                is_verified=True,
                is_active=True,
            )
            db.add(doctor)
        else:
            doctor.clinic_id = clinic_id
            doctor.specialization = specialization
            doctor.qualification = qualification
            doctor.experience_years = exp_years
            doctor.consultation_fee = fee
            doctor.license_number = license_number
            doctor.bio = bio
            doctor.is_verified = True
            doctor.is_active = True
            db.add(doctor)
            
        db.commit()
        
        # Approve corresponding database application
        app_record = db.scalar(
            select(DoctorApplication).where(
                func.lower(DoctorApplication.email) == email,
                DoctorApplication.status == "PENDING"
            )
        )
        if app_record:
            app_record.status = "APPROVED"
            db.add(app_record)
            db.commit()
            
        # Send confirmation email
        send_doctor_verification_email(email, user.first_name or "Specialist")
        success_count += 1
        
    return {
        "message": f"Successfully verified {success_count} doctor profiles.",
        "success_count": success_count,
        "warnings": warnings
    }

@router.patch("/{application_id}/status", response_model=DoctorApplicationResponse)
def update_application_status_admin(
    application_id: int,
    status_update: DoctorApplicationUpdateStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Directly approve/reject a doctor application from the admin interface.
    """
    app_record = db.get(DoctorApplication, application_id)
    if not app_record:
        raise HTTPException(status_code=404, detail="Doctor application not found.")
        
    new_status = status_update.status.upper()
    if new_status not in ["APPROVED", "REJECTED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Invalid status. Allowed values: APPROVED, REJECTED, PENDING.")
        
    app_record.status = new_status
    db.add(app_record)
    db.commit()
    
    if new_status == "APPROVED":
        # Promote the user and create verified Doctor profile
        user = db.get(User, app_record.user_id)
        if user:
            if user.role != UserRole.DOCTOR and user.role != UserRole.ADMIN:
                user.role = UserRole.DOCTOR
                db.add(user)
                db.commit()
                
            # Create/Resolve Clinic
            clinic_id = None
            if app_record.clinic_name:
                clinic = db.scalar(
                    select(Clinic).where(
                        func.lower(Clinic.name) == app_record.clinic_name.lower(),
                        func.lower(Clinic.city) == app_record.clinic_city.lower()
                    )
                )
                if not clinic:
                    clinic = Clinic(
                        name=app_record.clinic_name,
                        address=app_record.clinic_address,
                        city=app_record.clinic_city,
                        state=app_record.clinic_state,
                        postal_code="600001",
                        phone="+919876543210",
                        is_active=True,
                    )
                    db.add(clinic)
                    db.commit()
                    db.refresh(clinic)
                clinic_id = clinic.id
                
            # Create Doctor Profile
            doctor = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
            if not doctor:
                doctor = Doctor(
                    user_id=user.id,
                    clinic_id=clinic_id,
                    specialization=app_record.specialization,
                    qualification=app_record.qualification,
                    experience_years=app_record.experience_years,
                    consultation_fee=app_record.consultation_fee,
                    license_number=app_record.license_number,
                    bio=app_record.bio,
                    education_history=app_record.education_history,
                    is_verified=True,
                    is_active=True,
                )
                db.add(doctor)
            else:
                doctor.clinic_id = clinic_id
                doctor.specialization = app_record.specialization
                doctor.qualification = app_record.qualification
                doctor.experience_years = app_record.experience_years
                doctor.consultation_fee = app_record.consultation_fee
                doctor.license_number = app_record.license_number
                doctor.bio = app_record.bio
                doctor.education_history = app_record.education_history
                doctor.is_verified = True
                doctor.is_active = True
                db.add(doctor)
                
            db.commit()
            send_doctor_verification_email(user.email, user.first_name or "Specialist")
            
    db.refresh(app_record)
    return app_record
