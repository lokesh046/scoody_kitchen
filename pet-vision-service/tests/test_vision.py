import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "pet-vision-service"
    assert data["model_loaded"] is True


def test_classify_valid_image(client):
    # Create a synthetic test RGB image in RAM
    img = Image.new("RGB", (300, 300), color=(180, 140, 90))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)

    response = client.post(
        "/api/v1/classify",
        files={"file": ("test_pet.jpg", buffer, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "is_pet" in data
    assert data["processing_time_ms"] > 0.0


def test_classify_reject_invalid_mime(client):
    response = client.post(
        "/api/v1/classify",
        files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
    )
    assert response.status_code == 400
    assert "Invalid image format" in response.json()["detail"]


def test_classify_reject_empty_file(client):
    response = client.post(
        "/api/v1/classify",
        files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]
