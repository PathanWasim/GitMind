from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.chat import ChatStreamRequest
from app.schemas.repository import RepositoryIndexRequest, RepositoryIndexResponse, RepositoryResponse
from app.services.indexing_service import get_indexing_service
from app.services.rag_service import get_rag_service


class FakeIndexingService:
    def __init__(self) -> None:
        self.repository_id = uuid4()

    async def index_repository(self, payload: RepositoryIndexRequest) -> RepositoryIndexResponse:
        return RepositoryIndexResponse(
            repository_id=self.repository_id,
            status="indexed",
            repo_url=str(payload.repository_url).rstrip("/"),
            name="example",
            indexed_files=3,
            chunks=7,
        )

    async def get_repository(self, repository_id: UUID) -> RepositoryResponse:
        return RepositoryResponse(
            id=repository_id,
            url="https://github.com/example/example",
            name="example",
            status="indexed",
            indexed_at=datetime.now(timezone.utc),
            indexed_files=3,
            chunks=7,
        )


class FakeRAGService:
    async def ensure_repository_exists(self, repository_id: UUID) -> None:
        return None

    def generate_answer(self, payload: ChatStreamRequest) -> AsyncIterator[str]:
        return self._stream()

    async def _stream(self) -> AsyncIterator[str]:
        yield 'event: token\ndata: {"text": "Hello "}\n\n'
        yield 'event: token\ndata: {"text": "repo"}\n\n'
        yield 'event: citations\ndata: {"citations": [{"file_path": "README.md", "start_line": 1, "end_line": 4}]}\n\n'


def test_repository_routes_return_frontend_contract() -> None:
    fake_indexing_service = FakeIndexingService()
    app.dependency_overrides[get_indexing_service] = lambda: fake_indexing_service
    client = TestClient(app)

    try:
        index_response = client.post(
            "/api/repositories/index",
            json={"repository_url": "https://github.com/example/example"},
        )
        repository_response = client.get(f"/api/repositories/{fake_indexing_service.repository_id}")
    finally:
        app.dependency_overrides.clear()

    assert index_response.status_code == 200
    assert index_response.json() == {
        "repository_id": str(fake_indexing_service.repository_id),
        "status": "indexed",
        "repo_url": "https://github.com/example/example",
        "name": "example",
        "indexed_files": 3,
        "chunks": 7,
    }
    assert repository_response.status_code == 200
    assert repository_response.json()["id"] == str(fake_indexing_service.repository_id)
    assert repository_response.json()["status"] == "indexed"


def test_chat_stream_route_returns_sse_contract() -> None:
    app.dependency_overrides[get_rag_service] = lambda: FakeRAGService()
    client = TestClient(app)

    try:
        response = client.post(
            "/api/chat/stream",
            json={
                "repository_id": "00000000-0000-0000-0000-000000000001",
                "message": "What is this repo?",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert 'event: token\ndata: {"text": "Hello "}' in response.text
    assert 'event: citations\ndata: {"citations": [{"file_path": "README.md", "start_line": 1, "end_line": 4}]}' in response.text
