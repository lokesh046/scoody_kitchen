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

client = TestClient(app)

import jwt
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "test_jwt_secret_key_123456789_long_key_for_sha256")
admin_token = jwt.encode({"sub": "999", "role": "admin"}, JWT_SECRET_KEY, algorithm="HS256")
ADMIN_COOKIES = {"access_token": admin_token}
NON_ADMIN_COOKIES = {"access_token": "invalid_user_token"}


def test_rag_admin_unauthorized_rejection():
    # 1. Request with NO Auth Header -> 401 Unauthorized
    res_no_auth = client.get("/rag/documents")
    assert res_no_auth.status_code == 401

    # 2. Upload request with invalid Auth Token -> 401/403 Error
    content = b"Some document text"
    res_bad_auth = client.post(
        "/rag/upload",
        cookies=NON_ADMIN_COOKIES,
        files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
    )
    assert res_bad_auth.status_code in [401, 403]


def test_upload_text_file_rag_ingestion_with_admin_auth():
    content = b"Scooby Kitchen Special Dog Training Guide: Always use positive reinforcement when teaching your dog new commands like sit, stay, and recall."
    
    response = client.post(
        "/rag/upload",
        cookies=ADMIN_COOKIES,
        files={"file": ("training_guide.txt", io.BytesIO(content), "text/plain")},
        data={"title": "Dog Training Guide", "category": "training"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["title"] == "Dog Training Guide"
    assert data["chunks_indexed"] >= 1

    # Query public chatbot for training advice
    chat_res = client.post(
        "/chat",
        cookies=ADMIN_COOKIES,
        json={"message": "positive reinforcement training", "session_id": "test_upload_sess_01"},
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert "positive reinforcement" in chat_data["reply"].lower() or "training" in chat_data["reply"].lower()


def test_list_and_delete_documents_with_admin_auth():
    # 1. List docs as Admin
    list_res = client.get("/rag/documents", cookies=ADMIN_COOKIES)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert isinstance(docs, list)
    assert len(docs) > 0

    # 2. Delete doc as Admin
    target_id = docs[0]["doc_id"]
    del_res = client.delete(f"/rag/documents/{target_id}", cookies=ADMIN_COOKIES)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"
