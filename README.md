# GitMind Pro

GitMind Pro is a production-style AI Repository Intelligence Platform. This foundation establishes a clean full-stack architecture for repository ingestion, RAG, AST-based code understanding, async processing, and future security analysis.

The current implementation supports cloning public GitHub repositories, chunking supported source files, embedding chunks with `sentence-transformers`, storing vectors in ChromaDB, and streaming repository answers with source citations. If `OPENAI_API_KEY` is not configured, chat returns a streamed retrieval-based fallback so the local workflow still runs.

## Architecture

- `frontend/` contains a React 18, Vite, and Tailwind CSS application shell.
- `backend/` contains a FastAPI application using clean route, service, database, vector, and worker boundaries.
- PostgreSQL stores application metadata such as repositories, indexing jobs, users, and chat messages.
- Redis backs Celery for future async indexing and analysis workflows.
- ChromaDB is isolated behind `app/vector/chroma_client.py` for future vector search.

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### Docker Compose

```bash
docker compose up --build
```

Services:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## API Surface

- `GET /health`
- `POST /api/repositories/index`
- `GET /api/repositories/{id}`
- `POST /api/chat/stream`
- `GET /api/analysis/{repo_id}`

`POST /api/repositories/index` performs synchronous local indexing for the first working version. Celery and PostgreSQL are scaffolded for production hardening, but the end-to-end path stores repository state in `backend/data/state/repositories.json` and vectors in ChromaDB.

## Next Steps

1. Add Alembic initial migration for SQLAlchemy models.
2. Move indexing into Celery with job progress events.
3. Add Tree-sitter symbol extraction and architecture/dependency analysis.
4. Persist repository metadata and chat history in PostgreSQL.
5. Expand security and code quality scanning.
6. Add stronger frontend flows for job progress, chat history, and analysis views.
