from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.schemas.analysis import RepositoryAnalysisResponse
from app.services.security_service import SecurityService, get_security_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/{repo_id}", response_model=RepositoryAnalysisResponse)
async def get_repository_analysis(
    repo_id: UUID,
    security_service: Annotated[SecurityService, Depends(get_security_service)],
) -> RepositoryAnalysisResponse:
    return await security_service.scan_repository(repo_id)
