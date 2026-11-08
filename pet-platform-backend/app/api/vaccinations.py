import json
from datetime import date

from fastapi.responses import HTMLResponse
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.dependencies.auth import get_current_user
from app.models.pet import Pet
from app.models.user import User
from app.models.vaccination import PetVaccination
from app.schemas.vaccination import (
    VaccinationHistoryRequest,
    VaccinationOverviewResponse,
    VaccinationRecordResponse,
    VaccinationUpdate,
    VaccineGuideResponse,
)
from app.services.pet_service import get_pet_by_id
from app.services.storage_service import get_storage_provider, validate_image_file
from app.services.vaccination_card import build_card_html
from app.services.vaccine_guide import build_guide
from app.services.vaccination_service import (
    build_overview,
    get_records,
    get_rules,
    save_history,
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


@router.get("/guide", response_model=VaccineGuideResponse)
def get_vaccine_guide(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The species' full vaccine schedule, timeline and rules, plus a due-date planner for this pet."""
    pet = _own_pet(db, pet_id, current_user)
    by_code: dict[str, list[date]] = {}
    for record in get_records(db, pet.id):
        by_code.setdefault(record.vaccine_code, []).append(record.date_given)
    return build_guide(pet.species, pet.date_of_birth, by_code)


@router.get("/card", response_class=HTMLResponse)
def vaccination_card(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A printable vaccination card for the pet (HTML; print or save it as a PDF)."""
    pet = _own_pet(db, pet_id, current_user)
    return HTMLResponse(
        build_card_html(pet, build_overview(db, pet)),
        headers={"Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'"},
    )


@router.put("/history", response_model=VaccinationOverviewResponse)
@limiter.limit("20/minute")
async def save_vaccination_history(
    request: Request,
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The step shown when adding an older pet. Multipart form: an `answers` field (JSON list of
    {vaccine_code, answer: given|not_vaccinated|unknown, date_given, clinic_name}) and, for every
    "given" answer, a vaccine card photo in the file field `photo_<vaccine_code>` (mandatory)."""
    pet = _own_pet(db, pet_id, current_user)
    form = await request.form()
    try:
        parsed = VaccinationHistoryRequest(answers=json.loads(str(form.get("answers") or "[]")))
    except (ValueError, ValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid vaccination history")

    rules = {r.code: r for r in get_rules(db, pet.species)}
    uploaded: list[str] = []
    photos: dict[str, str] = {}
    try:
        for a in parsed.answers:
            if a.answer != "given":
                continue
            rule = rules.get(a.vaccine_code)
            if rule is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown vaccine for this pet's species")
            file = form.get(f"photo_{a.vaccine_code}")
            data, upload = await _read_photo(file if hasattr(file, "read") else None, rule.name)
            # Validate everything cheap first; upload only once the rest of the request is sound.
            photos[a.vaccine_code] = (data, upload)
        try:
            save_history(db, pet, parsed.answers, photos=None, dry_run=True)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        urls: dict[str, str] = {}
        for code, (data, upload) in photos.items():
            url = _store_photo(data, upload)
            uploaded.append(url)
            urls[code] = url
        save_history(db, pet, parsed.answers, photos=urls)
    except Exception:
        db.rollback()
        _discard_photos(uploaded)
        raise
    return build_overview(db, pet)


async def _read_photo(upload: UploadFile | None, label: str) -> tuple[bytes, UploadFile]:
    """A vaccine card photo is mandatory for every recorded dose."""
    if upload is None or not getattr(upload, "filename", None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Add a photo of the vaccine card for {label}")
    data = await upload.read()
    validate_image_file(upload, data)
    return data, upload


def _store_photo(data: bytes, upload: UploadFile) -> str:
    return get_storage_provider().upload_image(
        file_bytes=data,
        original_filename=upload.filename or "vaccine-card.jpg",
        content_type=upload.content_type or "image/jpeg",
    )


def _discard_photos(urls: list[str]) -> None:
    storage = get_storage_provider()
    for url in urls:
        try:
            storage.delete_image(url)
        except Exception:
            pass


@router.post("", response_model=VaccinationRecordResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def add_vaccination(
    request: Request,
    pet_id: int,
    vaccine_code: str = Form(..., min_length=1, max_length=40),
    date_given: date = Form(...),
    clinic_name: str | None = Form(default=None, max_length=150),
    batch_number: str | None = Form(default=None, max_length=60),
    notes: str | None = Form(default=None, max_length=1000),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Records one dose. The vaccine card photo is required and is uploaded in the same request."""
    pet = _own_pet(db, pet_id, current_user)
    rules = {r.code: r for r in get_rules(db, pet.species)}
    if vaccine_code not in rules:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown vaccine for this pet's species")
    problem = validate_dose_date(pet, date_given)
    if problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)
    data, upload = await _read_photo(image, rules[vaccine_code].name)

    def clean(v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None

    url = _store_photo(data, upload)
    try:
        record = PetVaccination(
            pet_id=pet.id, vaccine_code=vaccine_code, date_given=date_given,
            clinic_name=clean(clinic_name), batch_number=clean(batch_number), notes=clean(notes), image_url=url,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        _discard_photos([url])
        raise
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
