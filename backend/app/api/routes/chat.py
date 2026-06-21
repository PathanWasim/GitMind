from __future__ import annotations

from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatStreamRequest
from app.services.rag_service import RAGService, get_rag_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
async def stream_chat_response(
    payload: ChatStreamRequest,
    rag_service: Annotated[RAGService, Depends(get_rag_service)],
) -> StreamingResponse:
    await rag_service.ensure_repository_exists(payload.repository_id)
    stream: AsyncIterator[str] = rag_service.generate_answer(payload)
    return StreamingResponse(stream, media_type="text/event-stream")
