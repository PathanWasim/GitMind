from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.schemas.chat import ChatStreamRequest
from app.services.embedding_service import embed_query
from app.storage.repository_store import RepositoryStore
from app.vector.chroma_client import get_chroma_client


class RAGService:
    def __init__(self, store: RepositoryStore | None = None) -> None:
        self.settings = get_settings()
        self.store = store or RepositoryStore(self.settings.repository_state_file)
        self.chroma_client = get_chroma_client()

    async def ensure_repository_exists(self, repository_id: UUID) -> None:
        if self.store.get_repository(repository_id) is None:
            raise HTTPException(status_code=404, detail="Repository not found.")

    async def retrieve_context(self, repository_id: UUID, query: str) -> list[dict[str, object]]:
        collection = self.chroma_client.get_collection(self._collection_name(repository_id))
        collection_size = collection.count()
        if collection_size == 0:
            return []
        query_embedding = await run_in_threadpool(embed_query, query)
        results = collection.query(query_embeddings=[query_embedding], n_results=min(8, collection_size))

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        context: list[dict[str, object]] = []
        for index, document in enumerate(documents):
            metadata = metadatas[index] if index < len(metadatas) else {}
            distance = distances[index] if index < len(distances) else None
            context.append({"content": document, "metadata": metadata, "distance": distance})
        return context


    def generate_answer(self, payload: ChatStreamRequest) -> AsyncIterator[str]:
        return self._stream_answer(payload)

    async def _stream_answer(self, payload: ChatStreamRequest) -> AsyncIterator[str]:
        context = await self.retrieve_context(payload.repository_id, payload.message)
        citations = self._citations_from_context(context)
        prompt_context = self._format_context(context)

        if not context:
            yield self._sse("token", {"text": "I could not find indexed context for this repository."})
            yield self._sse("citations", {"citations": []})
            return

        if not self.settings.openai_api_key:
            fallback = self._fallback_answer(payload.message, context)
            for token in fallback.split(" "):
                yield self._sse("token", {"text": f"{token} "})
            yield self._sse("citations", {"citations": citations})
            return

        llm = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_model,
            temperature=0.1,
            streaming=True,
        )
        messages = [
            SystemMessage(
                content=(
                    "You are GitMind Pro, an expert software engineering assistant. "
                    "Answer questions about the repository using only the provided source context. "
                    "Cite source files naturally in the answer and avoid unsupported claims."
                )
            ),
            HumanMessage(
                content=(
                    f"Question:\n{payload.message}\n\n"
                    f"Repository context:\n{prompt_context}\n\n"
                    "Answer with concise engineering detail and mention relevant files."
                )
            ),
        ]

        async for chunk in llm.astream(messages):
            content = chunk.content
            if isinstance(content, str) and content:
                yield self._sse("token", {"text": content})

        yield self._sse("citations", {"citations": citations})

    def _collection_name(self, repository_id: UUID) -> str:
        return f"repo_{repository_id.hex}"

    def _format_context(self, context: list[dict[str, object]]) -> str:
        formatted: list[str] = []
        for item in context:
            metadata = item["metadata"]
            formatted.append(
                "[{file_path}:{start_line}-{end_line}]\n{content}".format(
                    file_path=metadata.get("file_path", "unknown"),
                    start_line=metadata.get("start_line", "?"),
                    end_line=metadata.get("end_line", "?"),
                    content=item["content"],
                )
            )
        return "\n\n---\n\n".join(formatted)

    def _citations_from_context(self, context: list[dict[str, object]]) -> list[dict[str, object]]:
        citations: list[dict[str, object]] = []
        seen: set[tuple[str, int, int]] = set()
        for item in context:
            metadata = item["metadata"]
            file_path = str(metadata.get("file_path", "unknown"))
            start_line = int(metadata.get("start_line", 0))
            end_line = int(metadata.get("end_line", 0))
            citation_key = (file_path, start_line, end_line)
            if citation_key in seen:
                continue
            seen.add(citation_key)
            citations.append(
                {
                    "file_path": file_path,
                    "start_line": start_line,
                    "end_line": end_line,
                }
            )
        return citations

    def _fallback_answer(self, question: str, context: list[dict[str, object]]) -> str:
        top = context[0]
        metadata = top["metadata"]
        return (
            "OPENAI_API_KEY is not configured, so GitMind is returning the most relevant indexed "
            f"context instead of an LLM-generated answer. For the question '{question}', the closest "
            f"match is {metadata.get('file_path')}:{metadata.get('start_line')}-{metadata.get('end_line')}. "
            f"Relevant excerpt: {str(top['content'])[:800]}"
        )

    def _sse(self, event: str, payload: dict[str, object]) -> str:
        return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def get_rag_service() -> RAGService:
    return RAGService()
