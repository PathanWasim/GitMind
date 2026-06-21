from __future__ import annotations

import shutil
from pathlib import Path
from uuid import UUID

import chromadb
import pytest

from app.schemas.chat import ChatStreamRequest
from app.schemas.repository import RepositoryIndexRequest
from app.services.indexing_service import IndexingService
from app.services.rag_service import RAGService
from app.storage.repository_store import RepositoryStore


class FakeGitHubService:
    def __init__(self, source_repository: Path) -> None:
        self.source_repository = source_repository

    async def clone_repository(self, repository_url: str, destination: Path) -> Path:
        shutil.copytree(self.source_repository, destination)
        return destination

    async def validate_repository(self, repository_url: str) -> bool:
        return True


def fake_embed_texts(texts: list[str]) -> list[list[float]]:
    return [[float(len(text)), float("README" in text), 1.0] for text in texts]


def fake_embed_query(text: str) -> list[float]:
    return [float(len(text)), 1.0, 1.0]


class FakeOpenAIChunk:
    def __init__(self, content: str) -> None:
        self.content = content


class FakeChatOpenAI:
    captured_messages: list[object] = []

    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs

    async def astream(self, messages: list[object]):
        FakeChatOpenAI.captured_messages = messages
        yield FakeOpenAIChunk("The repository contains ")
        yield FakeOpenAIChunk("a README.")


@pytest.mark.anyio
async def test_indexing_and_rag_stream_return_source_citations(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source_repository = tmp_path / "source-repo"
    source_repository.mkdir()
    (source_repository / "README").write_text("GitMind test repository\n", encoding="utf-8")
    (source_repository / "app.py").write_text("def hello() -> str:\n    return 'world'\n", encoding="utf-8")
    ignored_directory = source_repository / "node_modules"
    ignored_directory.mkdir()
    (ignored_directory / "ignored.js").write_text("console.log('ignored')\n", encoding="utf-8")

    state_file = tmp_path / "state" / "repositories.json"
    repository_store = RepositoryStore(str(state_file))
    chroma_client = chromadb.PersistentClient(path=str(tmp_path / "chroma"))

    monkeypatch.setattr("app.services.indexing_service.embed_texts", fake_embed_texts)
    monkeypatch.setattr("app.services.rag_service.embed_query", fake_embed_query)

    indexing_service = IndexingService(
        github_service=FakeGitHubService(source_repository),
        store=repository_store,
    )
    indexing_service.settings.repository_storage_directory = str(tmp_path / "repos")
    indexing_service.chroma_client = chroma_client

    index_response = await indexing_service.index_repository(
        RepositoryIndexRequest(repository_url="https://github.com/example/gitmind-test")
    )

    assert index_response.status == "indexed"
    assert index_response.indexed_files == 2
    assert index_response.chunks == 2

    rag_service = RAGService(store=repository_store)
    rag_service.chroma_client = chroma_client
    rag_service.settings.openai_api_key = ""

    stream = rag_service.generate_answer(
        ChatStreamRequest(
            repository_id=UUID(str(index_response.repository_id)),
            message="What does the README say?",
        )
    )
    streamed_text = "".join([event async for event in stream])

    assert "event: token" in streamed_text
    assert "event: citations" in streamed_text
    assert "README" in streamed_text


@pytest.mark.anyio
async def test_openai_streaming_branch_returns_llm_tokens_and_citations(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source_repository = tmp_path / "source-repo"
    source_repository.mkdir()
    (source_repository / "README").write_text("GitMind test repository\n", encoding="utf-8")

    state_file = tmp_path / "state" / "repositories.json"
    repository_store = RepositoryStore(str(state_file))
    chroma_client = chromadb.PersistentClient(path=str(tmp_path / "chroma"))

    monkeypatch.setattr("app.services.indexing_service.embed_texts", fake_embed_texts)
    monkeypatch.setattr("app.services.rag_service.embed_query", fake_embed_query)
    monkeypatch.setattr("app.services.rag_service.ChatOpenAI", FakeChatOpenAI)

    indexing_service = IndexingService(
        github_service=FakeGitHubService(source_repository),
        store=repository_store,
    )
    indexing_service.settings.repository_storage_directory = str(tmp_path / "repos")
    indexing_service.chroma_client = chroma_client

    index_response = await indexing_service.index_repository(
        RepositoryIndexRequest(repository_url="https://github.com/example/gitmind-test")
    )

    rag_service = RAGService(store=repository_store)
    rag_service.chroma_client = chroma_client
    rag_service.settings.openai_api_key = "test-key"
    rag_service.settings.openai_model = "test-model"

    stream = rag_service.generate_answer(
        ChatStreamRequest(
            repository_id=UUID(str(index_response.repository_id)),
            message="Summarize this repository.",
        )
    )
    streamed_text = "".join([event async for event in stream])

    assert 'data: {"text": "The repository contains "}' in streamed_text
    assert 'data: {"text": "a README."}' in streamed_text
    assert "event: citations" in streamed_text
    assert "README" in streamed_text
    assert any("Repository context" in str(message.content) for message in FakeChatOpenAI.captured_messages)
