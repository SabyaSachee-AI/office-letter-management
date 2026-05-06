from fastapi.testclient import TestClient

from app.main import app


def test_validation_error_envelope():
    client = TestClient(app)
    r = client.post("/api/v1/auth/login", data={})
    assert r.status_code == 422
    body = r.json()
    assert body.get("code") == "validation_error"
    assert "message" in body and "Validation failed" in body["message"]
    assert "field_errors" in body and isinstance(body["field_errors"], list)


def test_http_error_envelope():
    client = TestClient(app)
    r = client.get("/api/v1/users/me")
    assert r.status_code == 401
    body = r.json()
    assert body.get("code") == "unauthorized"
    assert isinstance(body.get("message"), str)
    assert body["message"] == body["detail"]


def test_letter_attachment_requires_auth():
    client = TestClient(app)
    r = client.get("/api/v1/letters/1/attachment")
    assert r.status_code == 401
