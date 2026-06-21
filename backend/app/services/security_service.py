from __future__ import annotations

from uuid import UUID

from app.schemas.analysis import RepositoryAnalysisResponse


class SecurityService:
    async def scan_repository(self, repository_id: UUID) -> RepositoryAnalysisResponse:
        raise NotImplementedError("Repository security scanning is not implemented yet.")


def get_security_service() -> SecurityService:
    return SecurityService()
