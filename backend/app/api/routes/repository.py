from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.schemas.repository import RepositoryIndexRequest, RepositoryIndexResponse, RepositoryResponse
from app.services.indexing_service import IndexingService, get_indexing_service

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.post("/index", response_model=RepositoryIndexResponse)
async def index_repository(
    payload: RepositoryIndexRequest,
    indexing_service: Annotated[IndexingService, Depends(get_indexing_service)],
) -> RepositoryIndexResponse:
    return await indexing_service.index_repository(payload)


@router.get("/{repository_id}", response_model=RepositoryResponse)
async def get_repository(
    repository_id: UUID,
    indexing_service: Annotated[IndexingService, Depends(get_indexing_service)],
) -> RepositoryResponse:
    return await indexing_service.get_repository(repository_id)
