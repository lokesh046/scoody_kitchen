from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import get_current_user
from app.models.pet import Pet
from app.models.user import User
from app.models.vaccination import PetVaccination
from app.schemas.vaccination import (
    VaccinationCreate,
    VaccinationOverviewResponse,
    VaccinationRecordResponse,
    VaccinationUpdate,
)
from app.services.pet_service import get_pet_by_id
from app.services.storage_service import get_storage_provider, validate_image_file
from app.services.vaccination_service import (
    build_overview,
    get_rules,
    validate_dose_date,
)

router = APIRouter(prefix="/pets/{pet_id}/vaccinations", tags=["Vaccinations"])


def _own_pet(db: Session, pet_id: int, user: User) -> Pet:
    pet = get_pet_by_id(db, pet_id, user.id)
    if not pet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet Not Found")
    return pet


def _own_record(db: Session, pet: Pet, record_id: int) -> PetVaccination:
    record = db.get(PetVaccination, record_id)
    if not record or record.pet_id != pet.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaccination record not found")
    return record


@router.get("", response_model=VaccinationOverviewResponse)
def get_vaccinations(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_overview(db, _own_pet(db, pet_id, current_user))


@router.post("", response_model=VaccinationRecordResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def add_vaccination(
    request: Request,
    pet_id: int,
    data: VaccinationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = _own_pet(db, pet_id, current_user)
    codes = {r.code for r in get_rules(db, pet.species)}
    if data.vaccine_code not in codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown vaccine for this pet's species")
    problem = validate_dose_date(pet, data.date_given)
    if problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)
    record = PetVaccination(pet_id=pet.id, **data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("/{record_id}", response_model=VaccinationRecordResponse)
@limiter.limit("60/minute")
def update_vaccination(
    request: Request,
    pet_id: int,
    record_id: int,
    data: VaccinationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = _own_pet(db, pet_id, current_user)
    record = _own_record(db, pet, record_id)
    changes = data.model_dump(exclude_unset=True)
    if "date_given" in changes:
        if changes["date_given"] is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date given is required")
        problem = validate_dose_date(pet, changes["date_given"])
        if problem:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)
    for field, value in changes.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
def delete_vaccination(
    request: Request,
    pet_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pet = _own_pet(db, pet_id, current_user)
    record = _own_record(db, pet, record_id)
    image_url = record.image_url
    db.delete(record)
    db.commit()
    if image_url:
        try:
            get_storage_provider().delete_image(image_url)
        except Exception:
            pass


@router.post("/{record_id}/image", response_model=VaccinationRecordResponse)
@limiter.limit("20/minute")
async def upload_vaccination_image(
    request: Request,
    pet_id: int,
    record_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a photo of the vaccine card. The URL comes only from our own upload, never from the client."""
    pet = _own_pet(db, pet_id, current_user)
    record = _own_record(db, pet, record_id)
    file_bytes = await image.read()
    validate_image_file(image, file_bytes)
    storage = get_storage_provider()
    old = record.image_url
    record.image_url = storage.upload_image(
        file_bytes=file_bytes,
        original_filename=image.filename or "vaccine-card.jpg",
        content_type=image.content_type or "image/jpeg",
    )
    db.commit()
    db.refresh(record)
    if old:
        try:
            storage.delete_image(old)
        except Exception:
            pass
    return record
