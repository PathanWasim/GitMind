from __future__ import annotations

import os
from functools import lru_cache

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
from chromadb.api import ClientAPI
from chromadb.config import Settings as ChromaSettings

from app.core.config import get_settings


@lru_cache
def get_chroma_client() -> ClientAPI:
    settings = get_settings()
    return chromadb.PersistentClient(
        path=settings.chroma_persist_directory,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
