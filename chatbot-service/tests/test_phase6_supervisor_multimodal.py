import io
import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from main import app
from agents.supervisor import route_intent

client = TestClient(app)


def test_supervisor_intent_classification():
    # Health queries
    assert route_intent("My cat is vomiting and sick") == "health_agent"
    assert route_intent("Dog is bleeding severely") == "health_agent"

    # Commerce queries
    assert route_intent("Where is my order #101?") == "commerce_agent"
    assert route_intent("Search dog food products in stock") == "commerce_agent"

    # Knowledge queries
    assert route_intent("What is your store return policy?") == "knowledge_agent"


def test_multimodal_voice_chat_endpoint():
    audio_content = b"RIFF....WAVEfmt ....data...."  # Simulated WAV audio
    
    response = client.post(
        "/chat/voice",
        files={"file": ("speech.wav", io.BytesIO(audio_content), "audio/wav")},
        data={"session_id": "test_voice_sess_01"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Transcribed Speech" in data["reply"]


def test_multimodal_image_chat_endpoint():
    image_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00..."  # Simulated JPEG image
    
    response = client.post(
        "/chat/image",
        files={"file": ("pet_rash.jpg", io.BytesIO(image_content), "image/jpeg")},
        data={
            "message": "My dog has a red rash on his ear",
            "session_id": "test_image_sess_01",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "reply" in data
