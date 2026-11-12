"""History step and overview, run against a throwaway in-memory SQLite database (never a real one)."""
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
import app.models  # noqa: F401  (registers every table)
from app.models.pet import Pet
from app.models.vaccination import PetVaccination, PetVaccineDeclaration, VaccineSchedule
from app.services.vaccination_service import build_overview, save_history
from app.services.vaccine_rules_seed import SEED_RULES

TODAY = date(2026, 11, 7)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    tables = [VaccineSchedule.__table__, PetVaccination.__table__, PetVaccineDeclaration.__table__, Pet.__table__]
    Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine)()
    for i, (sp, code, name, cat, desc, fw, sd, si, bm, rm) in enumerate(SEED_RULES):
        session.add(VaccineSchedule(species=sp, code=code, name=name, category=cat, description=desc,
                                    first_dose_weeks=fw, series_doses=sd, series_interval_weeks=si,
                                    booster_months=bm, repeat_months=rm, sort_order=i))
    session.commit()
    yield session
    session.close()


def make_pet(db, species="Dog", dob=date(2025, 11, 1)):
    pet = Pet(user_id=1, name="Rex", species=species, breed="Lab", date_of_birth=dob)
    db.add(pet)
    db.commit()
    return pet


def ans(code, kind, d=None):
    return SimpleNamespace(vaccine_code=code, answer=kind, date_given=d, clinic_name=None)


def test_older_dog_must_answer_every_core_vaccine(db):
    pet = make_pet(db)
    ov = build_overview(db, pet, TODAY)
    assert ov["history_required"] is True and ov["history_complete"] is False
    with pytest.raises(ValueError, match="Please answer for"):
        save_history(db, pet, [ans("dhppi", "given", date(2026, 9, 1))], TODAY)  # rabies missing


def test_given_needs_a_date_and_not_future(db):
    pet = make_pet(db)
    with pytest.raises(ValueError, match="date of the last dose"):
        save_history(db, pet, [ans("dhppi", "given"), ans("rabies", "unknown")], TODAY)
    with pytest.raises(ValueError, match="future"):
        save_history(db, pet, [ans("dhppi", "given", date(2027, 1, 1)), ans("rabies", "unknown")], TODAY)


def test_unknown_or_duplicate_vaccine_rejected(db):
    pet = make_pet(db)
    with pytest.raises(ValueError, match="Unknown vaccine"):
        save_history(db, pet, [ans("felv", "unknown")], TODAY)  # cat vaccine on a dog
    with pytest.raises(ValueError, match="only be answered once"):
        save_history(db, pet, [ans("rabies", "unknown"), ans("rabies", "unknown")], TODAY)


def test_full_history_saved_marks_complete_and_flags_overdue(db):
    pet = make_pet(db)
    save_history(db, pet, [ans("dhppi", "given", date(2026, 9, 20)), ans("rabies", "not_vaccinated")], TODAY)
    ov = build_overview(db, pet, TODAY)
    assert ov["history_complete"] is True
    items = {i["code"]: i for i in ov["items"]}
    assert items["dhppi"]["doses_given"] == 1 and items["dhppi"]["recent"] is True
    assert items["rabies"]["declared"] == "not_vaccinated"
    assert items["rabies"]["status"] == "overdue"
    assert len(ov["records"]) == 1


def test_saving_twice_does_not_duplicate_and_given_clears_declaration(db):
    pet = make_pet(db)
    answers = [ans("dhppi", "given", date(2026, 9, 20)), ans("rabies", "unknown")]
    save_history(db, pet, answers, TODAY)
    save_history(db, pet, [ans("dhppi", "given", date(2026, 9, 20)), ans("rabies", "given", date(2026, 8, 1))], TODAY)
    ov = build_overview(db, pet, TODAY)
    assert len(ov["records"]) == 2
    assert {i["code"]: i["declared"] for i in ov["items"]}["rabies"] is None


def test_young_puppy_needs_no_history_and_unsupported_species(db):
    puppy = make_pet(db, dob=date(2026, 10, 20))
    assert build_overview(db, puppy, TODAY)["history_required"] is False
    goat = make_pet(db, species="Goat")
    ov = build_overview(db, goat, TODAY)
    assert ov["supported"] is False and ov["history_required"] is False and ov["items"] == []


def test_cat_rules_are_used_for_cats(db):
    cat = make_pet(db, species="Cat")
    codes = {i["code"] for i in build_overview(db, cat, TODAY)["items"]}
    assert codes == {"fvrcp", "rabies", "felv"}
