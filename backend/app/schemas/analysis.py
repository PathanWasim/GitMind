from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class RepositoryAnalysisResponse(BaseModel):
    repository_id: UUID
    status: str
    summary: str | None = None
