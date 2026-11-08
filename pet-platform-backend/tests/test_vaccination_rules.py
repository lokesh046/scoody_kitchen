"""Due-date logic for vaccination records (pure functions, no database)."""
from datetime import date
from types import SimpleNamespace

from app.services.vaccination_service import add_months, compute_vaccine_status

TODAY = date(2026, 11, 7)

DHPPI = SimpleNamespace(code="dhppi", name="DHPPi", category="core", description=None, vet_reviewed=False,
                        first_dose_weeks=6, series_doses=3, series_interval_weeks=3, booster_months=12, repeat_months=36)
RABIES = SimpleNamespace(code="rabies", name="Rabies", category="core", description=None, vet_reviewed=False,
                         first_dose_weeks=12, series_doses=1, series_interval_weeks=0, booster_months=12, repeat_months=12)
KENNEL = SimpleNamespace(code="bordetella", name="Kennel cough", category="non_core", description=None, vet_reviewed=False,
                         first_dose_weeks=8, series_doses=1, series_interval_weeks=0, booster_months=12, repeat_months=12)


def test_add_months_clamps_to_month_end():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 11, 7), 12) == date(2027, 11, 7)
    assert add_months(date(2028, 2, 29), 12) == date(2029, 2, 28)


def test_new_puppy_first_dose_is_upcoming():
    r = compute_vaccine_status(DHPPI, date(2026, 11, 1), [], TODAY)
    assert r["next_due_date"] == date(2026, 12, 13)  # 6 weeks after birth
    assert r["status"] == "upcoming"


def test_puppy_first_dose_due_soon():
    r = compute_vaccine_status(DHPPI, date(2026, 10, 1), [], TODAY)  # 6 weeks -> 12 Nov
    assert r["status"] == "due_soon"


def test_adult_dog_never_vaccinated_is_overdue():
    r = compute_vaccine_status(RABIES, date(2023, 1, 1), [], TODAY)
    assert r["status"] == "overdue"


def test_unknown_birth_date_core_is_not_started():
    r = compute_vaccine_status(DHPPI, None, [], TODAY)
    assert r["status"] == "not_started" and r["next_due_date"] is None


def test_non_core_never_given_is_optional():
    r = compute_vaccine_status(KENNEL, date(2020, 1, 1), [], TODAY)
    assert r["status"] == "optional" and r["next_due_date"] is None


def test_series_next_dose_uses_interval():
    r = compute_vaccine_status(DHPPI, date(2026, 9, 1), [date(2026, 10, 15)], TODAY)
    assert r["next_due_date"] == date(2026, 11, 5) and r["status"] == "overdue"
    assert r["doses_given"] == 1 and r["series_doses"] == 3


def test_booster_after_completed_series_then_repeat():
    series = [date(2025, 1, 1), date(2025, 1, 22), date(2025, 2, 12)]
    r = compute_vaccine_status(DHPPI, date(2024, 11, 1), series, TODAY)
    assert r["next_due_date"] == date(2026, 2, 12)  # +12 months
    r2 = compute_vaccine_status(DHPPI, date(2024, 11, 1), series + [date(2026, 2, 12)], TODAY)
    assert r2["next_due_date"] == date(2029, 2, 12)  # +36 months
    assert r2["status"] == "upcoming"


def test_yearly_rabies_due_soon_then_overdue():
    r = compute_vaccine_status(RABIES, date(2020, 1, 1), [date(2025, 11, 20)], TODAY)
    assert r["next_due_date"] == date(2026, 11, 20) and r["status"] == "due_soon"
    r = compute_vaccine_status(RABIES, date(2020, 1, 1), [date(2025, 10, 1)], TODAY)
    assert r["status"] == "overdue"


def test_dose_order_does_not_matter():
    a = compute_vaccine_status(DHPPI, date(2026, 9, 1), [date(2026, 10, 1), date(2026, 9, 12)], TODAY)
    b = compute_vaccine_status(DHPPI, date(2026, 9, 1), [date(2026, 9, 12), date(2026, 10, 1)], TODAY)
    assert a == b and a["last_given_date"] == date(2026, 10, 1)


def test_declared_not_vaccinated_core_is_overdue_and_optional_unaffected():
    r = compute_vaccine_status(RABIES, None, [], TODAY, "unknown")
    assert r["status"] == "overdue" and r["declared"] == "unknown" and r["next_due_date"] is None
    k = compute_vaccine_status(KENNEL, date(2025, 1, 1), [], TODAY, "not_vaccinated")
    assert k["status"] == "optional"


def test_recent_flag_is_ninety_days():
    assert compute_vaccine_status(RABIES, date(2020, 1, 1), [date(2026, 8, 20)], TODAY)["recent"] is True
    assert compute_vaccine_status(RABIES, date(2020, 1, 1), [date(2026, 7, 1)], TODAY)["recent"] is False


def test_history_required_only_for_older_pets():
    from app.services.vaccination_service import history_required
    pet = lambda dob: SimpleNamespace(date_of_birth=dob)
    assert history_required(pet(date(2026, 10, 1)), TODAY) is False   # about 5 weeks old
    assert history_required(pet(date(2025, 11, 1)), TODAY) is True    # 1 year old
    assert history_required(pet(None), TODAY) is True                 # unknown birth date


def test_adult_dose_finishes_the_starter_series():
    # one DHPP dose recorded when the dog was already 2 years old: next due is the adult booster, not "dose 2"
    r = compute_vaccine_status(DHPPI, date(2024, 1, 1), [date(2026, 1, 10)], TODAY)
    assert r["next_due_date"] == date(2027, 1, 10) and r["status"] == "upcoming"


def test_booster_in_weeks_and_once_in_a_lifetime_vaccines():
    from types import SimpleNamespace
    pup = SimpleNamespace(code="dhppi", name="DHPPi", category="core", description=None, vet_reviewed=False,
                          first_dose_weeks=7, series_doses=4, series_interval_weeks=3,
                          booster_months=12, repeat_months=36, booster_weeks=10)
    dob = date(2026, 5, 1)
    given = [date(2026, 6, 19), date(2026, 7, 10), date(2026, 7, 31), date(2026, 8, 21)]
    assert compute_vaccine_status(pup, dob, given[:2], TODAY)["next_due_date"] == date(2026, 7, 31)
    assert compute_vaccine_status(pup, dob, given, TODAY)["next_due_date"] == date(2026, 10, 30)  # 16 weeks + 10 weeks
    once = SimpleNamespace(code="theileriosis", name="Theileriosis", category="non_core", description=None,
                           vet_reviewed=False, first_dose_weeks=13, series_doses=1, series_interval_weeks=0,
                           booster_months=0, repeat_months=0, booster_weeks=None)
    assert compute_vaccine_status(once, dob, [], TODAY)["status"] == "optional"
    done = compute_vaccine_status(once, dob, [date(2026, 8, 1)], TODAY)
    assert done["status"] == "complete" and done["next_due_date"] is None
