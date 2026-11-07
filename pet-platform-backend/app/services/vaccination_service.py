"""Vaccination records: the due-date rules, and the database helpers around them.

compute_vaccine_status() is pure (no database), so the schedule logic can be tested on its own.
"""
import calendar
import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pet import Pet
from app.models.vaccination import PetVaccination, PetVaccineDeclaration, VaccinationReminder, VaccineSchedule

logger = logging.getLogger(__name__)

DUE_SOON_DAYS = 30
RECENT_DAYS = 90  # a dose this recent is shown as a recent record
PUPPY_WEEKS = 16  # younger pets start the normal schedule; older ones must give their history


def normalize_species(species: str | None) -> str:
    return (species or "").strip().lower()


def add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_vaccine_status(rule, dob: date | None, dose_dates: list[date], today: date, declared: str | None = None) -> dict:
    """Where a pet stands for one vaccine: the next due date and a status.

    status: not_started (core vaccine, birth date unknown) | optional (non-core, none given yet)
            | overdue | due_soon (within 30 days) | upcoming
    """
    doses = sorted(dose_dates)
    count = len(doses)
    last = doses[-1] if doses else None
    next_due: date | None = None

    if count == 0:
        if rule.category == "core" and dob is not None:
            next_due = dob + timedelta(weeks=rule.first_dose_weeks)
    elif count < rule.series_doses:
        next_due = last + timedelta(weeks=rule.series_interval_weeks)
    elif count == rule.series_doses:
        next_due = add_months(last, rule.booster_months)
    else:
        next_due = add_months(last, rule.repeat_months)

    if next_due is None and count == 0 and declared and rule.category == "core":
        status = "overdue"  # owner says not vaccinated / unknown: needs a vet visit
    elif next_due is None:
        status = "not_started" if rule.category == "core" else "optional"
    elif next_due < today:
        status = "overdue"
    elif (next_due - today).days <= DUE_SOON_DAYS:
        status = "due_soon"
    else:
        status = "upcoming"

    return {
        "code": rule.code,
        "name": rule.name,
        "category": rule.category,
        "description": rule.description,
        "vet_reviewed": rule.vet_reviewed,
        "status": status,
        "next_due_date": next_due,
        "last_given_date": last,
        "doses_given": count,
        "series_doses": rule.series_doses,
        "declared": declared if count == 0 else None,
        "recent": bool(last and (today - last).days <= RECENT_DAYS),
    }


def get_rules(db: Session, species: str) -> list[VaccineSchedule]:
    stmt = (
        select(VaccineSchedule)
        .where(VaccineSchedule.species == normalize_species(species), VaccineSchedule.is_active.is_(True))
        .order_by(VaccineSchedule.sort_order, VaccineSchedule.id)
    )
    return list(db.scalars(stmt).all())


def get_records(db: Session, pet_id: int) -> list[PetVaccination]:
    stmt = (
        select(PetVaccination)
        .where(PetVaccination.pet_id == pet_id)
        .order_by(PetVaccination.date_given.desc(), PetVaccination.id.desc())
    )
    return list(db.scalars(stmt).all())


def get_declarations(db: Session, pet_id: int) -> dict[str, str]:
    rows = db.scalars(select(PetVaccineDeclaration).where(PetVaccineDeclaration.pet_id == pet_id)).all()
    return {r.vaccine_code: r.answer for r in rows}


def history_required(pet: Pet, today: date) -> bool:
    """Older pets (or a pet with no birth date) must give their vaccination history; young puppies start the schedule."""
    if pet.date_of_birth is None:
        return True
    return (today - pet.date_of_birth).days > PUPPY_WEEKS * 7


def build_overview(db: Session, pet: Pet, today: date | None = None) -> dict:
    today = today or date.today()
    rules = get_rules(db, pet.species)
    records = get_records(db, pet.id)
    declared = get_declarations(db, pet.id)
    items = []
    for rule in rules:
        dates = [r.date_given for r in records if r.vaccine_code == rule.code]
        items.append(compute_vaccine_status(rule, pet.date_of_birth, dates, today, declared.get(rule.code)))
    core = [i for i in items if i["category"] == "core"]
    answered = all(i["doses_given"] > 0 or i["declared"] for i in core)
    return {
        "history_required": bool(rules) and history_required(pet, today),
        "history_complete": answered,
        "pet_id": pet.id,
        "species": normalize_species(pet.species),
        "supported": bool(rules),
        "date_of_birth_known": pet.date_of_birth is not None,
        "items": items,
        "records": records,
    }


def save_history(db: Session, pet: Pet, answers: list, today: date | None = None,
                 photos: dict[str, str] | None = None, dry_run: bool = False) -> None:
    """Saves the older-pet history step in one go. Every core vaccine for the species must be answered.
    answers: objects with vaccine_code, answer (given | not_vaccinated | unknown), date_given, clinic_name.
    Raises ValueError with a message for the API to return as a 400."""
    today = today or date.today()
    rules = get_rules(db, pet.species)
    by_code = {r.code: r for r in rules}
    seen: dict[str, object] = {}
    for a in answers:
        if a.vaccine_code not in by_code:
            raise ValueError("Unknown vaccine for this pet's species")
        if a.vaccine_code in seen:
            raise ValueError("Each vaccine can only be answered once")
        seen[a.vaccine_code] = a
    missing = [r.name for r in rules if r.category == "core" and r.code not in seen]
    if missing:
        raise ValueError("Please answer for: " + ", ".join(missing))
    for a in answers:
        if a.answer == "given":
            if a.date_given is None:
                raise ValueError("Enter the date of the last dose, or choose Not vaccinated / Don't know")
            problem = validate_dose_date(pet, a.date_given, today)
            if problem:
                raise ValueError(problem)
    if dry_run:
        return
    photos = photos or {}
    for code, a in seen.items():
        existing_decl = db.scalar(select(PetVaccineDeclaration).where(
            PetVaccineDeclaration.pet_id == pet.id, PetVaccineDeclaration.vaccine_code == code))
        if a.answer == "given":
            if existing_decl:
                db.delete(existing_decl)
            dup = db.scalar(select(PetVaccination.id).where(
                PetVaccination.pet_id == pet.id, PetVaccination.vaccine_code == code,
                PetVaccination.date_given == a.date_given))
            if dup is None:
                db.add(PetVaccination(pet_id=pet.id, vaccine_code=code, date_given=a.date_given,
                                      clinic_name=getattr(a, "clinic_name", None), image_url=photos.get(code)))
        else:
            if existing_decl:
                existing_decl.answer = a.answer
            else:
                db.add(PetVaccineDeclaration(pet_id=pet.id, vaccine_code=code, answer=a.answer))
    db.commit()


def validate_dose_date(pet: Pet, given: date, today: date | None = None) -> str | None:
    """Returns a message when the date can't be right, else None."""
    today = today or date.today()
    if given > today:
        return "The date given can't be in the future"
    if pet.date_of_birth and given < pet.date_of_birth:
        return "The date given can't be before the pet's birth date"
    return None


# ----------------------------- reminders (called by the daily Celery task) -----------------------------

def _was_sent(db: Session, pet_id: int, code: str, due: date, kind: str) -> bool:
    stmt = select(VaccinationReminder.id).where(
        VaccinationReminder.pet_id == pet_id,
        VaccinationReminder.vaccine_code == code,
        VaccinationReminder.due_date == due,
        VaccinationReminder.kind == kind,
    )
    return db.scalar(stmt) is not None


def send_due_reminders(db: Session, today: date | None = None) -> int:
    """One in-app + push notification when a core or recorded vaccine is 7 days away, and one when
    it turns overdue. Each (pet, vaccine, due date, kind) is sent once. Returns how many were sent."""
    from app.services.notification_service import create_notification

    today = today or date.today()
    sent = 0
    pets = list(db.scalars(select(Pet)).all())
    rules_cache: dict[str, list[VaccineSchedule]] = {}
    for pet in pets:
        species = normalize_species(pet.species)
        if species not in rules_cache:
            rules_cache[species] = get_rules(db, species)
        rules = rules_cache[species]
        if not rules:
            continue
        records = get_records(db, pet.id)
        for rule in rules:
            dates = [r.date_given for r in records if r.vaccine_code == rule.code]
            # Skip vaccines the owner never started unless they are core and have a known due date.
            info = compute_vaccine_status(rule, pet.date_of_birth, dates, today)
            due = info["next_due_date"]
            if due is None:
                continue
            days_left = (due - today).days
            if days_left == 7:
                kind, title = "soon", f"{pet.name}'s {rule.name} vaccine is due in a week"
                message = f"Due on {due.strftime('%d %b %Y')}. Book a visit with your vet."
            elif days_left < 0 and days_left >= -30:
                kind, title = "overdue", f"{pet.name}'s {rule.name} vaccine is overdue"
                message = f"It was due on {due.strftime('%d %b %Y')}. Please see your vet soon."
            else:
                continue
            if _was_sent(db, pet.id, rule.code, due, kind):
                continue
            try:
                db.add(VaccinationReminder(pet_id=pet.id, vaccine_code=rule.code, due_date=due, kind=kind))
                db.flush()
                create_notification(db, pet.user_id, title, message, type="VACCINATION", link="/pets")
                sent += 1
            except Exception:
                db.rollback()
                logger.error("vaccination reminder failed for pet %s", pet.id, exc_info=True)
    return sent
