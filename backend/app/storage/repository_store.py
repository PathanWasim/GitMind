from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID


class _ExclusiveLock:
    """Cross-platform advisory lock using a dedicated lockfile.

    Uses O_CREAT | O_EXCL to atomically create a lockfile.  A 10-second
    spin-wait covers the rare case of concurrent indexing requests.
    Atomic rename in _write_state ensures the state file is never partially
    written even if a crash occurs while the lock is held.
    """

    def __init__(self, lock_file: Path) -> None:
        self._lock_file = lock_file
        self._fd: int | None = None

    def __enter__(self) -> "_ExclusiveLock":
        deadline = time.monotonic() + 10.0
        while True:
            try:
                self._fd = os.open(
                    str(self._lock_file),
                    os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                )
                return self
            except FileExistsError:
                if time.monotonic() >= deadline:
                    raise TimeoutError(
                        "Could not acquire repository store lock within 10 s."
                    )
                time.sleep(0.05)

    def __exit__(self, *_: object) -> None:
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None
        try:
            self._lock_file.unlink()
        except FileNotFoundError:
            pass


class RepositoryStore:
    def __init__(self, state_file: str) -> None:
        self.state_file = Path(state_file)
        self._lock_file = self.state_file.with_suffix(".lock")
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

    def upsert_repository(self, record: dict[str, Any]) -> dict[str, Any]:
        with _ExclusiveLock(self._lock_file):
            state = self._read_state()
            repositories = state.setdefault("repositories", {})
            record["updated_at"] = datetime.now(timezone.utc).isoformat()
            # Remove any existing entry with the same URL to prevent duplicates
            # when the same repo is re-indexed (each run generates a new UUID).
            incoming_url = record.get("url", "")
            if incoming_url:
                stale_ids = [
                    rid for rid, r in repositories.items()
                    if r.get("url") == incoming_url and rid != str(record["id"])
                ]
                for rid in stale_ids:
                    del repositories[rid]
            repositories[str(record["id"])] = record
            self._write_state(state)
        return record


    def get_repository(self, repository_id: UUID) -> dict[str, Any] | None:
        state = self._read_state()
        record = state.get("repositories", {}).get(str(repository_id))
        return dict(record) if record else None

    def list_repositories(self) -> list[dict[str, Any]]:
        state = self._read_state()
        return list(state.get("repositories", {}).values())

    def _read_state(self) -> dict[str, Any]:
        if not self.state_file.exists():
            return {"repositories": {}}
        with self.state_file.open("r", encoding="utf-8") as state_handle:
            return json.load(state_handle)

    def _write_state(self, state: dict[str, Any]) -> None:
        # Write to a temp file then atomically rename to avoid partial writes.
        tmp_file = self.state_file.with_suffix(".tmp")
        with tmp_file.open("w", encoding="utf-8") as state_handle:
            json.dump(state, state_handle, indent=2, sort_keys=True)
        os.replace(tmp_file, self.state_file)
