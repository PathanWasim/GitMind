from __future__ import annotations

from secrets import compare_digest


def constant_time_compare(left: str, right: str) -> bool:
    return compare_digest(left, right)
