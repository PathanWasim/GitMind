from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import analysis, chat, repository
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger

settings = get_settings()
configure_logging(settings.app_env)
logger = get_logger(__name__)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(NotImplementedError)
async def not_implemented_exception_handler(
    request: Request,
    exc: NotImplementedError,
) -> JSONResponse:
    logger.info("Unimplemented endpoint called", extra={"path": str(request.url.path)})
    return JSONResponse(
        status_code=501,
        content={"detail": str(exc) or "This feature is not implemented yet."},
    )


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "environment": settings.app_env}


app.include_router(repository.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(analysis.router, prefix=settings.api_prefix)
