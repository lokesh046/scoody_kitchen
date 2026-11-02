"""The photo scan tries the Hostinger router first, then Google directly. These tests stub the heavy
libraries (numpy, onnxruntime, PIL) and the network, so they run anywhere."""
import json
import sys
from unittest.mock import MagicMock

for name in ("numpy", "onnxruntime", "PIL", "PIL.Image", "dotenv"):
    sys.modules.setdefault(name, MagicMock())

import pytest  # noqa: E402

from app.services import pipeline as pl  # noqa: E402

DOG = {
    "is_pet": True,
    "species": "Dog",
    "primary_breed": "Samoyed",
    "confidence": 0.96,
    "top_matches": [{"breed": "Samoyed", "confidence": 0.96, "species": "Dog"}],
    "care_insights": {
        "temperament": "Friendly, gentle",
        "adult_size_category": "Medium (12 - 22 kg)",
        "nutritional_focus": "Lean protein",
        "recommended_recipe": "Chicken",
        "health_watch": ["Coat", "Joints"],
    },
}


@pytest.fixture
def pipe(monkeypatch):
    monkeypatch.setattr(pl, "HOSTINGER_AI_ROUTER_API_KEY", "router-key")
    monkeypatch.setattr(pl, "GEMINI_API_KEY", "google-key")
    return pl.PetVisionPipeline(model_path="/nonexistent.onnx")


def test_router_answer_is_used_first(pipe, monkeypatch):
    monkeypatch.setattr(pipe, "_call_router", lambda *a: json.dumps(DOG))
    google = MagicMock()
    monkeypatch.setattr(pipe, "_call_google", google)
    res = pipe._predict_with_vision_models(b"img", "image/jpeg")
    assert res.primary_breed == "Samoyed" and res.is_pet is True
    google.assert_not_called()


def test_google_takes_over_when_the_router_fails(pipe, monkeypatch):
    def boom(*a):
        raise RuntimeError("router timed out")

    monkeypatch.setattr(pipe, "_call_router", boom)
    monkeypatch.setattr(pipe, "_call_google", lambda *a: json.dumps(DOG))
    res = pipe._predict_with_vision_models(b"img", "image/jpeg")
    assert res.primary_breed == "Samoyed"


def test_unreadable_router_reply_falls_back_to_google(pipe, monkeypatch):
    monkeypatch.setattr(pipe, "_call_router", lambda *a: "not json at all")
    monkeypatch.setattr(pipe, "_call_google", lambda *a: json.dumps(DOG))
    assert pipe._predict_with_vision_models(b"img", "image/jpeg").primary_breed == "Samoyed"


def test_none_when_every_route_fails(pipe, monkeypatch):
    def boom(*a):
        raise RuntimeError("down")

    monkeypatch.setattr(pipe, "_call_router", boom)
    monkeypatch.setattr(pipe, "_call_google", boom)
    assert pipe._predict_with_vision_models(b"img", "image/jpeg") is None


def test_no_keys_means_no_online_routes(pipe, monkeypatch):
    monkeypatch.setattr(pl, "HOSTINGER_AI_ROUTER_API_KEY", None)
    monkeypatch.setattr(pl, "GEMINI_API_KEY", None)
    assert pipe._predict_with_vision_models(b"img", "image/jpeg") is None


def test_not_a_pet_is_reported(pipe, monkeypatch):
    monkeypatch.setattr(pipe, "_call_router", lambda *a: json.dumps({"is_pet": False}))
    res = pipe._predict_with_vision_models(b"img", "image/jpeg")
    assert res.is_pet is False and "No companion" in res.error_message


def test_json_inside_a_code_fence_is_accepted(pipe):
    fenced = "```json\n" + json.dumps(DOG) + "\n```"
    assert pipe._extract_json(fenced)["primary_breed"] == "Samoyed"


def test_router_request_shape(pipe, monkeypatch):
    seen = {}

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": json.dumps(DOG)}}],
                    "usage": {"prompt_tokens": 1849, "completion_tokens": 260, "total_tokens": 2109}}

    class FakeClient:
        def __init__(self, timeout=None):
            seen["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, json=None, headers=None):
            seen.update(url=url, payload=json, headers=headers)
            return FakeResponse()

    monkeypatch.setattr(pl.httpx, "Client", FakeClient)
    out = pipe._call_router("PROMPT", "QUJD", "image/jpeg")
    assert json.loads(out)["primary_breed"] == "Samoyed"
    assert seen["url"] == "https://router.hostinger.com/v1/chat/completions"
    assert seen["payload"]["model"] == "gemini-3.1-flash-lite"
    parts = seen["payload"]["messages"][0]["content"]
    assert parts[0] == {"type": "text", "text": "PROMPT"}
    assert parts[1]["image_url"]["url"] == "data:image/jpeg;base64,QUJD"
    assert seen["headers"]["Authorization"] == "Bearer router-key"
    assert seen["headers"]["User-Agent"]
    assert seen["timeout"] == pl.ROUTER_TIMEOUT_SECONDS
