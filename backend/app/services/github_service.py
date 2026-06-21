from __future__ import annotations

import asyncio
import re
import shutil
from pathlib import Path

from git import Repo
from starlette.concurrency import run_in_threadpool

CLONE_TIMEOUT_SECONDS = 120


class GitHubService:
    async def clone_repository(self, repository_url: str, destination: Path) -> Path:
        await self.validate_repository(repository_url)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            await run_in_threadpool(shutil.rmtree, destination)
        try:
            await asyncio.wait_for(
                run_in_threadpool(Repo.clone_from, repository_url, destination, depth=1),
                timeout=CLONE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"Cloning {repository_url} timed out after {CLONE_TIMEOUT_SECONDS}s."
            ) from exc
        return destination

    async def validate_repository(self, repository_url: str) -> bool:
        github_url_pattern = re.compile(
            r"^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$"
        )
        if not github_url_pattern.match(repository_url):
            raise ValueError("Only public GitHub HTTPS repository URLs are supported.")
        return True


def get_github_service() -> GitHubService:
    return GitHubService()

