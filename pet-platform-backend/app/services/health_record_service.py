from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.consultation import Consultation
from app.models.enums import HealthRecordType
from app.models.health_record import HealthRecord
from app.models.pet import Pet
from app.schemas.health_record import HealthRecordCreate, HealthRecordUpdate


def _verify_doctor_pet_relationship(db: Session, doctor_id: int, pet_id: int) -> bool:
    """
    Verifies that the doctor has at least one consultation record with this pet.
    """
    consultation = db.scalar(
        select(Consultation).where(
            Consultation.doctor_id == doctor_id,
            Consultation.pet_id == pet_id,
        )
    )
    return consultation is not None


def create_health_record_by_doctor(
    db: Session,
    doctor_id: int,
    create_data: HealthRecordCreate,
) -> HealthRecord:
    # 1. Verify Pet exists
    pet = db.get(Pet, create_data.pet_id)
    if pet is None:
        raise KeyError("Pet not found")

    # 2. Verify Consultation if provided
    if create_data.consultation_id is not None:
        consultation = db.get(Consultation, create_data.consultation_id)
        if (
            consultation is None
            or consultation.pet_id != create_data.pet_id
            or consultation.doctor_id != doctor_id
        ):
            raise ValueError("Consultation relationship mismatch or not found")

    # 3. Verify Doctor has a clinical relationship with pet
    if not _verify_doctor_pet_relationship(db, doctor_id, create_data.pet_id):
        raise KeyError("Doctor does not have a clinical relationship with this pet")

    record = HealthRecord(
        pet_id=create_data.pet_id,
        doctor_id=doctor_id,
        consultation_id=create_data.consultation_id,
        record_type=create_data.record_type,
        title=create_data.title,
        symptoms=create_data.symptoms,
        clinical_findings=create_data.clinical_findings,
        diagnosis=create_data.diagnosis,
        treatment=create_data.treatment,
        medications=create_data.medications,
        follow_up_date=create_data.follow_up_date,
        notes=create_data.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_pet_health_records_for_customer(
    db: Session,
    customer_id: int,
    pet_id: int,
    record_type: HealthRecordType | None = None,
) -> list[HealthRecord]:
    # Verify customer owns the pet
    pet = db.get(Pet, pet_id)
    if pet is None or pet.user_id != customer_id:
        raise KeyError("Pet not found")

    query = (
        select(HealthRecord)
        .options(joinedload(HealthRecord.doctor))
        .where(HealthRecord.pet_id == pet_id)
    )

    if record_type is not None:
        query = query.where(HealthRecord.record_type == record_type)

    query = query.order_by(HealthRecord.created_at.desc())
    return list(db.scalars(query).all())


def get_pet_health_records_for_doctor(
    db: Session,
    doctor_id: int,
    pet_id: int,
    record_type: HealthRecordType | None = None,
) -> list[HealthRecord]:
    # Verify doctor has clinical relationship with pet
    pet = db.get(Pet, pet_id)
    if pet is None or not _verify_doctor_pet_relationship(db, doctor_id, pet_id):
        raise KeyError("Pet or clinical relationship not found")

    query = (
        select(HealthRecord)
        .options(joinedload(HealthRecord.doctor))
        .where(HealthRecord.pet_id == pet_id)
    )

    if record_type is not None:
        query = query.where(HealthRecord.record_type == record_type)

    query = query.order_by(HealthRecord.created_at.desc())
    return list(db.scalars(query).all())


def get_health_record_by_id(
    db: Session,
    record_id: int,
) -> HealthRecord | None:
    query = (
        select(HealthRecord)
        .options(
            joinedload(HealthRecord.doctor),
            joinedload(HealthRecord.pet),
        )
        .where(HealthRecord.id == record_id)
    )
    return db.scalar(query)


def update_health_record_by_doctor(
    db: Session,
    doctor_id: int,
    record: HealthRecord,
    update_data: HealthRecordUpdate,
) -> HealthRecord:
    if record.doctor_id != doctor_id:
        raise PermissionError("Doctor cannot modify health records created by another doctor")

    data_dict = update_data.model_dump(exclude_unset=True)
    for key, val in data_dict.items():
        setattr(record, key, val)

    db.commit()
    db.refresh(record)
    return record
