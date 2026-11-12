import asyncio
from unittest.mock import patch

from app.services import places_service as ps


def _place(pid, name, lat=25.0, lng=55.0):
    return {"id": pid, "displayName": {"text": name}, "formattedAddress": "addr", "location": {"latitude": lat, "longitude": lng}}


def _search(category, by_kind):
    """Run the search with Google faked. by_kind maps 'pet_store'/'text'/'pharmacy' -> list of places (or None = failed)."""
    calls = []

    async def fake_run(url, body, headers):
        kind = "text" if url == ps.PLACES_TEXT_SEARCH_URL else body["includedTypes"][0]
        calls.append(kind)
        places = by_kind.get(kind)
        return None if places is None else {"places": places}

    with patch.object(ps, "_run_places_request", fake_run), patch.object(ps.cache, "get", return_value=None), \
            patch.object(ps.cache, "set"), patch.object(ps.settings, "GOOGLE_PLACES_API_KEY", "k"):
        return asyncio.run(ps.search_nearby_vet_clinics(25.0, 55.0, 5.0, category=category)), calls


def test_pet_shops_are_shown_and_ordinary_pharmacies_are_not_asked_for():
    result, calls = _search("pharmacy", {"pet_store": [_place("a", "Pet Shop")], "text": [], "pharmacy": [_place("p", "Drugstore")]})
    assert [r["name"] for r in result] == ["Pet Shop"]
    assert "pharmacy" not in calls


def test_falls_back_to_ordinary_pharmacies_when_no_pet_shop():
    result, calls = _search("pharmacy", {"pet_store": [], "text": [], "pharmacy": [_place("p", "Drugstore")]})
    assert [r["name"] for r in result] == ["Drugstore"]
    assert "pharmacy" in calls


def test_text_search_pet_pharmacy_counts_as_a_pet_result():
    result, _ = _search("pharmacy", {"pet_store": [], "text": [_place("t", "Vet Pharmacy")], "pharmacy": [_place("p", "Drugstore")]})
    assert [r["name"] for r in result] == ["Vet Pharmacy"]


def test_all_calls_failing_returns_none_and_clinic_search_unchanged():
    assert _search("pharmacy", {"pet_store": None, "text": None, "pharmacy": None})[0] is None
    result, calls = _search("clinic", {"veterinary_care": [_place("c", "Vet Clinic")]})
    assert [r["name"] for r in result] == ["Vet Clinic"] and calls == ["veterinary_care"]
