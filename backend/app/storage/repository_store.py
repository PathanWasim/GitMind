from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID


class RepositoryStore:
    def __init__(self, state_file: str) -> None:
        self.state_file = Path(state_file)
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

    def upsert_repository(self, record: dict[str, Any]) -> dict[str, Any]:
        state = self._read_state()
        repositories = state.setdefault("repositories", {})
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        repositories[str(record["id"])] = record
        self._write_state(state)
        return record

    def get_repository(self, repository_id: UUID) -> dict[str, Any] | None:
        state = self._read_state()
        record = state.get("repositories", {}).get(str(repository_id))
        return dict(record) if record else None

    def _read_state(self) -> dict[str, Any]:
        if not self.state_file.exists():
            return {"repositories": {}}
        with self.state_file.open("r", encoding="utf-8") as state_handle:
            return json.load(state_handle)

    def _write_state(self, state: dict[str, Any]) -> None:
        with self.state_file.open("w", encoding="utf-8") as state_handle:
            json.dump(state, state_handle, indent=2, sort_keys=True)
