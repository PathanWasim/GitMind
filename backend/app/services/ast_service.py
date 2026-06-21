from __future__ import annotations

from pathlib import Path


class ASTService:
    async def parse_file(self, file_path: Path) -> dict[str, object]:
        raise NotImplementedError("AST parsing is not implemented yet.")

    async def extract_symbols(self, parsed_file: dict[str, object]) -> list[dict[str, object]]:
        raise NotImplementedError("Symbol extraction is not implemented yet.")


def get_ast_service() -> ASTService:
    return ASTService()
