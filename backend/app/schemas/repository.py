from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, HttpUrl


class RepositoryIndexRequest(BaseModel):
    repository_url: HttpUrl = Field(validation_alias=AliasChoices("repository_url", "repo_url"))


class RepositoryIndexResponse(BaseModel):
    repository_id: UUID
    status: str
    repo_url: str
    name: str
    indexed_files: int
    chunks: int


class RepositoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: str
    name: str
    status: str
    indexed_at: datetime | None = None
    indexed_files: int = 0
    chunks: int = 0
    readme_excerpt: str = ""
    file_tree: list[str] = Field(default_factory=list)
    language_stats: dict[str, int] = Field(default_factory=dict)



class RepositoryListResponse(BaseModel):
    repositories: list[RepositoryResponse]
    total: int
