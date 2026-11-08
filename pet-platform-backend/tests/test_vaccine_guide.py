"""Vaccine guide: content loads and the due-date planner works (pure functions, no database)."""
from datetime import date

from app.services.vaccine_guide import build_guide, build_planner, load_guide

TODAY = date(2026, 11, 8)
DOB = date(2026, 9, 1)


def test_dog_and_cat_content_loads():
    for sp in ("dog", "cat", "goat", "cattle", "buffalo"):
        g = load_guide(sp)
        assert g and g["schedule"] and g["timeline"] and g["rules"] and g["planner"] and g["about"]
    assert load_guide("bird") is None and load_guide("../x") is None
    assert load_guide("buffalo") == load_guide("cattle")


def test_unsupported_species_and_unknown_dob():
    assert build_guide("Bird", DOB, {}, TODAY) == {"supported": False, "species": "bird"}
    assert build_guide("dog", None, {}, TODAY)["planner"] == []


def test_dog_planner_dates_match_the_spreadsheet():
    rows = build_planner(load_guide("dog"), DOB, {"dhppi": [date(2026, 10, 20)]}, TODAY)
    assert rows[0]["due_date"] == date(2026, 10, 20) and rows[0]["status"] == "done"
    assert rows[1]["due_date"] == date(2026, 11, 10) and rows[1]["status"] == "due_soon"
    assert rows[3]["vaccine"].startswith("Rabies") and rows[3]["due_date"] == date(2026, 12, 1)
    assert rows[4]["due_date"] == date(2026, 12, 22) and rows[4]["status"] == "upcoming"
    assert rows[5]["status"] == "optional"  # second rabies dose is optional
    booster = next(r for r in rows if r["dose"] == "Booster" and r["vaccine"] == "DHPP")
    assert booster["due_date"] == date(2027, 3, 2)


def test_earlier_dose_not_entered_but_later_one_on_record():
    # an adult dog with only its latest rabies dose recorded: older rabies rows are "not recorded", not overdue
    rows = build_planner(load_guide("dog"), date(2023, 1, 1), {"rabies": [date(2026, 2, 1)], "leptospirosis": [date(2026, 2, 1)]}, TODAY)
    rabies = [r for r in rows if r["vaccine"].startswith("Rabies") and r["status"] != "optional"]
    assert any(r["status"] == "done" for r in rabies)
    assert any(r["status"] == "not_recorded" for r in rabies)
    assert all(r["status"] != "overdue" for r in rabies if r["due_date"] < date(2026, 1, 1))


def test_cat_planner():
    rows = build_planner(load_guide("cat"), DOB, {"fvrcp": [date(2026, 10, 27)]}, TODAY)
    assert rows[0]["status"] == "done" and rows[1]["due_date"] == date(2026, 11, 24)


def test_schedule_lines_carry_status_last_dose_and_next_due():
    g = build_guide("dog", DOB, {"dhppi": [date(2026, 10, 20)]}, TODAY)
    s = g["schedule"]
    assert len(s) == 12 and s[0]["sno"] == 1 and s[0]["age"] != "Age"
    assert s[0]["status"] == "info"
    assert s[1]["status"] == "done" and s[1]["last_dose"] == date(2026, 10, 20) and s[1]["next_due"] is None
    assert s[2]["status"] == "due_soon" and s[2]["next_due"] == date(2026, 11, 10)
    assert s[3]["status"] == "due_soon" and s[4]["status"] == "upcoming"
    assert s[10]["status"] == "optional"
    assert all(r["status"] is None for r in build_guide("dog", None, {}, TODAY)["schedule"])
    assert g["about"] and g["sources"][0]["url"].startswith("https://")


def test_every_guide_code_exists_in_the_rulebook_and_every_schedule_ref_is_valid():
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location(
        "mig", pathlib.Path(__file__).resolve().parents[1] / "app/migrations/versions/e5f1b7c2d936_vaccine_rules_match_vet_sheets.py")
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    from app.services.vaccine_rules_seed import SEED_RULES
    codes = {"dog": {r[1] for r in SEED_RULES if r[0] == "dog"}, "cat": {r[1] for r in SEED_RULES if r[0] == "cat"}}
    for sp, rules in mig.NEW:
        codes[sp] = {r[0] for r in rules}
    for sp in ("dog", "cat", "goat", "cattle", "buffalo"):
        g = load_guide(sp)
        used = {c for p in g["planner"] for c in p["codes"]}
        assert used <= codes[sp], (sp, used - codes[sp])
        for row in g["schedule"]:
            assert all(0 <= i < len(g["planner"]) for i in row["planner_refs"])


def test_goat_planner_marks_done_pending_and_optional():
    dob = date(2026, 7, 1)
    rows = build_planner(load_guide("goat"), dob, {"fmd": [date(2026, 10, 2)], "anthrax": [date(2026, 10, 5)]}, TODAY)
    assert rows[0]["status"] == "done" and rows[0]["date_given"] == date(2026, 10, 2)
    assert rows[1]["status"] == "overdue"  # HS first dose was due 1 Oct and is not recorded
    assert rows[2]["status"] == "done"  # anthrax is optional but was recorded, so it shows Done
    assert rows[3]["due_date"] == date(2026, 10, 21)  # FMD booster at 16 weeks
    g = build_guide("goat", dob, {}, TODAY)
    assert next(r for r in g["schedule"] if r["vaccine"] == "Anthrax")["status"] == "optional"


def test_cattle_once_in_a_lifetime_rows_are_optional_until_recorded():
    rows = build_planner(load_guide("cattle"), date(2026, 7, 1), {}, TODAY)
    assert rows[0]["status"] == "optional" and rows[4]["status"] == "optional"  # theileriosis, brucellosis
    assert rows[1]["status"] == "overdue"  # FMD 1st dose due 1 Nov
    assert build_guide("buffalo", date(2026, 7, 1), {}, TODAY)["species"] == "cattle"
