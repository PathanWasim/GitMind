from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GitMind Pro"
    app_env: str = "development"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://gitmind:gitmind@localhost:5432/gitmind"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    chroma_persist_directory: str = "./data/chroma"
    data_directory: str = "./data"
    repository_storage_directory: str = "./data/repos"
    repository_state_file: str = "./data/state/repositories.json"
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    openai_model: str = "gpt-4o-mini"
    openai_api_key: str = ""
    backend_cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(origin) for origin in value]
        if isinstance(value, str):
            raw_value = value.strip()
            if raw_value.startswith("["):
                parsed = json.loads(raw_value)
                return [str(origin) for origin in parsed]
            return [origin.strip() for origin in raw_value.split(",") if origin.strip()]
        return []


@lru_cache
def get_settings() -> Settings:
    return Settings()
