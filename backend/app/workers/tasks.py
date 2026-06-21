from __future__ import annotations

from uuid import UUID

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.index_repository")
def index_repository_task(repository_id: str) -> str:
    parsed_repository_id = UUID(repository_id)
    raise NotImplementedError(f"Indexing task is not implemented for repository {parsed_repository_id}.")


@celery_app.task(name="app.workers.tasks.analyze_repository")
def analyze_repository_task(repository_id: str) -> str:
    parsed_repository_id = UUID(repository_id)
    raise NotImplementedError(f"Analysis task is not implemented for repository {parsed_repository_id}.")
