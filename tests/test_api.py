"""Isolated local API smoke tests; never write to the real project database."""
import pytest
from fastapi.testclient import TestClient

import db
import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Redirect the API to a temporary database so tests cannot touch the user's DB.
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test_transaction.db")
    with TestClient(main.app) as test_client:
        yield test_client


def transaction_payload():
    return {
        "id": "pytest-smoke-unique-001",
        "amount": 12.5,
        "currency": "USD",
        "description": "local test transaction",
        "timestamp": "2026-10-15T10:00:00Z",
        "metadata": {"source": "pytest"},
    }


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["database"]["integrity"] == "ok"


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_frontend_cors_preflight(client, origin):
    response = client.options(
        "/api/transactions",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_create_idempotency_and_conflict(client):
    tx = transaction_payload()
    first = client.post("/api/transactions", json=tx)
    assert first.status_code == 202, first.text
    assert first.json()["transactionId"] == tx["id"]
    assert first.json()["status"] == "pending"
    assert first.json()["submittedAt"]

    second = client.post("/api/transactions", json=tx)
    assert second.status_code == 202, second.text
    assert second.json()["message"] == "Transaction already exists"

    changed = {**tx, "amount": 13}
    conflict = client.post("/api/transactions", json=changed)
    assert conflict.status_code == 409


def test_rejects_invalid_currency(client):
    tx = {**transaction_payload(), "currency": "US1"}
    response = client.post("/api/transactions", json=tx)
    assert response.status_code == 422


def test_rejects_timestamp_without_timezone(client):
    tx = {**transaction_payload(), "timestamp": "2026-10-15T10:00:00"}
    response = client.post("/api/transactions", json=tx)
    assert response.status_code == 422


def test_metrics_endpoint(client):
    response = client.get("/api/metrics")
    assert response.status_code == 200
    assert "queue_depth" in response.json()["transactions"]
    assert "error_rate" in response.json()["attempts"]
