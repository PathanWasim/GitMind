from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_check() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_unimplemented_analysis_returns_501() -> None:
    client = TestClient(app)

    response = client.get("/api/analysis/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 501
