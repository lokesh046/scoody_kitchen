import sys
import os
import base64
import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from main import app
from memory.redis_memory import session_memory
from rag.vector_store import vector_store

client = TestClient(app)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789")


def _make_auth_header(user_id: int = 1) -> dict:
    try:
        import jwt
        token = jwt.encode({"sub": str(user_id), "role": "customer"}, JWT_SECRET_KEY, algorithm="HS256")
    except Exception:
        header = base64.b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.b64encode(json.dumps({"sub": str(user_id), "role": "customer"}).encode()).decode().rstrip("=")
        token = f"{header}.{payload}.sig"
    return {"Authorization": f"Bearer {token}"}


def test_knowledge_rag_retrieval_grounded_answer():
    # Query matching Return Policy
    headers = _make_auth_header()
    response = client.post(
        "/chat",
        headers=headers,
        json={
            "message": "What is your return policy for unopened items?",
            "session_id": "test_sess_001",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "return" in data["reply"].lower() or "days" in data["reply"].lower()
    assert len(data["sources"]) > 0
    assert "Return & Refund Policy" in data["sources"][0]


def test_knowledge_rag_anti_hallucination_out_of_scope():
    # Query completely unrelated to pets or store policies
    headers = _make_auth_header()
    with patch.object(vector_store, "search_knowledge", return_value=[]):
        response = client.post(
            "/chat",
            headers=headers,
            json={
                "message": "How do I replace a flat tire on a Toyota Camry?",
                "session_id": "test_sess_002",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "don't have specific official information" in data["reply"] or "AI Assistant" in data["reply"]
        assert len(data["sources"]) == 0


def test_redis_session_memory_multi_turn_and_purge():
    sess_id = "test_sess_multi_001"
    headers = _make_auth_header()
    
    # 1. Clear session
    session_memory.clear_session(sess_id)
    assert len(session_memory.get_history(sess_id)) == 0

    # 2. Turn 1
    response1 = client.post("/chat", headers=headers, json={"message": "Do you offer dog food?", "session_id": sess_id})
    assert response1.status_code == 200
    history1 = session_memory.get_history(sess_id)
    assert len(history1) == 2  # user + assistant

    # 3. Turn 2
    response2 = client.post("/chat", headers=headers, json={"message": "Is it returnable if opened?", "session_id": sess_id})
    assert response2.status_code == 200
    history2 = session_memory.get_history(sess_id)
    assert len(history2) == 4  # 2 user + 2 assistant

    # 4. Purge endpoint
    del_res = client.delete(f"/chat/session/{sess_id}")
    assert del_res.status_code == 200
    assert len(session_memory.get_history(sess_id)) == 0
