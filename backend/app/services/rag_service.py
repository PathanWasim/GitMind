from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.schemas.chat import ChatStreamRequest
from app.services.embedding_service import embed_query
from app.storage.repository_store import RepositoryStore
from app.vector.chroma_client import get_chroma_client

SYSTEM_PROMPT = """You are GitMind Pro — an expert software engineering assistant that specializes in reading and deeply understanding source code.

You will be given:
1. The repository file structure
2. A README excerpt (if available)
3. The most semantically relevant source code excerpts, each labeled with file path and line numbers

Your job is to answer questions about the codebase accurately and technically.

Rules:
- Answer ONLY based on the provided source code and file structure
- Cite specific files and line ranges inline: e.g. `aegis/pipeline.py:45-60`
- Trace execution flow: explain what code *actually does*, not just what it's named
- For architecture questions: describe data flow, component relationships, and call chains
- For "what is X" questions: explain purpose, structure, and where it lives in the codebase
- Use markdown formatting. Use ```language code blocks for actual code snippets
- Be specific and technical. If something is not in the provided context, say so clearly
- Do NOT fabricate function names, variable names, or behavior not visible in the context"""


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
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(6, collection_size),
        )
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

        if not context:
            yield self._sse("token", {"text": "No indexed context found for this repository. Please index it first."})
            yield self._sse("citations", {"citations": []})
            return

        llm = self._build_llm()

        if llm is None:
            fallback = self._fallback_answer(payload.message, context)
            for token in fallback.split(" "):
                yield self._sse("token", {"text": f"{token} "})
            yield self._sse("citations", {"citations": citations})
            return

        human_content = self._build_human_message(payload.repository_id, payload.message, context)
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        async for chunk in llm.astream(messages):
            content = chunk.content
            if isinstance(content, str) and content:
                yield self._sse("token", {"text": content})

        yield self._sse("citations", {"citations": citations})

    def _build_human_message(self, repository_id: UUID, question: str, context: list[dict[str, object]]) -> str:
        record = self.store.get_repository(repository_id)
        parts: list[str] = []

        # File tree (condensed — show up to 60 files)
        file_tree: list[str] = record.get("file_tree", []) if record else []
        if file_tree:
            tree_lines = "\n".join(f"  {f}" for f in file_tree[:60])
            if len(file_tree) > 60:
                tree_lines += f"\n  ... and {len(file_tree) - 60} more files"
            parts.append(f"Repository file structure:\n{tree_lines}")

        # README excerpt
        readme: str = record.get("readme_excerpt", "") if record else ""
        if readme:
            parts.append(f"README overview:\n{readme[:1000]}")

        # Code chunks
        parts.append(f"Relevant source code ({len(context)} excerpts):\n{self._format_context(context)}")

        parts.append(f"Question:\n{question}")

        return "\n\n---\n\n".join(parts)

    def _build_llm(self) -> object | None:
        """Return the best available LangChain chat model. Groq > OpenAI > None."""
        if self.settings.groq_api_key:
            from langchain_groq import ChatGroq
            return ChatGroq(
                api_key=self.settings.groq_api_key,
                model=self.settings.groq_model,
                temperature=0.1,
                streaming=True,
            )
        if self.settings.openai_api_key:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                api_key=self.settings.openai_api_key,
                model=self.settings.openai_model,
                temperature=0.1,
                streaming=True,
            )
        return None

    def _collection_name(self, repository_id: UUID) -> str:
        return f"repo_{repository_id.hex}"

    def _format_context(self, context: list[dict[str, object]]) -> str:
        formatted: list[str] = []
        for item in context:
            metadata = item["metadata"]
            formatted.append(
                "[{file_path}:{start_line}-{end_line}]\n```\n{content}\n```".format(
                    file_path=metadata.get("file_path", "unknown"),
                    start_line=metadata.get("start_line", "?"),
                    end_line=metadata.get("end_line", "?"),
                    content=item["content"],
                )
            )
        return "\n\n".join(formatted)

    def _citations_from_context(self, context: list[dict[str, object]]) -> list[dict[str, object]]:
        citations: list[dict[str, object]] = []
        seen: set[tuple[str, int, int]] = set()
        for item in context:
            metadata = item["metadata"]
            file_path = str(metadata.get("file_path", "unknown"))
            start_line = int(metadata.get("start_line", 0))
            end_line = int(metadata.get("end_line", 0))
            key = (file_path, start_line, end_line)
            if key in seen:
                continue
            seen.add(key)
            citations.append({"file_path": file_path, "start_line": start_line, "end_line": end_line})
        return citations

    def _fallback_answer(self, question: str, context: list[dict[str, object]]) -> str:
        top = context[0]
        metadata = top["metadata"]
        return (
            "No LLM configured. Here is the most relevant indexed excerpt for your question. "
            f"File: {metadata.get('file_path')}:{metadata.get('start_line')}-{metadata.get('end_line')}\n\n"
            f"{str(top['content'])[:1000]}"
        )

    def _sse(self, event: str, payload: dict[str, object]) -> str:
        return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def get_rag_service() -> RAGService:
    return RAGService()
