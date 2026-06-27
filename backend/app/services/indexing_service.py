from __future__ import annotations

import hashlib
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.schemas.repository import RepositoryIndexRequest, RepositoryIndexResponse, RepositoryListResponse, RepositoryResponse
from app.services.embedding_service import embed_texts
from app.services.github_service import GitHubService
from app.storage.repository_store import RepositoryStore
from app.vector.chroma_client import get_chroma_client

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs",
    ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php",
    ".swift", ".kt", ".kts", ".scala", ".sql", ".md", ".txt",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".sh", ".bash", ".ps1", ".html", ".css", ".scss",
}

SUPPORTED_FILENAMES = {"Dockerfile", "Makefile", "README", "LICENSE", "CHANGELOG", "CONTRIBUTING"}

IGNORED_DIRECTORIES = {
    ".git", ".hg", ".svn", ".venv", "venv", "env", "node_modules",
    "dist", "build", "target", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".next", ".nuxt", "coverage",
}

IGNORED_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", 
    "poetry.lock", "Gemfile.lock", "Cargo.lock"
}

MAX_FILE_BYTES = 350_000
CHUNK_LINES = 80
CHUNK_OVERLAP = 15
BATCH_SIZE = 64

# Type alias for the progress emitter
Emitter = Callable[[str, dict], Awaitable[None]]


async def _noop_emit(event: str, data: dict) -> None:  # noqa: ARG001
    """No-op emitter used when callers don't need progress events."""


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

    # ── Public API ────────────────────────────────────────────────────────────

    async def index_repository(self, payload: RepositoryIndexRequest) -> RepositoryIndexResponse:
        """Non-streaming index — delegates to the progress variant with a no-op emitter."""
        return await self.index_repository_with_progress(payload, _noop_emit)

    async def index_repository_with_progress(
        self,
        payload: RepositoryIndexRequest,
        emit: Emitter,
    ) -> RepositoryIndexResponse:
        repository_url = str(payload.repository_url).rstrip("/")
        repository_id = uuid4()
        repository_name = self._repository_name(repository_url)
        repository_path = Path(self.settings.repository_storage_directory) / str(repository_id)

        try:
            await emit("progress", {"stage": "cloning", "percent": 5, "message": "Cloning repository…"})
            await self.github_service.clone_repository(repository_url, repository_path)

            await emit("progress", {"stage": "scanning", "percent": 25, "message": "Scanning files…"})
            file_paths = await self.process_files(repository_path)

            await emit("progress", {"stage": "chunking", "percent": 42, "message": f"Processing {len(file_paths)} files…"})
            chunks = await self.create_chunks(file_paths)

            await emit("progress", {"stage": "embedding", "percent": 55, "message": f"Embedding {len(chunks)} chunks…"})
            await self._index_chunks_with_progress(repository_id, repository_url, chunks, emit)

        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:
            self.store.upsert_repository({
                "id": str(repository_id),
                "url": repository_url,
                "name": repository_name,
                "status": "failed",
                "indexed_at": None,
                "indexed_files": 0,
                "chunks": 0,
                "error_message": str(exc),
            })
            raise

        # Build metadata from indexed files
        repo_root = Path(self.settings.repository_storage_directory) / str(repository_id)
        file_tree = sorted(self._relative_file_path(str(fp), repo_root) for fp in file_paths)

        language_stats: dict[str, int] = {}
        for fp in file_paths:
            ext = fp.suffix.lower().lstrip(".") or "text"
            language_stats[ext] = language_stats.get(ext, 0) + 1

        readme_excerpt = ""
        readme_names = {"readme.md", "readme", "readme.txt", "readme.rst"}
        for fp in file_paths:
            if fp.name.lower() in readme_names:
                try:
                    readme_excerpt = fp.read_text(encoding="utf-8", errors="ignore")[:1500]
                except Exception:
                    pass
                break

        await emit("progress", {"stage": "saving", "percent": 96, "message": "Saving metadata…"})

        indexed_at = datetime.now(timezone.utc).isoformat()
        self.store.upsert_repository({
            "id": str(repository_id),
            "url": repository_url,
            "name": repository_name,
            "status": "indexed",
            "indexed_at": indexed_at,
            "indexed_files": len(file_paths),
            "chunks": len(chunks),
            "file_tree": file_tree,
            "readme_excerpt": readme_excerpt,
            "language_stats": language_stats,
            "error_message": None,
        })

        await emit("complete", {
            "repository_id": str(repository_id),
            "name": repository_name,
            "repo_url": repository_url,
            "status": "indexed",
            "indexed_files": len(file_paths),
            "chunks": len(chunks),
            "language_stats": language_stats,
            "file_tree": file_tree,
        })

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
        return self._record_to_response(record)

    async def list_repositories(self) -> RepositoryListResponse:
        records = self.store.list_repositories()
        repos = [self._record_to_response(r) for r in records]
        return RepositoryListResponse(repositories=repos, total=len(repos))

    def _record_to_response(self, record: dict) -> RepositoryResponse:
        indexed_at = datetime.fromisoformat(record["indexed_at"]) if record.get("indexed_at") else None
        return RepositoryResponse(
            id=UUID(str(record["id"])),
            url=record["url"],
            name=record["name"],
            status=record["status"],
            indexed_at=indexed_at,
            indexed_files=int(record.get("indexed_files", 0)),
            chunks=int(record.get("chunks", 0)),
            file_tree=record.get("file_tree", []),
            readme_excerpt=record.get("readme_excerpt", ""),
            language_stats=record.get("language_stats", {}),
        )

    # ── File processing ───────────────────────────────────────────────────────

    async def process_files(self, repository_path: Path) -> list[Path]:
        def discover_files() -> list[Path]:
            files: list[Path] = []
            for path in repository_path.rglob("*"):
                if not path.is_file():
                    continue
                if any(part in IGNORED_DIRECTORIES for part in path.parts):
                    continue
                if path.name in IGNORED_FILENAMES:
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
                    chunks.append({
                        "content": content,
                        "file_path": str(file_path),
                        "start_line": start_index + 1,
                        "end_line": start_index + len(chunk_lines),
                        "language": file_path.suffix.lstrip(".").lower() or "text",
                    })
            return chunks

        return await run_in_threadpool(chunk_files)

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _index_chunks_with_progress(
        self,
        repository_id: UUID,
        repository_url: str,
        chunks: list[dict[str, object]],
        emit: Emitter,
    ) -> None:
        collection_name = self._collection_name(repository_id)
        try:
            self.chroma_client.delete_collection(collection_name)
        except Exception:
            pass
        collection = self.chroma_client.create_collection(collection_name)

        repo_root = Path(self.settings.repository_storage_directory) / str(repository_id)
        total_batches = max(1, (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE)

        for batch_num, batch_start in enumerate(range(0, len(chunks), BATCH_SIZE)):
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
                    str(meta["file_path"]),
                    int(meta["start_line"]),
                    int(meta["end_line"]),
                    str(batch[i]["content"]),
                )
                for i, meta in enumerate(metadatas)
            ]
            collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)

            percent = 55 + int(40 * (batch_num + 1) / total_batches)
            await emit("progress", {
                "stage": "embedding",
                "percent": percent,
                "message": f"Embedding batch {batch_num + 1} / {total_batches}…",
            })

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

    def _chunk_id(self, repository_id: UUID, file_path: str, start_line: int, end_line: int, content: str) -> str:
        digest = hashlib.sha1(content.encode("utf-8")).hexdigest()[:12]
        return f"{repository_id.hex}:{file_path}:{start_line}:{end_line}:{digest}"

    def _looks_binary(self, path: Path) -> bool:
        sample = path.read_bytes()[:2048]
        return b"\x00" in sample


def get_indexing_service() -> IndexingService:
    return IndexingService()
