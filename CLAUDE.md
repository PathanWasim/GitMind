# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev        # dev server at localhost:5173
npm run build      # production build
npm run preview    # preview production build
```

### Backend (FastAPI + Uvicorn)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Unix
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Environment Setup
Backend requires a `.env` file in `backend/`:
```
GROQ_API_KEY=<required — LLaMA 3.3 70B via Groq>
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
CHROMA_PERSIST_DIRECTORY=./data/chroma
REPOSITORY_STORAGE_DIRECTORY=./data/repos
REPOSITORY_STATE_FILE=./data/state/repositories.json
```
`OPENAI_API_KEY` is optional (GPT-4o-mini fallback). `DATABASE_URL`, `REDIS_URL`, and Celery vars are wired but not active.

Frontend requires `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env`.

## Architecture

### Overview
GitMind is a local-first AI code intelligence tool. A user pastes a GitHub URL, the backend clones the repo, indexes it into a local ChromaDB vector store with local embeddings (no API call), then the frontend can query it via streaming chat.

### Backend (`backend/app/`)
FastAPI app with three main services wired together:

**`services/indexing_service.py`** — Full pipeline:
1. Shallow clone (`depth=1`) via GitPython into `./data/repos/`
2. Scan files (30+ extensions, 350 KB size cap, ignores `node_modules`/`.git`/`dist`/etc.)
3. Chunk code with 80-line sliding windows, 15-line overlap
4. Embed locally with `sentence-transformers/all-MiniLM-L6-v2` (384-dim, batches of 64)
5. Store in ChromaDB (one collection per repo, deterministic chunk IDs including `sha1(content)[:12]`)
6. Write atomic JSON state via `services/repository_store.py`

**`services/rag_service.py`** — Query pipeline:
- Embeds question with the same local model → retrieves top-12 chunks from ChromaDB
- Builds an augmented prompt (file tree + README + labeled code excerpts) → streams to Groq LLaMA 3.3 70B
- Yields citations: `{file_path, start_line, end_line}`

**`api/routes/repository.py`** — Main routes:
- `POST /api/repositories/index/stream` — SSE streaming indexing with live progress events
- `POST /api/repositories/index` — Non-streaming fallback
- `GET /api/repositories/` — List all repos (from JSON state file)
- `POST /api/chat/stream` — SSE streaming Q&A

**SSE pattern**: `asyncio.Queue` decouples the indexing task from the HTTP response. `asyncio.create_task()` runs the pipeline while `StreamingResponse` reads from the queue and yields events. Indexing SSE events: `progress {stage, percent, message}`, `complete {repo metadata}`, `error`. Chat SSE events: `token {text}`, `citations [{file_path, start_line, end_line}]`.

**State persistence**: `services/repository_store.py` — advisory file locking + atomic JSON write to `./data/state/repositories.json`. No SQL is used in the current flow (SQLAlchemy/Alembic/PostgreSQL wiring exists but is inactive).

### Frontend (`frontend/src/`)
React 18 SPA, no global state manager — `AppPage.jsx` owns all application state (repos list, activeRepo, active tab, modal open/close, indexing progress).

**Routing**: Two routes via React Router v7.
- `/` → `LandingPage.jsx` (marketing + Three.js)
- `/app` → `AppPage.jsx` (application shell)

**Tab pattern**: `ChatView` and `RepoOverview` are **always mounted**, toggled only by CSS `display`. This preserves chat history and streaming state across tab switches — do not change this to conditional rendering.

**API client** (`services/api.js`): Axios for REST, native `fetch` + `ReadableStream` for SSE (because `EventSource` doesn't support POST bodies). SSE helper functions parse raw `event:`/`data:` lines manually.

**Three.js** (`components/ThreeBackground.jsx`): Morphing metaball blobs with inline Perlin noise (no noise library), 4000 particles in parametric streams, mouse parallax. Mobile (`< 768px`) and `prefers-reduced-motion` both return a CSS gradient div instead of starting a WebGL scene. Every `useEffect` that creates a scene returns cleanup: `renderer.dispose()`, `geometry.dispose()`, `material.dispose()`, `renderer.domElement.remove()`.

**CSS**: Single `index.css` using CSS custom properties. Color palette: `--void: #08060F`, `--amber-glow: #F97316`, `--bio-teal: #0D9488`, `--bio-bright: #2DD4BF`, `--plasma-gold: #EAB308`. Legacy aliases (`--indigo: var(--amber-deep)`, etc.) are intentional for backward compatibility with older class names in components.

## Key Constraints

- **Do not add npm packages.** All UI, animation, and math (noise functions) must use what is already in `package.json`.
- **Do not modify SSE handling, API call logic, routing logic, or state management in `AppPage.jsx`.** Only CSS and JSX structure changes are safe.
- **Streaming responses**: `streamChatResponse` and `indexRepositoryWithProgress` in `api.js` use `fetch` + `ReadableStream` with manual SSE parsing — treat as a black box.
- The `landing.css` file exists on disk but is not imported anywhere. It is unused and can be ignored.
