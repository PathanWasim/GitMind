from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class ChatStreamRequest(BaseModel):
    repository_id: UUID
    message: str = Field(min_length=1)
