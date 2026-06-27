from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.schemas.repository import (
    RepositoryIndexRequest,
    RepositoryIndexResponse,
    RepositoryListResponse,
    RepositoryResponse,
)
from app.services.indexing_service import IndexingService, get_indexing_service

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("/", response_model=RepositoryListResponse)
async def list_repositories(
    indexing_service: Annotated[IndexingService, Depends(get_indexing_service)],
) -> RepositoryListResponse:
    return await indexing_service.list_repositories()


@router.post("/index", response_model=RepositoryIndexResponse)
async def index_repository(
    payload: RepositoryIndexRequest,
    indexing_service: Annotated[IndexingService, Depends(get_indexing_service)],
) -> RepositoryIndexResponse:
    """Non-streaming index endpoint — kept for backward compatibility."""
    return await indexing_service.index_repository(payload)


@router.post("/index/stream")
async def index_repository_stream(
    payload: RepositoryIndexRequest,
    indexing_service: Annotated[IndexingService, Depends(get_indexing_service)],
) -> StreamingResponse:
    """SSE endpoint that emits real-time progress events during indexing."""
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def emit(event_type: str, data: dict) -> None:
        await queue.put(f"event: {event_type}\ndata: {json.dumps(data)}\n\n")

    async def run_indexing() -> None:
        try:
            await indexing_service.index_repository_with_progress(payload, emit)
        except Exception as exc:
            detail = getattr(exc, "detail", str(exc))
            await queue.put(f"event: error\ndata: {json.dumps({'message': str(detail)})}\n\n")
        finally:
            await queue.put(None)

    async def generate() -> AsyncIterator[str]:
        task = asyncio.create_task(run_indexing())
        while True:
            item = await queue.get()
            if item is None:
                break
            yield item
        await task

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{repository_id}", response_model=RepositoryResponse)
async def get_repository(
    repository_id: UUID,
    indexing_service: Annotated[IndexingService, Depends(get_indexing_service)],
) -> RepositoryResponse:
    return await indexing_service.get_repository(repository_id)
