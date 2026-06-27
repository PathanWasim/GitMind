# GitMind Pro - Complete Technical Reference

> **Version:** 0.1.0
> **Stack:** FastAPI . ChromaDB . sentence-transformers . Groq / LLaMA 3.1 8B . React 18 . Three.js . Vite
> **Author:** PathanWasim
> **Repository:** https://github.com/PathanWasim/GitMind

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Data Flow - Full Pipeline](#6-data-flow---full-pipeline)
7. [Server-Sent Events Protocol](#7-server-sent-events-protocol)
8. [Frontend Deep Dive](#8-frontend-deep-dive)
9. [API Reference](#9-api-reference)
10. [Configuration Reference](#10-configuration-reference)
11. [Docker and Deployment](#11-docker-and-deployment)
12. [Local Development Setup](#12-local-development-setup)
13. [Key Design Decisions](#13-key-design-decisions)
14. [Performance Characteristics](#14-performance-characteristics)
15. [Known Limitations and Roadmap](#15-known-limitations-and-roadmap)

---

## 1. Project Overview

**GitMind Pro** is a local-first, AI-powered codebase intelligence tool. It lets developers point it at any public GitHub repository, index the entire source tree into a local vector database, and interrogate the codebase in plain English - receiving precise, source-cited answers grounded exclusively in the actual code.

### Core Workflow

1. **Clone** - shallow-clones any public GitHub repository via HTTPS using GitPython with `depth=1`
2. **Scan** - walks the file tree recursively, filters to 30+ supported source extensions, skips binaries, vendor directories, and generated lockfiles (`package-lock.json`, `yarn.lock`, `Cargo.lock`, etc.)
3. **Chunk** - splits every source file into overlapping 80-line sliding windows with 15-line overlap to preserve context at boundaries
4. **Embed** - converts each chunk to a 384-dimensional vector using a local `sentence-transformers` model (`all-MiniLM-L6-v2`) with no external API call
5. **Store** - persists vectors in a local ChromaDB collection keyed by repository UUID; metadata in a JSON state file with atomic writes and advisory locking
6. **Query** - embeds the user question with the same local model, retrieves the top-6 most semantically similar chunks, constructs a layered prompt with file structure + README + code context, streams the answer token-by-token via Groq LLaMA 3.1 8B Instant (or OpenAI as fallback)
7. **Cite** - every answer carries structured citations: `{ file_path, start_line, end_line }` pointing into the exact source

The system runs **100% locally** except for LLM inference (Groq / OpenAI). Embeddings, vector search, file storage, and state management are private and local.

---

## 2. High-Level Architecture

```
+--------------------------------------------------------------+
|                        BROWSER                               |
|  React 18 SPA (Vite dev server / production build)          |
|  +----------------------+  +------------------------------+  |
|  |  Landing Page (/)    |  |  App Page (/app)             |  |
|  |  Three.js 3D scene   |  |  Sidebar + RepoView          |  |
|  |  Scroll-driven story |  |  ChatView (SSE streaming)    |  |
|  |  GSAP animations     |  |  RepoOverview (stats+tree)   |  |
|  |  Custom Cursor       |  |  IntroScreen (boot anim)     |  |
|  +----------------------+  +------------------------------+  |
|  Global: Cursor.jsx + TransitionOverlay.jsx                  |
+------------------------------+-------------------------------+
                               | HTTP REST + SSE (localhost:8000)
+------------------------------v-------------------------------+
|              FastAPI Backend (Uvicorn ASGI)                  |
|  GET  /health                       -- health check          |
|  GET  /api/repositories/            -- list all repos        |
|  POST /api/repositories/index       -- non-streaming index   |
|  POST /api/repositories/index/stream-- SSE progress index    |
|  GET  /api/repositories/{id}        -- get single repo       |
|  POST /api/chat/stream              -- RAG streaming chat    |
|                                                              |
|  IndexingService               RAGService                    |
|  |- GitHubService (clone)       |- embed_query()             |
|  |- EmbeddingService (index)    |- ChromaDB.query() top-6    |
|  |- ChromaDB (store)            +- LangChain -> LLM stream   |
|  +- RepositoryStore (JSON)                                   |
+--------------------------------------------------------------+
         |                            |
+--------v----------+     +-----------v----------+
|  Local Storage    |     |  External APIs        |
|  ./data/chroma/   |     |  Groq: LLaMA 3.1 8B  |
|  ./data/repos/    |     |  OpenAI: GPT-4o-mini  |
|  ./data/state/    |     |  HuggingFace (once)   |
+-------------------+     +----------------------+
```

---

## 3. Tech Stack

### Backend Dependencies (backend/requirements.txt)

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Web Framework | FastAPI | 0.115.6 | Async REST API + SSE streaming |
| ASGI Server | Uvicorn | 0.34.0 | Production async server |
| Data Validation | Pydantic v2 + pydantic-settings | 2.10.4 / 2.7.1 | Request/response models, typed env config |
| Vector Database | ChromaDB | 0.5.23 | Local persistent HNSW vector store |
| Local Embeddings | sentence-transformers | 3.3.1 | all-MiniLM-L6-v2, 384-dim, @lru_cache singleton |
| LLM Orchestration | LangChain | 0.3.13 | Prompt construction, streaming abstraction |
| LLM Primary | Groq (langchain-groq 0.2.3) | LLaMA 3.1 8B Instant | Low-latency inference via Groq API |
| LLM Fallback | OpenAI (langchain-openai 0.2.14) | GPT-4o-mini | Used if GROQ_API_KEY is not set |
| Git Operations | GitPython | 3.1.43 | Shallow clone, 120s timeout |
| State Persistence | JSON + advisory file lock | stdlib only | Atomic writes, zero-dependency |
| Database (wired) | PostgreSQL 16 + SQLAlchemy 2 | 2.0.36 | Schema ready, Alembic migrations; not active |
| Task Queue (wired) | Celery 5 + Redis 7 | 5.4.0 | Task definitions wired; not active |
| Code Parsing | tree-sitter | 0.23.2 | AST stub for future semantic chunking |
| Testing | pytest + httpx + anyio | 8.3.4 | Full async test suite |

### Frontend Dependencies (frontend/package.json)

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.3.1 | Component model, hooks, concurrent rendering |
| Build Tool | Vite | 6.0.5 | HMR dev server, ESM bundling |
| Routing | React Router DOM | 7.18.0 | Client-side SPA routing (/ and /app) |
| HTTP Client | Axios | 1.7.9 | REST calls (list, get repository) |
| 3D / WebGL | Three.js | 0.185.0 | Scroll-driven 3D scene on Landing Page |
| SSE Streaming | Fetch API | native | Indexing progress and chat token streaming |
| Markdown Rendering | react-markdown + remark-gfm | 10.1.0 | Render streaming LLM markdown responses |
| Styling | Vanilla CSS | - | Custom design system, no framework at runtime |
| Dev CSS | TailwindCSS | 3.4.17 | Dev utility classes |
| Typography | Syne + JetBrains Mono | Google Fonts CDN | Display + monospace fonts |

---

## 4. Repository Structure

```
GitMind/
+-- backend/
|   +-- app/
|   |   +-- main.py                    # FastAPI app, CORS, router registration, /health
|   |   +-- core/
|   |   |   +-- config.py              # Pydantic Settings, all env vars, @lru_cache
|   |   |   +-- logging.py             # Structured JSON logging
|   |   +-- api/routes/
|   |   |   +-- repository.py          # GET /repositories/, POST /index, POST /index/stream, GET /{id}
|   |   |   +-- chat.py                # POST /chat/stream SSE endpoint
|   |   |   +-- analysis.py            # Future AST endpoints (returns 501 now)
|   |   +-- services/
|   |   |   +-- indexing_service.py    # Core pipeline: clone->scan->chunk->embed->store
|   |   |   +-- github_service.py      # GitPython shallow clone + URL validation + 120s timeout
|   |   |   +-- embedding_service.py   # sentence-transformers, @lru_cache singleton
|   |   |   +-- rag_service.py         # Retrieve top-6 + augment + stream LLM via LangChain
|   |   |   +-- ast_service.py         # tree-sitter stub (future)
|   |   |   +-- security_service.py    # Auth stub (future)
|   |   +-- storage/
|   |   |   +-- repository_store.py    # Atomic JSON + advisory lock + URL deduplication
|   |   +-- vector/
|   |   |   +-- chroma_client.py       # ChromaDB PersistentClient singleton, telemetry off
|   |   +-- schemas/
|   |   |   +-- repository.py          # Pydantic: IndexRequest, IndexResponse, RepositoryResponse
|   |   |   +-- chat.py                # Pydantic: ChatStreamRequest
|   |   +-- database/                  # SQLAlchemy ORM models (wired, Alembic ready)
|   |   +-- tests/                     # pytest async test suite
|   |   +-- workers/                   # Celery task definitions (wired, not active)
|   +-- alembic/                       # Migrations (0001_initial_schema.py committed)
|   +-- data/                          # Runtime data (gitignored)
|   |   +-- chroma/                    # ChromaDB vector collections
|   |   +-- repos/                     # Cloned repositories (UUID-named)
|   |   +-- state/repositories.json   # All indexed repository metadata
|   +-- Dockerfile
|   +-- requirements.txt
+-- frontend/
|   +-- src/
|   |   +-- main.jsx                   # React root, renders App into #root
|   |   +-- App.jsx                    # BrowserRouter, global Cursor + TransitionOverlay
|   |   +-- index.css                  # Global design system: CSS vars, animations, mc-* classes
|   |   +-- landing.css                # Landing page styles, GSAP helpers
|   |   +-- pages/
|   |   |   +-- LandingPage.jsx        # Scroll story: Hero, Clone, Scan, Embed, Answer, CTA
|   |   |   +-- AppPage.jsx            # App shell: Sidebar, RepoView, IndexModal, IntroScreen
|   |   +-- components/
|   |   |   +-- ThreeBackground.jsx    # Three.js: 200 cubes + TorusKnot, scroll-driven camera
|   |   |   +-- IntroScreen.jsx        # Cinematic boot sequence on first /app visit
|   |   |   +-- ChatView.jsx           # Streaming chat: markdown, citations, char ring, magnetic button
|   |   |   +-- RepoOverview.jsx       # Stat cards (3D tilt + count-up), language bar, file tree
|   |   |   +-- Cursor.jsx             # Global cursor: dot + trailing ring, GSAP or rAF fallback
|   |   |   +-- TransitionOverlay.jsx  # Amber-teal clip-path sweep on route change
|   |   |   +-- Sidebar.jsx            # Legacy standalone sidebar (unused in AppPage)
|   |   +-- hooks/                     # Custom React hooks (empty, ready)
|   |   +-- services/
|   |       +-- api.js                 # All HTTP + SSE client functions
|   +-- index.html                     # Entry HTML, title GitMind Pro, mounts #root
|   +-- package.json
+-- docker-compose.yml                 # 4 services: backend, frontend, postgres:16, redis:7
+-- .gitignore                         # Ignores: data/, .venv/, .env*, CLAUDE.md, prompt.md
+-- README.md                          # Public-facing documentation
+-- gitmind.md                         # This file - full technical reference
```

---

## 5. Backend Deep Dive

### 5.1 Entry Point - backend/app/main.py

Creates the FastAPI app, applies CORS middleware (origins from `settings.backend_cors_origins`, defaults to `localhost:5173`), registers three API routers under `/api`, and registers a `NotImplementedError` handler returning HTTP 501. The `/health` endpoint returns `{ status, service, environment }`.

### 5.2 Configuration - backend/app/core/config.py

Single `Settings` class via `pydantic_settings.BaseSettings`. Auto-loads `.env`, applies type coercion. Cached with `@lru_cache` - created once per process.

| Variable | Default | Description |
|---|---|---|
| APP_NAME | GitMind Pro | Application name |
| APP_ENV | development | Shown in health response |
| API_PREFIX | /api | Route prefix |
| GROQ_API_KEY | "" | Required for LLM inference |
| GROQ_MODEL | llama-3.1-8b-instant | Active Groq model |
| OPENAI_API_KEY | "" | Fallback LLM key |
| OPENAI_MODEL | gpt-4o-mini | Fallback model |
| EMBEDDING_MODEL_NAME | sentence-transformers/all-MiniLM-L6-v2 | Local embedding model |
| CHROMA_PERSIST_DIRECTORY | ./data/chroma | ChromaDB on-disk path |
| REPOSITORY_STORAGE_DIRECTORY | ./data/repos | Cloned repo root |
| REPOSITORY_STATE_FILE | ./data/state/repositories.json | JSON metadata store |
| BACKEND_CORS_ORIGINS | ["http://localhost:5173"] | Accepts JSON array or comma-separated string |

### 5.3 API Routes

#### repository.py

| Method | Path | Description |
|---|---|---|
| GET | /api/repositories/ | Returns RepositoryListResponse with all repos |
| POST | /api/repositories/index | Non-streaming, synchronous index |
| POST | /api/repositories/index/stream | SSE streaming - emits progress/complete/error |
| GET | /api/repositories/{id} | Single repo by UUID |

SSE streaming uses an `asyncio.Queue` pattern: background task pushes SSE strings into the queue; generator consumes and yields them to `StreamingResponse`.

#### chat.py

| Method | Path | Description |
|---|---|---|
| POST | /api/chat/stream | Validates repo exists, returns StreamingResponse from RAGService |

### 5.4 IndexingService - backend/app/services/indexing_service.py

**Constants:**

```python
SUPPORTED_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs",
                        ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php",
                        ".swift", ".kt", ".sql", ".md", ".txt", ".json", ".yaml",
                        ".yml", ".toml", ".ini", ".cfg", ".sh", ".bash", ".ps1",
                        ".html", ".css", ".scss"}

IGNORED_DIRECTORIES = {".git", ".hg", ".svn", ".venv", "venv", "env", "node_modules",
                       "dist", "build", "target", "__pycache__", ".pytest_cache",
                       ".mypy_cache", ".ruff_cache", ".next", ".nuxt", "coverage"}

IGNORED_FILENAMES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml",
                     "poetry.lock", "Gemfile.lock", "Cargo.lock"}

MAX_FILE_BYTES = 350_000   # Skip files larger than 350 KB
CHUNK_LINES    = 80        # Lines per chunk
CHUNK_OVERLAP  = 15        # Overlap between adjacent chunks
BATCH_SIZE     = 64        # Embedding batch size
```

**Pipeline steps (heavy work in `run_in_threadpool`):**

1. `github_service.clone_repository()` - shallow clone with 120s timeout
2. `process_files()` - `rglob("*")` filtered by extensions, ignored dirs/filenames, size limit, binary detection
3. `create_chunks()` - sliding window over `splitlines()` with step = `CHUNK_LINES - CHUNK_OVERLAP`
4. `_index_chunks_with_progress()` - batched `embed_texts()` -> ChromaDB `collection.add()`
5. `store.upsert_repository()` - writes all metadata to JSON

**SSE progress stages emitted:**
`cloning (5%)` -> `scanning (25%)` -> `chunking (42%)` -> `embedding (55-95%)` -> `saving (96%)` -> `complete`

### 5.5 RAGService - backend/app/services/rag_service.py

**`retrieve_context(repository_id, query)`:**
1. Gets ChromaDB collection by `repo_{uuid_hex}`
2. Calls `embed_query(query)` via `run_in_threadpool`
3. Calls `collection.query(n_results=min(6, collection_size))` - top-6 chunks to stay under Groq's 12K TPM limit
4. Returns list of `{content, metadata, distance}` dicts

**`_build_human_message()`** assembles the prompt:
- File tree (up to 60 files)
- README excerpt (up to 1000 chars)
- Top-6 code chunks formatted as `[filepath:start-end]` code blocks
- The user question

**`_build_llm()`** - checks `groq_api_key` first, then `openai_api_key`, returns None if neither (triggers text fallback).

**System prompt** instructs the model to: answer only from context, cite files/line ranges, trace execution flow, use markdown, never fabricate.

### 5.6 RepositoryStore - backend/app/storage/repository_store.py

- **`_ExclusiveLock`** - cross-platform advisory lock using `os.O_CREAT | os.O_EXCL` with 10s spin-wait deadline
- **`_write_state()`** - writes to `.tmp` then `os.replace()` for atomic rename (crash-safe)
- **`upsert_repository()`** - before inserting, scans for existing entries with the same URL and removes stale UUIDs (prevents duplicates on re-index, since each run generates a fresh UUID)
- **`list_repositories()`** - returns all values from `repositories` dict
- **`get_repository(uuid)`** - returns single record by UUID string key

### 5.7 EmbeddingService - backend/app/services/embedding_service.py

- `get_embedding_model()` - `@lru_cache` singleton, loads `all-MiniLM-L6-v2` once, cached in `~/.cache/huggingface/`
- `embed_texts(texts)` - `model.encode()` with `normalize_embeddings=True`; returns `list[list[float]]`
- `embed_query(text)` - convenience wrapper calling `embed_texts([text])[0]`

### 5.8 GitHubService - backend/app/services/github_service.py

- `validate_repository(url)` - regex: `^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$`; raises `ValueError` for non-GitHub URLs
- `clone_repository(url, dest)` - deletes existing destination if present, runs `Repo.clone_from(..., depth=1)` via `run_in_threadpool` with `asyncio.wait_for(timeout=120)`

### 5.9 ChromaDB Client - backend/app/vector/chroma_client.py

- `get_chroma_client()` - `@lru_cache` singleton; `chromadb.PersistentClient` with `anonymized_telemetry=False`
- Collection naming: `repo_{repository_id.hex}` (UUID without dashes)
- On re-index: existing collection deleted and recreated to clear stale vectors

---

## 6. Data Flow - Full Pipeline

### Indexing Flow

```
Frontend IndexModal
   | POST /api/repositories/index/stream { repository_url }
   v
repository.py -> asyncio.Queue + SSE generator
   | asyncio.create_task(run_indexing)
   v
IndexingService.index_repository_with_progress(payload, emit)
   |
   +- emit("progress", {stage:"cloning",   percent:5})
   +- GitHubService.clone_repository()    -> data/repos/{uuid}/
   |
   +- emit("progress", {stage:"scanning",  percent:25})
   +- process_files()                     -> list[Path]
   |    +- rglob -> filter ext/dir/name/size/binary
   |
   +- emit("progress", {stage:"chunking",  percent:42})
   +- create_chunks()                     -> list[chunks]
   |    +- 80-line sliding window, 15-line overlap
   |
   +- emit("progress", {stage:"embedding", percent:55-95})
   +- _index_chunks_with_progress()
   |    +- batches of 64 -> embed_texts() -> collection.add()
   |
   +- emit("progress", {stage:"saving",    percent:96})
   +- store.upsert_repository()           -> data/state/repositories.json
   |    +- URL dedup: removes stale UUIDs for same URL
   |
   +- emit("complete", { repository_id, name, repo_url, ... })

SSE -> text/event-stream -> frontend onComplete -> setRepos()
```

### Chat / RAG Flow

```
Frontend ChatView
   | POST /api/chat/stream { repository_id, message }
   v
chat.py -> RAGService.generate_answer(payload)
   |
   +- embed_query(message)              -> [float x 384]
   +- collection.query(n_results=6)     -> top-6 by cosine similarity
   +- _build_human_message()
   |    +- file_tree[:60]
   |    +- readme_excerpt[:1000]
   |    +- 6 code blocks [path:start-end]
   |
   +- LangChain ChatGroq / ChatOpenAI
   |    +- astream([SystemMessage, HumanMessage])
   |
   +- yield SSE: event:token  {text:"..."} per chunk
      yield SSE: event:citations [{file_path,start_line,end_line}]

Frontend ChatView
   +- onToken     -> append to message.content
   +- onCitations -> render citation pills
```

---

## 7. Server-Sent Events Protocol

All real-time communication uses SSE over `text/event-stream`:

```
event: <event_name>
data: <JSON string>

```

### Indexing SSE Events

| Event | Payload | When |
|---|---|---|
| progress | { stage, percent, message } | Each pipeline stage |
| complete | { repository_id, name, repo_url, status, indexed_files, chunks, language_stats, file_tree } | Done |
| error | { message } | Any exception |

### Chat SSE Events

| Event | Payload | When |
|---|---|---|
| token | { text } | Each LLM token |
| citations | { citations: [{ file_path, start_line, end_line }] } | After all tokens |

### Frontend SSE Parser (services/api.js)

```js
function parseSSE(block) {
  const eventLine = block.split('\n').find(l => l.startsWith('event:'));
  const dataLine  = block.split('\n').find(l => l.startsWith('data:'));
  if (!dataLine) return null;
  return {
    event: eventLine ? eventLine.replace('event:', '').trim() : 'message',
    data: JSON.parse(dataLine.replace('data:', '').trim()),
  };
}
```

Raw stream split on `'\n\n'`; each block parsed by the above function.

---

## 8. Frontend Deep Dive

### 8.1 Routing - App.jsx

```
BrowserRouter
+-- <Cursor />            (global, always mounted)
+-- <TransitionOverlay /> (global, always mounted)
+-- Routes
    +-- /     -> <LandingPage />
    +-- /app  -> <AppPage />
```

### 8.2 Landing Page - pages/LandingPage.jsx

Scroll-driven cinematic narrative with 6 acts via GSAP ScrollSmoother + ScrollTrigger (CDN). Falls back to static layout without GSAP.

| Section | Act | Three.js State | Content |
|---|---|---|---|
| Hero | 0% | Cube cloud | GitMind tagline + CTA |
| Clone | 16% | Cubes form column | Terminal animation: git clone |
| Scan | 33% | Column moves | File tree scanning visualization |
| Embed | 50% | Cubes cluster + orbit | VectorField canvas: 300 dots -> 6 semantic clusters |
| Answer | 66% | Cluster recedes | Typewriter streaming answer demo |
| CTA | 83-100% | Scene recedes | Start now button -> /app |

**ThreeBackground.jsx:**
- 200 BoxGeometry(0.3) meshes (code files) + 1 TorusKnotGeometry (AI core)
- Camera driven by scroll via 7-keyframe lerpKeys() for CAM_Z, CAM_X, CAM_ROT
- Cube choreography: cloud -> column -> cluster -> orbit -> recede
- Degrades to CSS conic-gradient on mobile or prefers-reduced-motion

### 8.3 App Page - pages/AppPage.jsx

Main application shell. Internal sub-components:

| Component | Purpose |
|---|---|
| MiniEQ | Animated EQ bars in model chip (top-right header) |
| StageViz | Full-screen canvas animation during indexing (5 stage variants) |
| IndexingOverlay | Full-screen overlay during indexing: stage label, progress bar, log lines |
| IndexModal | Modal form for GitHub URL input; transitions to IndexingOverlay on submit |
| Welcome | Empty state when no repos are indexed |
| RepoView | Tabs - Overview/Chat - using display:none to preserve ChatView state |
| Sidebar | Left rail of repos + "+ Index New Repo" button |
| AppPage root | State: showIntro, repos[], activeRepo, showModal; fetches repo list on mount |

**Key patterns:**
- `ChatView` always mounted inside `RepoView`; toggled via `display:none` preserving conversation state
- `handleIndexed()` deduplicates by `repository_id` before adding to `repos[]`

### 8.4 ChatView - components/ChatView.jsx

- **Messages:** user (amber-right), assistant (dark-left with ReactMarkdown)
- **Suggestion chips:** 5 pre-built questions in empty state
- **Character ring:** SVG ring showing typing progress (green -> yellow -> red at 90%)
- **Send button:** Magnetic hover - translates toward cursor within 40px radius
- **Auto-scroll:** scrolls to bottom on new messages
- **Citations:** pill list below each assistant message: `file_path:start-end`
- **Input placeholder:** `query {repo.name}://`

### 8.5 RepoOverview - components/RepoOverview.jsx

- **StatCard:** 3D tilt on mouse move (perspective 600px rotateY/rotateX); slot-machine count-up via IntersectionObserver
- **Language bar:** proportional color segments using LANG_COLORS map for 25+ languages
- **File tree:** list with amber dot per file
- **Stat cards:** Files indexed, Chunks, Languages, Indexed date

### 8.6 Global Components

**Cursor.jsx** - cursor-dot (instant) + cursor-ring (18% lerp trailing). Uses GSAP quickSetter if available, falls back to rAF. States: default / hovering (a, button, [data-hover]) / crosshair ([data-cursor="crosshair"]) / clicking. Disabled on mobile/touch/reduced-motion.

**TransitionOverlay.jsx** - Amber-to-teal gradient; clip-path: inset(0 100% 0 0) -> amber-sweep keyframe (620ms) on every route change. Skipped on first render and prefers-reduced-motion.

**IntroScreen.jsx** - One-time boot sequence on first /app visit (~4.5s):
```
> INITIALIZING BIOLUMINESCENT FORGE...
> LOADING SENTENCE TRANSFORMERS...
> CONNECTING TO GROQ / LLAMA-3.3-70B...
> VECTOR DATABASE ONLINE...
> SYSTEM READY.
```

### 8.7 API Client - services/api.js

| Function | Transport | Description |
|---|---|---|
| getHealth() | Axios GET | /health ping |
| listRepositories() | Axios GET | /api/repositories/ |
| getRepository(id) | Axios GET | /api/repositories/{id} |
| requestRepositoryIndex(url) | Axios POST | Non-streaming index |
| indexRepositoryWithProgress(url, cbs) | Fetch + SSE | Streaming: onProgress, onComplete, onError |
| streamChatResponse(opts) | Fetch + SSE | Streaming: onToken, onCitations, onError |

Base URL from `VITE_API_BASE_URL`, defaults to `http://localhost:8000`.

---

## 9. API Reference

### GET /health

```json
{ "status": "ok", "service": "GitMind Pro", "environment": "development" }
```

### GET /api/repositories/

```json
{
  "repositories": [
    {
      "id": "uuid",
      "url": "https://github.com/org/repo",
      "name": "repo",
      "status": "indexed",
      "indexed_at": "2026-06-27T12:00:00+00:00",
      "indexed_files": 48,
      "chunks": 203,
      "readme_excerpt": "# ...",
      "file_tree": ["src/main.py"],
      "language_stats": { "py": 32, "md": 4 }
    }
  ],
  "total": 1
}
```

### POST /api/repositories/index/stream

Request: `{ "repository_url": "https://github.com/org/repo" }`
Response: `text/event-stream`

```
event: progress
data: {"stage": "cloning", "percent": 5, "message": "Cloning repository..."}

event: complete
data: {"repository_id": "...", "name": "repo", "indexed_files": 48, "chunks": 203}
```

### POST /api/chat/stream

Request: `{ "repository_id": "uuid", "message": "How does auth work?" }`
Response: `text/event-stream`

```
event: token
data: {"text": "The auth middleware lives in "}

event: citations
data: {"citations": [{"file_path": "src/auth.py", "start_line": 12, "end_line": 45}]}
```

---

## 10. Configuration Reference

### Backend .env

```ini
APP_ENV=development
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

CHROMA_PERSIST_DIRECTORY=./data/chroma
REPOSITORY_STORAGE_DIRECTORY=./data/repos
REPOSITORY_STATE_FILE=./data/state/repositories.json
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2

# Wired but not active in core flow:
DATABASE_URL=postgresql+psycopg://gitmind:gitmind@localhost:5432/gitmind
REDIS_URL=redis://localhost:6379/0
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

### Frontend .env

```ini
VITE_API_BASE_URL=http://localhost:8000
```

---

## 11. Docker and Deployment

`docker-compose.yml` defines 4 services:

| Service | Image | Port | Notes |
|---|---|---|---|
| backend | Built from ./backend/Dockerfile | 8000 | Depends on postgres + redis healthy |
| frontend | Built from ./frontend/ | 5173 | Depends on backend healthy |
| postgres | postgres:16-alpine | 5432 | Health: pg_isready |
| redis | redis:7-alpine | 6379 | Health: redis-cli ping |

Named volumes: `backend-data` (ChromaDB, repos, state JSON) + `postgres-data`.

```bash
docker compose up --build
```

> Note: PostgreSQL and Redis are provisioned but not active in core flow. They exist for the planned Celery workers and multi-user PostgreSQL storage.

---

## 12. Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 20+
- Git

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # add GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

The embedding model (all-MiniLM-L6-v2, ~90MB) downloads automatically on first run from HuggingFace and is cached.

### Frontend

```bash
cd frontend
npm install
npm run dev                     # starts at http://localhost:5173
```

### Required Variables

| Variable | Where | Required |
|---|---|---|
| GROQ_API_KEY | backend/.env | Yes (or OPENAI_API_KEY) |
| VITE_API_BASE_URL | frontend/.env | No (defaults to http://localhost:8000) |

---

## 13. Key Design Decisions

### Why JSON state file instead of PostgreSQL?
RepositoryStore uses a plain JSON file with cross-platform advisory lock (os.O_CREAT | os.O_EXCL) and atomic rename on write. Eliminates PostgreSQL dependency for local single-user use. PostgreSQL + SQLAlchemy + Alembic are wired and ready for production.

### Why local embeddings?
all-MiniLM-L6-v2 produces 384-dim vectors locally. No API key, zero cost per embedding, no latency. Downloaded once (~90MB), cached. Embedding 2000 chunks takes ~10-15s on CPU.

### Why n_results=6 for retrieval?
Groq free tier is 12,000 TPM. Each 80-line chunk is ~480 tokens. 6 chunks + system prompt + file tree + README = ~5,000-8,000 tokens - safely under the limit. The previous value of 12 chunks caused 413 Payload Too Large errors with dense codebases.

### Why lockfiles are excluded from indexing?
package-lock.json, yarn.lock, Cargo.lock are auto-generated, contain thousands of lines of package hashes with zero code insight, and score high on semantic similarity for almost any query. They previously bloated prompts by 50%+ and pushed requests over token limits. Now excluded via IGNORED_FILENAMES.

### Why URL-based deduplication in RepositoryStore?
Each indexing run generates a new UUID (needed for ChromaDB collection naming). Without deduplication, re-indexing the same URL creates a second state entry - causing duplicate sidebar entries. upsert_repository() now removes stale entries with the same URL before inserting the new record.

### Why display:none instead of unmounting ChatView?
React unmounts components on tab switch, losing all chat state. display:none keeps ChatView mounted and preserves the full conversation when switching between Overview and Chat tabs.

### Why GSAP from CDN?
GSAP ScrollSmoother and SplitText require a Club GreenSock license for npm. CDN avoids the license requirement for personal/open-source projects. Both ThreeBackground and LandingPage check window.gsap first and degrade gracefully to static layout.

---

## 14. Performance Characteristics

### Indexing

| Phase | Typical Time | Bottleneck |
|---|---|---|
| Clone (shallow, depth=1) | 1-5s | Network |
| File scan + filtering | <0.5s | Disk I/O |
| Chunking | <1s | CPU |
| Embedding (CPU) | 10-30s per 1000 chunks | CPU |
| ChromaDB write | 1-5s | Disk I/O |
| JSON state write | <50ms | Disk I/O |

### Retrieval

| Operation | Typical Time |
|---|---|
| Embed query (local) | ~50ms |
| ChromaDB HNSW query | <10ms |
| Groq first token | ~200ms |
| Full streaming response | 1-4s |

### Hard Limits

| Constraint | Value | Source |
|---|---|---|
| Max file size | 350KB | MAX_FILE_BYTES |
| Max retrieval chunks | 6 | n_results in RAGService |
| File tree in prompt | 60 files | file_tree[:60] |
| README excerpt | 1000 chars | readme_excerpt[:1000] |
| Groq TPM (free tier) | 12,000 tokens/min | Groq API |
| Clone timeout | 120s | CLONE_TIMEOUT_SECONDS |

---

## 15. Known Limitations and Roadmap

### Current Limitations

- **GitHub only** - URL validation accepts only https://github.com/...; GitLab and Bitbucket rejected
- **Public repos only** - no SSH or token-based private repo support
- **No multi-turn context** - each chat message is independent; LLM does not see conversation history
- **CPU-only embeddings** - no GPU; large repos (2000+ chunks) take 30+ seconds
- **Single-user** - JSON state works for one user; concurrent indexing serialized via advisory lock
- **No incremental re-index** - always clones fresh and rebuilds all vectors

### Planned Roadmap

- **AST semantic chunking** - tree-sitter installed; replace line-based chunking with function/class-aware chunks
- **Multi-turn chat** - per-session conversation buffer in LLM context
- **Private repo support** - GitHub PAT on clone
- **Incremental re-indexing** - git diff to only re-embed changed files
- **Celery background workers** - move indexing off request thread (Redis already configured)
- **PostgreSQL persistence** - replace JSON state with PostgreSQL for multi-user (SQLAlchemy already wired)
- **GitLab / Bitbucket** - generalise URL validation and auth
- **Semantic search UI** - direct file/symbol search without LLM
