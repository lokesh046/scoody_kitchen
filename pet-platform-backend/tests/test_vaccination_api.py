"""Vaccination endpoints: the vaccine card photo is mandatory. In-memory SQLite and a fake photo store only."""
import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa: F401
from app.dependencies.auth import get_current_user
from app.main import app
from app.models.pet import Pet
from app.models.vaccination import PetVaccination, PetVaccineDeclaration, VaccineSchedule
from app.services.vaccine_rules_seed import SEED_RULES

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


class FakeStorage:
    uploaded: list[str] = []
    deleted: list[str] = []

    def upload_image(self, file_bytes, original_filename, content_type):
        url = f"http://test/uploads/{len(self.uploaded)}-{original_filename}"
        self.uploaded.append(url)
        return url

    def delete_image(self, url):
        self.deleted.append(url)


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[
        VaccineSchedule.__table__, PetVaccination.__table__, PetVaccineDeclaration.__table__, Pet.__table__])
    Session = sessionmaker(bind=engine)
    with Session() as s:
        for i, (sp, code, name, cat, desc, fw, sd, si, bm, rm) in enumerate(SEED_RULES):
            s.add(VaccineSchedule(species=sp, code=code, name=name, category=cat, description=desc,
                                  first_dose_weeks=fw, series_doses=sd, series_interval_weeks=si,
                                  booster_months=bm, repeat_months=rm, sort_order=i))
        s.add(Pet(id=1, user_id=1, name="Rex", species="Dog", breed="Lab", date_of_birth=date(2024, 1, 1)))
        s.add(Pet(id=2, user_id=2, name="Other", species="Dog", breed="Lab", date_of_birth=date(2024, 1, 1)))
        s.commit()

    def _db():
        with Session() as s:
            yield s

    FakeStorage.uploaded, FakeStorage.deleted = [], []
    fake = FakeStorage()
    monkeypatch.setattr("app.api.vaccinations.get_storage_provider", lambda: fake)
    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: type("U", (), {"id": 1})()
    app.state.limiter.enabled = False
    yield TestClient(app), Session
    app.dependency_overrides.clear()


def dose_form(**over):
    d = {"vaccine_code": "rabies", "date_given": (date.today() - timedelta(days=20)).isoformat(), "clinic_name": "PetCare"}
    d.update(over)
    return d


def test_dose_without_photo_is_rejected_and_nothing_saved(client):
    c, Session = client
    r = c.post("/pets/1/vaccinations", data=dose_form())
    assert r.status_code == 400 and "photo" in r.json()["detail"].lower()
    with Session() as s:
        assert s.query(PetVaccination).count() == 0


def test_dose_with_photo_is_saved_with_url(client):
    c, Session = client
    r = c.post("/pets/1/vaccinations", data=dose_form(), files={"image": ("card.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    assert r.json()["image_url"].startswith("http://test/uploads/")


def test_dose_with_non_image_file_is_rejected(client):
    c, _ = client
    r = c.post("/pets/1/vaccinations", data=dose_form(), files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_dose_for_someone_elses_pet_is_404(client):
    c, _ = client
    r = c.post("/pets/2/vaccinations", data=dose_form(), files={"image": ("card.png", PNG, "image/png")})
    assert r.status_code == 404


def history_answers(**over):
    given_date = (date.today() - timedelta(days=30)).isoformat()
    a = [{"vaccine_code": "dhppi", "answer": "given", "date_given": given_date},
         {"vaccine_code": "rabies", "answer": "unknown"}]
    return a


def test_history_given_without_photo_rejected_and_nothing_saved(client):
    c, Session = client
    r = c.put("/pets/1/vaccinations/history", data={"answers": json.dumps(history_answers())})
    assert r.status_code == 400 and "photo" in r.json()["detail"].lower()
    with Session() as s:
        assert s.query(PetVaccination).count() == 0 and s.query(PetVaccineDeclaration).count() == 0
    assert FakeStorage.uploaded == []


def test_history_with_photo_saves_everything(client):
    c, Session = client
    r = c.put("/pets/1/vaccinations/history", data={"answers": json.dumps(history_answers())},
              files={"photo_dhppi": ("card.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["history_complete"] is True and len(body["records"]) == 1
    assert body["records"][0]["image_url"].startswith("http://test/uploads/")


def test_history_missing_core_vaccine_uploads_nothing(client):
    c, _ = client
    only_one = [history_answers()[0]]
    r = c.put("/pets/1/vaccinations/history", data={"answers": json.dumps(only_one)},
              files={"photo_dhppi": ("card.png", PNG, "image/png")})
    assert r.status_code == 400 and "Please answer" in r.json()["detail"]
    assert FakeStorage.uploaded == []


def test_vaccination_card_is_owner_only_escaped_html(client):
    c, Session = client
    with Session() as s:
        s.get(Pet, 1).name = "<script>x</script>"
        s.commit()
    c.post("/pets/1/vaccinations", data=dose_form(clinic_name="<b>Clinic</b>"), files={"image": ("c.png", PNG, "image/png")})
    r = c.get("/pets/1/vaccinations/card")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    assert "<script>x</script>" not in r.text and "&lt;script&gt;x&lt;/script&gt;" in r.text
    assert "<b>Clinic</b>" not in r.text and "&lt;b&gt;Clinic&lt;/b&gt;" in r.text
    assert "Vaccination card" in r.text and "Rabies" in r.text
    assert c.get("/pets/2/vaccinations/card").status_code == 404


# ---- admin rule editor ----
from app.dependencies.auth import require_role  # noqa: E402
from app.models.enums import UserRole  # noqa: E402


def as_admin():
    # require_role(...) builds a new dependency each call; override the one the router uses.
    from app.api.admin_vaccine_rules import router
    for route in router.routes:
        for dep in route.dependant.dependencies:
            if dep.call.__name__ == "role_checker":
                app.dependency_overrides[dep.call] = lambda: type("U", (), {"id": 9, "role": UserRole.ADMIN})()


def test_admin_rules_crud_and_review_reset(client):
    c, _ = client
    as_admin()
    rules = c.get("/admin/vaccine-rules").json()
    assert {r["species"] for r in rules} == {"dog", "cat"}
    new = c.post("/admin/vaccine-rules", json={
        "species": "Goat", "code": "CD_T", "name": "CD&T", "category": "core", "first_dose_weeks": 8,
        "series_doses": 2, "series_interval_weeks": 4, "booster_months": 12, "repeat_months": 12})
    assert new.status_code == 201 and new.json()["species"] == "goat" and new.json()["vet_reviewed"] is False
    dup = c.post("/admin/vaccine-rules", json={"species": "goat", "code": "cd_t", "name": "x1", "first_dose_weeks": 1})
    assert dup.status_code == 409
    rid = new.json()["id"]
    ok = c.patch(f"/admin/vaccine-rules/{rid}", json={"vet_reviewed": True})
    assert ok.json()["vet_reviewed"] is True
    changed = c.patch(f"/admin/vaccine-rules/{rid}", json={"booster_months": 6})
    assert changed.json()["booster_months"] == 6 and changed.json()["vet_reviewed"] is False  # edit clears the sign-off
    both = c.patch(f"/admin/vaccine-rules/{rid}", json={"booster_months": 9, "vet_reviewed": True})
    assert both.json()["vet_reviewed"] is True
    assert c.patch(f"/admin/vaccine-rules/{rid}", json={"series_doses": 0}).status_code == 422
    assert c.patch("/admin/vaccine-rules/9999", json={"name": "zz"}).status_code == 404


def test_bad_species_or_code_rejected(client):
    c, _ = client
    as_admin()
    assert c.post("/admin/vaccine-rules", json={"species": "d", "code": "ok_code", "name": "Name", "first_dose_weeks": 1}).status_code == 422
    assert c.post("/admin/vaccine-rules", json={"species": "dog", "code": "bad code!", "name": "Name", "first_dose_weeks": 1}).status_code == 422


def test_customer_cannot_use_admin_rule_editor(client):
    c, _ = client
    app.dependency_overrides[get_current_user] = lambda: type("U", (), {"id": 1, "role": UserRole.CUSTOMER, "is_active": True})()
    assert c.get("/admin/vaccine-rules").status_code == 403
    assert c.post("/admin/vaccine-rules", json={"species": "goat", "code": "cdt", "name": "CDT", "first_dose_weeks": 8}).status_code == 403
    assert c.patch("/admin/vaccine-rules/1", json={"vet_reviewed": True}).status_code == 403
