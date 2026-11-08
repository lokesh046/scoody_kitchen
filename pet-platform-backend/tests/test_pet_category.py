"""Dog category: worked out from the breed, stored on the pet. In-memory SQLite only."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
import app.models  # noqa: F401
from app.models.pet import Pet
from app.schemas.pet import PetCreate, PetUpdate
from app.services.breed_category import CATEGORIES, BREEDS, category_for_breed, resolve_category
from app.services.pet_service import create_pet, update_pet


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[Pet.__table__])
    s = sessionmaker(bind=engine)()
    yield s
    s.close()


def test_all_202_breeds_map_to_one_of_four_categories():
    assert len(BREEDS) == 202
    assert {c for _, c in BREEDS} == set(CATEGORIES)
    assert all(category_for_breed(name) == cat for name, cat in BREEDS if name not in {"x"})


@pytest.mark.parametrize("breed,expected", [
    ("Golden Retriever", "Sporting"), ("labrador retriever", "Sporting"), ("Labrador", "Sporting"),
    ("my Golden Retriever mix", "Sporting"), ("German Shepherd Dog", "Working"), ("Beagle", "Hound"),
    ("Pug", "Companion"), ("Border Collie", "Working"), ("Pomeranian", "Companion"),
    ("Indian Pariah", None), ("", None), (None, None),
])
def test_breed_to_category(breed, expected):
    assert category_for_breed(breed) == expected


def test_only_dogs_get_a_category_and_breed_beats_manual_choice():
    assert resolve_category("Cat", "Persian", "Hound") is None
    assert resolve_category("Dog", "Beagle", "Companion") == "Hound"        # recognised breed decides
    assert resolve_category("Dog", "Indian Pariah", "Working") == "Working"  # unknown breed: owner's choice
    assert resolve_category("Dog", "Indian Pariah", None) is None
    assert resolve_category("dog", None, "bogus") is None


def test_create_stores_category(db):
    p = create_pet(db, PetCreate(name="Rex", species="Dog", breed="Golden Retriever"), 1)
    assert p.category == "Sporting"
    q = create_pet(db, PetCreate(name="Desi", species="Dog", breed="Indian Pariah", category="Working"), 1)
    assert q.category == "Working"
    c = create_pet(db, PetCreate(name="Tom", species="Cat", breed="Persian", category="Hound"), 1)
    assert c.category is None


def test_update_keeps_category_in_step_with_breed_and_species(db):
    p = create_pet(db, PetCreate(name="Rex", species="Dog", breed="Golden Retriever"), 1)
    update_pet(db, p, PetUpdate(breed="Beagle"))
    assert p.category == "Hound"
    update_pet(db, p, PetUpdate(breed="Mixed local"))      # unrecognised breed: previous category kept as the owner's choice
    assert p.category == "Hound"
    update_pet(db, p, PetUpdate(category="Companion"))
    assert p.category == "Companion"
    update_pet(db, p, PetUpdate(name="Rexy"))              # unrelated edit leaves it alone
    assert p.category == "Companion"
    update_pet(db, p, PetUpdate(species="Cat"))
    assert p.category is None


def test_invalid_category_rejected_by_schema():
    with pytest.raises(Exception):
        PetCreate(name="Rex", species="Dog", category="Toy")


@pytest.mark.parametrize("value,expected", [
    ("985112345678901", "985112345678901"),        # a normal 15-digit chip
    ("9851 1234-5678 901", "985112345678901"),     # pasted with spaces/dashes: dropped
    ("1" * 30, "1" * 30),                          # the new upper limit
    ("", None), (None, None), ("   ", None),
])
def test_microchip_accepts_digits_up_to_30(value, expected):
    assert PetCreate(name="Rex", species="Dog", microchip_number=value).microchip_number == expected


@pytest.mark.parametrize("value", ["1" * 31, "12345678", "98511234abc5678", "985112345678901x"])
def test_microchip_rejects_letters_too_short_or_too_long(value):
    with pytest.raises(Exception):
        PetCreate(name="Rex", species="Dog", microchip_number=value)
