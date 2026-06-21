from __future__ import annotations

import logging
import sys


def configure_logging(environment: str) -> None:
    level = logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )
    logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)
    logging.getLogger("chromadb.config").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
