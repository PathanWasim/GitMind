from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.schemas.repository import RepositoryIndexRequest, RepositoryIndexResponse, RepositoryResponse
from app.services.embedding_service import embed_texts
from app.services.github_service import GitHubService
from app.storage.repository_store import RepositoryStore
from app.vector.chroma_client import get_chroma_client

SUPPORTED_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".go",
    ".rs",
    ".c",
    ".cc",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".swift",
    ".kt",
    ".kts",
    ".scala",
    ".sql",
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".sh",
    ".bash",
    ".ps1",
    ".html",
    ".css",
    ".scss",
}

SUPPORTED_FILENAMES = {
    "Dockerfile",
    "Makefile",
    "README",
    "LICENSE",
    "CHANGELOG",
    "CONTRIBUTING",
}

IGNORED_DIRECTORIES = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".next",
    ".nuxt",
    "coverage",
}

MAX_FILE_BYTES = 350_000
CHUNK_LINES = 80
CHUNK_OVERLAP = 15
BATCH_SIZE = 64


class IndexingService:
    def __init__(
        self,
        github_service: GitHubService | None = None,
        store: RepositoryStore | None = None,
    ) -> None:
        settings = get_settings()
        self.settings = settings
        self.github_service = github_service or GitHubService()
        self.store = store or RepositoryStore(settings.repository_state_file)
        self.chroma_client = get_chroma_client()

    async def index_repository(self, payload: RepositoryIndexRequest) -> RepositoryIndexResponse:
        repository_url = str(payload.repository_url).rstrip("/")
        repository_id = uuid4()
        repository_name = self._repository_name(repository_url)
        repository_path = Path(self.settings.repository_storage_directory) / str(repository_id)

        try:
            await self.github_service.clone_repository(repository_url, repository_path)
            file_paths = await self.process_files(repository_path)
            chunks = await self.create_chunks(file_paths)
            await self._index_chunks(repository_id, repository_url, chunks)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            self.store.upsert_repository(
                {
                    "id": str(repository_id),
                    "url": repository_url,
                    "name": repository_name,
                    "status": "failed",
                    "indexed_at": None,
                    "indexed_files": 0,
                    "chunks": 0,
                    "error_message": str(exc),
                }
            )
            raise

        indexed_at = datetime.now(timezone.utc).isoformat()
        self.store.upsert_repository(
            {
                "id": str(repository_id),
                "url": repository_url,
                "name": repository_name,
                "status": "indexed",
                "indexed_at": indexed_at,
                "indexed_files": len(file_paths),
                "chunks": len(chunks),
                "error_message": None,
            }
        )
        return RepositoryIndexResponse(
            repository_id=repository_id,
            status="indexed",
            repo_url=repository_url,
            name=repository_name,
            indexed_files=len(file_paths),
            chunks=len(chunks),
        )

    async def get_repository(self, repository_id: UUID) -> RepositoryResponse:
        record = self.store.get_repository(repository_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Repository not found.")
        indexed_at = datetime.fromisoformat(record["indexed_at"]) if record.get("indexed_at") else None
        return RepositoryResponse(
            id=repository_id,
            url=record["url"],
            name=record["name"],
            status=record["status"],
            indexed_at=indexed_at,
            indexed_files=int(record.get("indexed_files", 0)),
            chunks=int(record.get("chunks", 0)),
        )

    async def process_files(self, repository_path: Path) -> list[Path]:
        def discover_files() -> list[Path]:
            files: list[Path] = []
            for path in repository_path.rglob("*"):
                if not path.is_file():
                    continue
                if any(part in IGNORED_DIRECTORIES for part in path.parts):
                    continue
                if path.suffix.lower() not in SUPPORTED_EXTENSIONS and path.name not in SUPPORTED_FILENAMES:
                    continue
                if path.stat().st_size > MAX_FILE_BYTES:
                    continue
                if self._looks_binary(path):
                    continue
                files.append(path)
            return sorted(files)

        return await run_in_threadpool(discover_files)

    async def create_chunks(self, file_paths: list[Path]) -> list[dict[str, object]]:
        def chunk_files() -> list[dict[str, object]]:
            chunks: list[dict[str, object]] = []
            for file_path in file_paths:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
                lines = text.splitlines()
                if not lines:
                    continue
                step = max(1, CHUNK_LINES - CHUNK_OVERLAP)
                for start_index in range(0, len(lines), step):
                    chunk_lines = lines[start_index : start_index + CHUNK_LINES]
                    content = "\n".join(chunk_lines).strip()
                    if not content:
                        continue
                    chunks.append(
                        {
                            "content": content,
                            "file_path": str(file_path),
                            "start_line": start_index + 1,
                            "end_line": start_index + len(chunk_lines),
                            "language": file_path.suffix.lstrip(".").lower() or "text",
                        }
                    )
            return chunks

        return await run_in_threadpool(chunk_files)


    async def _index_chunks(
        self,
        repository_id: UUID,
        repository_url: str,
        chunks: list[dict[str, object]],
    ) -> None:
        collection_name = self._collection_name(repository_id)
        try:
            self.chroma_client.delete_collection(collection_name)
        except Exception:
            pass
        collection = self.chroma_client.create_collection(collection_name)

        repo_root = Path(self.settings.repository_storage_directory) / str(repository_id)
        for batch_start in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[batch_start : batch_start + BATCH_SIZE]
            documents = [str(chunk["content"]) for chunk in batch]
            embeddings = await run_in_threadpool(embed_texts, documents)
            metadatas = [
                {
                    "repo_id": str(repository_id),
                    "repo_url": repository_url,
                    "file_path": self._relative_file_path(str(chunk["file_path"]), repo_root),
                    "language": str(chunk["language"]),
                    "start_line": int(chunk["start_line"]),
                    "end_line": int(chunk["end_line"]),
                }
                for chunk in batch
            ]
            ids = [
                self._chunk_id(
                    repository_id,
                    str(metadata["file_path"]),
                    int(metadata["start_line"]),
                    int(metadata["end_line"]),
                    str(batch[index]["content"]),
                )
                for index, metadata in enumerate(metadatas)
            ]
            collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)

    def _repository_name(self, repository_url: str) -> str:
        return repository_url.rstrip("/").removesuffix(".git").split("/")[-1]

    def _collection_name(self, repository_id: UUID) -> str:
        return f"repo_{repository_id.hex}"

    def _relative_file_path(self, file_path: str, repo_root: Path) -> str:
        path = Path(file_path)
        try:
            return path.relative_to(repo_root).as_posix()
        except ValueError:
            return path.as_posix()

    def _chunk_id(
        self,
        repository_id: UUID,
        file_path: str,
        start_line: int,
        end_line: int,
        content: str,
    ) -> str:
        digest = hashlib.sha1(content.encode("utf-8")).hexdigest()[:12]
        return f"{repository_id.hex}:{file_path}:{start_line}:{end_line}:{digest}"

    def _looks_binary(self, path: Path) -> bool:
        sample = path.read_bytes()[:2048]
        return b"\x00" in sample


def get_indexing_service() -> IndexingService:
    return IndexingService()
