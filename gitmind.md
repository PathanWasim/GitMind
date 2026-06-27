# GitMind Pro — Complete Technical Reference

> **Version:** 0.1.0  
> **Stack:** FastAPI · ChromaDB · sentence-transformers · Groq / LLaMA 3.3 · React 18 · Three.js · Vite  
> **Author:** PathanWasim  
> **Repository:** https://github.com/PathanWasim/GitMind

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Data Flow Full Pipeline](#6-data-flow-full-pipeline)
7. [Server-Sent Events](#7-server-sent-events)
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

**GitMind Pro** is a local-first, AI-powered codebase intelligence tool. It lets developers point it at any public GitHub repository, index the entire source tree into a local vector database, and then interrogate the codebase in plain English — receiving precise, source-cited answers grounded exclusively in the actual code.

### Core Workflow

1. **Clone** — shallow-clones any public GitHub repository via HTTPS using GitPython with `depth=1`
2. **Scan** — walks the file tree recursively, filters to 30+ supported source extensions, skips binaries and vendor directories
3. **Chunk** — splits every source file into overlapping 80-line sliding windows with 15-line overlap to preserve context at boundaries
4. **Embed** — converts each chunk to a 384-dimensional vector using a local `sentence-transformers` model — no external API call for embeddings
5. **Store** — persists vectors in a local ChromaDB collection keyed by repository UUID, plus metadata in a JSON state file
6. **Query** — embeds the user's question with the same local model, retrieves the top-12 most semantically similar chunks, constructs a layered prompt with file structure + README + code context, and streams the answer token-by-token through Groq LLaMA 3.3 70B (or OpenAI as fallback)
7. **Cite** — every answer carries structured citations: `{ file_path, start_line, end_line }` pointing into the exact source

The system runs **100% locally** except for LLM inference (Groq / OpenAI API). Embeddings, vector search, file storage, and state management are all local and private.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│  React 18 SPA (Vite dev server / production build)          │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │  Landing Page   │  │  App Page (/app)                 │  │
│  │  Three.js       │  │  ChatView (SSE streaming)        │  │
│  │  Neural Nebula  │  │  RepoOverview (stats, file tree) │  │
│  │  WebGL canvas   │  │  IntroScreen (boot animation)    │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP REST + SSE (localhost:8000)
┌──────────────────────────▼───────────────────────────────────┐
│              FastAPI Backend (Uvicorn ASGI)                  │
│  /api/repositories/*  → IndexingService                     │
│  /api/chat/stream     → RAGService                          │
│  /api/analysis/*      → Future AST endpoints                │
│                                                              │
│  IndexingService                RAGService                  │
│  ├ GitHubService (clone)        ├ embed_query()             │
│  ├ EmbeddingService (index)     ├ ChromaDB.query()          │
│  ├ ChromaDB (store)             └ LangChain → LLM stream    │
│  └ RepositoryStore (JSON state)                             │
└──────────────────────────────────────────────────────────────┘
         │                           │
┌────────▼──────────┐     ┌──────────▼────────────┐
│  Local Storage    │     │  External APIs         │
│  ./data/chroma/   │     │  Groq: LLaMA 3.3 70B  │
│  ./data/repos/    │     │  OpenAI: GPT-4o-mini   │
│  ./data/state/    │     │  HuggingFace (once)    │
└───────────────────┘     └───────────────────────-┘
```

---

## 3. Tech Stack

### Backend Dependencies

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Web Framework | FastAPI | 0.115.6 | Async REST API + SSE streaming |
| ASGI Server | Uvicorn | 0.34.0 | Production async server with workers |
| Data Validation | Pydantic v2 + pydantic-settings | 2.10.4 | Request/response models, typed env config |
| Vector Database | ChromaDB | 0.5.23 | Local persistent HNSW vector store |
| Local Embeddings | sentence-transformers | 3.3.1 | all-MiniLM-L6-v2, 384-dim, ~80MB on disk |
| LLM Orchestration | LangChain | 0.3.13 | Prompt construction, streaming, model abstraction |
| LLM Primary | Groq + LLaMA 3.3 70B | langchain-groq 0.2.3 | 800+ tokens/sec via Groq API |
| LLM Fallback | OpenAI GPT-4o-mini | langchain-openai 0.2.14 | Used if Groq API key not set |
| Git Operations | GitPython | 3.1.43 | Shallow clone via Python |
| State Persistence | JSON + advisory lock | stdlib only | Zero-dependency metadata storage |
| Database (wired) | PostgreSQL 16 + SQLAlchemy 2 | 2.0.36 | Ready but not yet active in core flow |
| Task Queue (wired) | Celery 5 + Redis 7 | 5.4.0 | Ready for async background workers |
| Code Parsing | tree-sitter | 0.23.2 | AST parsing stub for future semantic chunking |
| Testing | pytest + httpx + anyio | 8.3.4 | Full async test suite |

### Frontend Dependencies

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.3.1 | Component model, hooks, concurrent rendering |
| Build Tool | Vite | 6.0.5 | HMR dev server, ESM bundling, env vars |
| Routing | React Router DOM | 7.18.0 | Client-side SPA routing |
| HTTP Client | Axios | 1.7.9 | REST calls with interceptors |
| 3D / WebGL | Three.js | 0.185.0 | Neural Nebula particle system + GLSL shaders |
| Markdown Rendering | react-markdown + remark-gfm | 10.1.0 | Render streaming LLM responses |
| Styling | Vanilla CSS | — | Custom design system, no CSS framework |
| Typography | Syne 800 + JetBrains Mono | Google Fonts | Cinematic display + monospace |

### Infrastructure

| Service | Technology | Purpose |
|---|---|---|
| Containerization | Docker + Docker Compose | Full-stack deployment in 4 services |
| Config Management | pydantic-settings + .env | Typed, validated environment configuration |

---

## 4. Repository Structure

```
GitMind/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app, CORS, router registration
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic Settings — all environment variables
│   │   │   └── logging.py             # Structured JSON logging
│   │   ├── api/routes/
│   │   │   ├── repository.py          # GET/POST /repositories/* + SSE streaming index
│   │   │   ├── chat.py                # POST /chat/stream SSE endpoint
│   │   │   └── analysis.py            # Future: AST/analysis (returns 501 now)
│   │   ├── services/
│   │   │   ├── indexing_service.py    # Core: clone → scan → chunk → embed → store
│   │   │   ├── github_service.py      # GitPython shallow clone + URL validation
│   │   │   ├── embedding_service.py   # sentence-transformers local embedding
│   │   │   ├── rag_service.py         # Retrieve + augment + stream LLM response
│   │   │   ├── ast_service.py         # tree-sitter stub (future)
│   │   │   └── security_service.py    # Auth stub (future)
│   │   ├── storage/
│   │   │   └── repository_store.py    # Atomic JSON state + advisory file lock
│   │   ├── vector/
│   │   │   └── chroma_client.py       # ChromaDB persistent client singleton
│   │   ├── schemas/
│   │   │   ├── repository.py          # Pydantic: IndexRequest, IndexResponse, ListResponse
│   │   │   └── chat.py                # Pydantic: ChatStreamRequest
│   │   ├── database/                  # SQLAlchemy ORM models (wired, Alembic ready)
│   │   ├── tests/                     # pytest async test suite
│   │   └── workers/                   # Celery task definitions (wired)
│   ├── alembic/                       # Database migration scripts
│   ├── data/                          # Runtime data (gitignored)
│   │   ├── chroma/                    # ChromaDB vector collections on disk
│   │   ├── repos/                     # Cloned repositories (UUID-named directories)
│   │   └── state/repositories.json   # All indexed repository metadata
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx                   # React root with StrictMode
│   │   ├── App.jsx                    # BrowserRouter + route definitions
│   │   ├── index.css                  # Global design system: tokens, components
│   │   ├── landing.css                # Landing page specific styles
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx        # Hero, features, how-it-works, CTA sections
│   │   │   └── AppPage.jsx            # App shell: repo selector, tabs, modals
│   │   ├── components/
│   │   │   ├── ThreeBackground.jsx    # Three.js GLSL Neural Nebula (WebGL)
│   │   │   ├── IntroScreen.jsx        # Cinematic terminal boot sequence
│   │   │   ├── ChatView.jsx           # Streaming chat with markdown + citations
│   │   │   ├── RepoOverview.jsx       # Stats cards, language bar, file tree
│   │   │   └── Sidebar.jsx            # Legacy sidebar (not used in current layout)
│   │   └── services/api.js            # HTTP + SSE client functions
│   └── package.json
├── docker-compose.yml
├── README.md
└── gitmind.md                         # This file
```

---

## 5. Backend Deep Dive

### 5.1 Entry Point

**`backend/app/main.py`** creates the FastAPI app, applies CORS middleware, registers three routers, and adds a `NotImplementedError` handler that returns `HTTP 501` for partially-wired endpoints. The `/health` endpoint exists for container orchestration health checks.

CORS is configured via `settings.backend_cors_origins` which defaults to `['http://localhost:5173']` and accepts both JSON array and comma-separated string via the `BACKEND_CORS_ORIGINS` env var.

### 5.2 Configuration System

**`backend/app/core/config.py`** — Single `Settings` class via `pydantic_settings.BaseSettings`. Auto-loads `.env`, applies type coercion, validates values. Cached with `@lru_cache` — created once per process.

| Setting | Default | Notes |
|---|---|---|
| `embedding_model_name` | `sentence-transformers/all-MiniLM-L6-v2` | Local model — no API key |
| `chroma_persist_directory` | `./data/chroma` | Survives process restarts |
| `repository_storage_directory` | `./data/repos` | UUID-named subdirectories |
| `repository_state_file` | `./data/state/repositories.json` | JSON metadata |
| `groq_api_key` | empty | Set to enable LLaMA 3.3 70B |
| `groq_model` | `llama-3.1-8b-instant` | Override to `llama-3.3-70b-versatile` |
| `api_prefix` | `/api` | All routes mounted under this |

### 5.3 API Routes

**Repository routes** (`backend/app/api/routes/repository.py`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/repositories/` | List all indexed repos |
| POST | `/api/repositories/index` | Non-streaming index (backward compat) |
| POST | `/api/repositories/index/stream` | SSE streaming index with live progress |
| GET | `/api/repositories/{id}` | Single repo detail |

The streaming endpoint uses `asyncio.Queue` to decouple the indexing task from the HTTP response. `asyncio.create_task(run_indexing())` runs concurrently while `StreamingResponse(generate())` reads from the queue and yields SSE events.

**Chat routes** (`backend/app/api/routes/chat.py`):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat/stream` | SSE streaming Q&A |

### 5.4 Indexing Service

**`backend/app/services/indexing_service.py`** — Core orchestrator.

**Key constants:**
```python
SUPPORTED_EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.go',
    '.rs', '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.swift', '.kt',
    '.scala', '.sql', '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.sh', '.bash', '.ps1', '.html', '.css', '.scss'}
IGNORED_DIRECTORIES = {'.git', '.venv', 'node_modules', 'dist', 'build',
    '__pycache__', '.pytest_cache', '.next', '.nuxt', 'coverage', 'target'}
MAX_FILE_BYTES  = 350_000   # 350 KB ceiling
CHUNK_LINES     = 80        # Lines per sliding window
CHUNK_OVERLAP   = 15        # Overlap between windows
BATCH_SIZE      = 64        # Chunks per embedding batch
```

**Indexing stages with SSE progress:**
```
Stage 1 (cloning,   5%): GitHubService.clone_repository() — depth=1, 120s timeout
Stage 2 (scanning, 25%): process_files() — rglob, filter, binary check
Stage 3 (chunking, 42%): create_chunks() — sliding window per file
Stage 4 (embedding, 55–95%): _index_chunks_with_progress() — batch embed + ChromaDB add
Stage 5 (saving,   96%): RepositoryStore.upsert_repository() — atomic JSON write
Stage 6 (complete, 100%): SSE complete event with full metadata
```

**Chunk ID format** (deterministic, collision-resistant):
```
{repository_id.hex}:{relative_file_path}:{start_line}:{end_line}:{sha1(content)[:12]}
```

**Binary detection:** reads first 2048 bytes and checks for null bytes. Fast, no dependencies.

All blocking I/O is offloaded via `run_in_threadpool()` — the async event loop stays responsive throughout.

### 5.5 GitHub Service

**`backend/app/services/github_service.py`**

URL validation regex: `^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$`

Rejects: SSH URLs, GitLab, Bitbucket, private repos. Accepts only public HTTPS GitHub URLs.

Clone: `Repo.clone_from(url, dest, depth=1)` wrapped in `asyncio.wait_for(timeout=120)`. The blocking GitPython call runs in a thread pool via `run_in_threadpool()` so the event loop is never blocked.

### 5.6 Embedding Service

**`backend/app/services/embedding_service.py`**

Model: `all-MiniLM-L6-v2` — 22M parameters, 384-dim output, ~80 MB on disk.

Loaded once with `@lru_cache`, downloaded from HuggingFace Hub on first run (~80 MB), then cached at `~/.cache/huggingface/`. Subsequent calls hit the in-memory model.

L2 normalization (`normalize_embeddings=True`) means cosine similarity equals the dot product — what ChromaDB HNSW uses internally.

The **identical model** is used for both indexing (chunks) and querying (user question). This is critical — using different models would produce incompatible vector spaces and garbage retrieval results.

### 5.7 ChromaDB Vector Store

**`backend/app/vector/chroma_client.py`**

Persistent mode: writes to `./data/chroma/` on disk. Survives process restarts and container restarts (when the data volume is mounted).

Each repository gets an isolated collection: `repo_{repository_id.hex}`

Per-document storage in each collection:
- `document`: raw source code chunk (up to 80 lines)
- `embedding`: 384-dimensional float32 vector
- `metadata`: `{repo_id, repo_url, file_path, language, start_line, end_line}`
- `id`: deterministic chunk ID

At query time: ChromaDB performs ANN search using HNSW index, returning top-12 results by cosine distance.

### 5.8 RAG Service

**`backend/app/services/rag_service.py`** — the retrieval-augmented generation pipeline.

**Phase 1 — Retrieve:**
```python
query_embedding = embed_query(user_question)   # 384-dim vector
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=min(12, collection_size),
)
# Returns: [{content, metadata, distance}]
```

**Phase 2 — Augment (build human message):**
```
Layer 1: Repository file structure (up to 60 paths)
Layer 2: README excerpt (up to 1,000 characters)
Layer 3: 12 labeled code excerpts
         [file_path:start_line-end_line]
         ```language
         source code chunk
         ```
Layer 4: User question
Each layer separated by ---
```

**Phase 3 — Generate (stream):**
```python
async for chunk in llm.astream([SystemMessage, HumanMessage]):
    yield sse_encode('token', {'text': chunk.content})
yield sse_encode('citations', {'citations': citations_list})
```

**LLM selection strategy:**
```
if GROQ_API_KEY:   → ChatGroq(model='llama-3.3-70b-versatile', temperature=0.1, streaming=True)
if OPENAI_API_KEY: → ChatOpenAI(model='gpt-4o-mini', temperature=0.1, streaming=True)
else:              → Return raw top excerpt (no LLM)
```

**System prompt enforces:**
- Answer ONLY from provided source code context
- Cite file path and line ranges inline: `app/main.py:30-45`
- Trace actual execution flow — not what things are named, what they do
- Markdown + code blocks for code snippets
- Never fabricate function names or behavior not visible in context

### 5.9 Repository Store

**`backend/app/storage/repository_store.py`** — zero-dependency state layer.

**Atomic writes:** Data is written to `.tmp` then `os.replace()` renames atomically. The state file is never partially written even if the process crashes mid-write.

**Advisory locking:** `_ExclusiveLock` uses `os.O_CREAT | os.O_EXCL` to atomically create a `.lock` file. If the lock file already exists, spins with 50ms sleep until acquired (10 second timeout). Ensures correctness under concurrent index requests.

**Data stored per repository:**
`id`, `url`, `name`, `status` (indexed/failed), `indexed_at`, `indexed_files`, `chunks`, `file_tree`, `readme_excerpt`, `language_stats`, `error_message`, `updated_at`

---

## 6. Data Flow Full Pipeline

### 6.1 Indexing Pipeline

```
POST /api/repositories/index/stream
  { repository_url: 'https://github.com/org/repo' }
          │
          ├─ asyncio.Queue created
          ├─ create_task(run_indexing())  ← concurrent background task
          └─ StreamingResponse(generate()) ← reads queue, yields SSE
                    │
         [Stage: cloning, 5%]
          GitHubService.clone_repository()
          • Validate URL regex (GitHub HTTPS only)
          • Shallow clone depth=1 → ./data/repos/<uuid>/
          • asyncio.wait_for(120 seconds)
          • run_in_threadpool (non-blocking)
                    │
         [Stage: scanning, 25%]
          IndexingService.process_files()
          • rglob('*') recursive file discovery
          • Filter: extension whitelist OR SUPPORTED_FILENAMES
          • Reject: IGNORED_DIRECTORIES, files > 350KB, binary files
          • Return sorted list[Path]
                    │
         [Stage: chunking, 42%]
          IndexingService.create_chunks()
          • Read each file UTF-8 (errors='ignore')
          • Sliding window: step=65, window=80 lines
          • Output: [{content, file_path, start_line, end_line, language}]
                    │
         [Stage: embedding, 55%→95%]
          IndexingService._index_chunks_with_progress()
          • Delete existing ChromaDB collection (clean re-index)
          • Create collection: repo_{uuid.hex}
          • For each batch of 64 chunks:
            embed_texts(batch) → list[list[float]]  (local, ~800ms)
            collection.add(docs, embeddings, metadatas, ids)
            Emit proportional progress (55% + 40% * batch/total)
                    │
         [Stage: saving, 96%]
          RepositoryStore.upsert_repository()
          • Atomic write to ./data/state/repositories.json
                    │
         [event: complete]
          { repository_id, name, indexed_files, chunks, language_stats, file_tree }
```

### 6.2 Query / Chat Pipeline

```
POST /api/chat/stream
  { repository_id: 'uuid', message: 'How does auth work?' }
          │
  RAGService.retrieve_context()
  • embed_query(message) → 384-dim vector
  • ChromaDB collection.query(n_results=12)
  • Returns [{content, metadata, distance}]
          │
  RAGService._build_human_message()
  • Layer 1: file tree (up to 60 paths from JSON state)
  • Layer 2: README excerpt (≤1,000 chars)
  • Layer 3: 12 labeled code excerpts [file:L1-L2] ```code```
  • Layer 4: user question
          │
  LangChain ChatGroq.astream([SystemMessage, HumanMessage])
  • SystemMessage: GitMind persona + citation rules
  • HumanMessage: augmented context from above
          │
  Per token: SSE event=token, data={text: '...'}
  After response: SSE event=citations, data={citations: [...]}
          │
  Frontend ChatView
  • Appends tokens to streaming assistant message
  • react-markdown renders GFM in real-time
  • Citations rendered as file:line badges
```

---

## 7. Server-Sent Events

SSE is used over WebSockets for both indexing progress and chat streaming. Key reasons: it is unidirectional (server pushes only), HTTP-native, works through proxies without configuration, and needs no handshake.

### SSE Wire Format

```
event: progress
data: {"stage":"embedding","percent":72,"message":"Embedding batch 3 / 5..."}

event: complete
data: {"repository_id":"...","name":"GitMind","indexed_files":60,"chunks":111}

event: token
data: {"text":"The authentication middleware"}

event: citations
data: {"citations":[{"file_path":"middleware/auth.py","start_line":34,"end_line":52}]}

event: error
data: {"message":"Only public GitHub HTTPS repository URLs are supported."}
```

### Frontend Parsing

The browser `EventSource` API only supports GET — unusable here since both endpoints need POST bodies. Instead, `fetch()` is used with `ReadableStream` and a manual SSE parser:

```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
        const { event, data } = parseSSE(block);
        if (event === 'token')     onToken(data.text);
        if (event === 'citations') onCitations(data.citations);
    }
}
```

---

## 8. Frontend Deep Dive

### 8.1 Application Shell

`App.jsx` mounts a `BrowserRouter` with two routes:
- `/` → `LandingPage` (cinematic marketing page)
- `/app` → `AppPage` (main application interface)

### 8.2 Landing Page

**`frontend/src/pages/LandingPage.jsx`** — cinematic marketing experience.

| Section | Animation / Treatment |
|---|---|
| Sticky Navbar | `backdrop-filter: blur(20px)` glassmorphism; smooth-scroll links |
| Hero | Three.js Neural Nebula WebGL; word-by-word text entrance animation |
| Marquee | CSS `animation: marquee` infinite horizontal scroll of tech chips |
| Stats | Animated count-up to target numbers on scroll entry |
| Features | 6-card bento grid; `mousemove` 3D perspective tilt on each card |
| How It Works | 3-step numbered timeline with large gradient step numbers |
| CTA | Gradient border card with radial `box-shadow` glow effect |
| Footer | Logo + nav links |

**Scroll animations:** `IntersectionObserver` on mount. Elements with class `reveal` gain `visible` when they enter the viewport. CSS `transform + opacity` transitions handle entrance.

**3D card tilt:**
```javascript
card.addEventListener('mousemove', (e) => {
    const rx = ((mouseY - centerY) / height) * 12;
    const ry = -((mouseX - centerX) / width) * 12;
    card.style.transform =
        `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
});
card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)';
});
```

### 8.3 App Page

**`frontend/src/pages/AppPage.jsx`** — main application shell.

State managed in `AppPage`:
- `repos[]` — all indexed repositories, loaded from `GET /api/repositories/` on mount
- `activeRepo` — currently selected repository object
- `showModal` — controls `IndexModal` visibility
- `showIntro` — controls `IntroScreen` visibility

**Critical: Tab state preservation**
Both `<RepoOverview>` and `<ChatView>` are always rendered. Only `display` CSS property is toggled:
```jsx
<div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
    <RepoOverview repo={activeRepo} />
</div>
<div style={{ display: activeTab === 'chat' ? 'flex' : 'none' }}>
    <ChatView repo={activeRepo} />
</div>
```
This preserves all React state (messages, streaming state, citations) across tab switches. Unmounting `ChatView` would destroy all conversation history on every tab switch.

### 8.4 Component Reference

**`IntroScreen.jsx`**
Full-screen cinematic boot overlay. Terminal-style log lines appear sequentially (`> INITIALIZING NEURAL ENGINE...`, `> LOADING VECTOR INDEX...`, `> SYSTEM READY.`). After completion, the overlay zooms out and fades, then calls `onComplete()` to set `showIntro = false`.

**`ChatView.jsx`**
Conversational interface. Message structure: `{ role: 'user'|'assistant', content: string, citations: [] }`.
On submit:
1. Append user message
2. Append empty assistant placeholder
3. Call `streamChatResponse({ repositoryId, message, onToken, onCitations, onError })`
4. `onToken(text)` → functional update to append to last message content
5. `onCitations(list)` → attach to last message

Empty state shows 5 clickable suggestion chips for common queries.

**`RepoOverview.jsx`**
Four stat cards (Files Indexed, Code Chunks, Languages, Last Indexed). Proportional horizontal language bar (colored segments). Interactive file tree with folder expand/collapse. Collapsible README excerpt.

**`ThreeBackground.jsx`** — see Section 8.5.

### 8.5 Three.js Neural Nebula

**`frontend/src/components/ThreeBackground.jsx`**

Full-viewport WebGL canvas at `position: fixed`, `z-index: 0`. All content sections have solid `var(--bg)` or `var(--bg-2)` backgrounds at `z-index: 10` to prevent particle bleed-through.

**Particle system: 3,500 particles**
- Distributed on a sphere surface using spherical coordinates
- Each particle has a unique `aRand` attribute (0–1) controlling orbit speed, phase, color
- Vertex shader animates position with `sin(uTime * speed + phase)` offsets
- Weak mouse attraction: `pull = 0.10 / (dist² + 0.6)`
- Color interpolated between three deep dark hues (no white = no text washout):
  - Deep indigo `(0.30, 0.31, 0.82)`
  - Violet `(0.45, 0.27, 0.85)`
  - Deep cyan `(0.03, 0.55, 0.75)`
- Alpha: `0.25 + aRand * 0.25` (max 0.5, subtle)
- `THREE.AdditiveBlending` for glow effect

**Neural lines**
- Pairs of particles within distance 1.2 are connected
- Line alpha: `vAlpha * 0.18` (barely visible network)
- Color: `(0.35, 0.36, 0.80)`

**Performance:** 3,500 particles + ~6,000 neural lines at 60fps. No post-processing. Works on any WebGL 1.0-capable GPU.

### 8.6 API Service Layer

**`frontend/src/services/api.js`**

Axios instance pre-configured with `baseURL` from `VITE_API_BASE_URL`. All SSE functions use native `fetch()` + `ReadableStream` for POST support.

```javascript
// REST
listRepositories()                    → GET  /api/repositories/
getRepository(id)                     → GET  /api/repositories/{id}
requestRepositoryIndex(url)           → POST /api/repositories/index

// SSE — Indexing
indexRepositoryWithProgress(url, {
    onProgress(stage, percent, message),
    onComplete(repoData),
    onError(message)
})

// SSE — Chat
streamChatResponse({
    repositoryId, message,
    onToken(text),
    onCitations(citations),
    onError(message)
})
```

### 8.7 Design System

**`frontend/src/index.css`** defines all tokens as CSS custom properties:

```css
:root {
  --bg:        #04040C;                       /* Near-black base */
  --bg-2:      #0C0C18;                       /* Cards, sections */
  --border:    rgba(255,255,255,0.06);
  --indigo:    #6366F1;                       /* Primary accent */
  --indigo-2:  #818CF8;                       /* Labels, secondary */
  --iglow:     rgba(99,102,241,0.3);          /* Glow borders */
  --violet:    #8B5CF6;
  --cyan:      #06B6D4;
  --green:     #10B981;
  --w1: #FFFFFF;  --w2: rgba(255,255,255,0.75);
  --w3: rgba(255,255,255,0.45);  --w4: rgba(255,255,255,0.25);
  --syne:   'Syne', sans-serif;
  --mono:   'JetBrains Mono', monospace;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease:   cubic-bezier(0.4, 0, 0.2, 1);
}
```

Typography uses `clamp()` for fluid sizing. Hero: `clamp(64px, 10vw, 130px)` Syne 900. Section titles: `clamp(36px, 4vw, 54px)` Syne 800. Body: 14–16px at `var(--w2)`.

Z-index layering: Three.js canvas at `z-index: 0`, all page content at `z-index: 10` with opaque backgrounds. This was the fix for the particle bleed-through issue where the WebGL canvas was visible through transparent React sections.

---

## 9. API Reference

### Health Check
```
GET /health
→ 200 { status: 'ok', service: 'GitMind Pro', environment: 'development' }
```

### Repository Endpoints
```
GET  /api/repositories/
→ 200 { repositories: [...RepositoryResponse], total: N }

POST /api/repositories/index
Body: { repository_url: 'https://github.com/org/repo' }
→ 200 { repository_id, status, repo_url, name, indexed_files, chunks }

POST /api/repositories/index/stream
Body: { repository_url: 'https://github.com/org/repo' }
→ 200 text/event-stream
  event: progress  { stage, percent, message }
  event: complete  { repository_id, name, indexed_files, chunks, ... }
  event: error     { message }

GET  /api/repositories/{uuid}
→ 200 RepositoryResponse
→ 404 { detail: 'Repository not found.' }
```

### Chat Endpoint
```
POST /api/chat/stream
Body: { repository_id: 'uuid', message: 'How does auth work?' }
→ 200 text/event-stream
  event: token      { text: '...' }
  event: citations  { citations: [{ file_path, start_line, end_line }] }
```

### RepositoryResponse Schema
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://github.com/PathanWasim/GitMind",
  "name": "GitMind",
  "status": "indexed",
  "indexed_at": "2026-06-26T17:00:00Z",
  "indexed_files": 60,
  "chunks": 111,
  "file_tree": ["backend/app/main.py", "frontend/src/App.jsx"],
  "readme_excerpt": "# GitMind Pro...",
  "language_stats": { "py": 38, "jsx": 6, "js": 5, "css": 2, "md": 3 }
}
```

---

## 10. Configuration Reference

**`backend/.env`** (create from `.env.example`):

```env
APP_NAME=GitMind Pro
APP_ENV=development
API_PREFIX=/api

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:5173"]

# LLM — configure at least one (Groq preferred for speed)
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_API_KEY=sk-your_key_here
OPENAI_MODEL=gpt-4o-mini

# Embeddings (local, no API key required)
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2

# Storage
CHROMA_PERSIST_DIRECTORY=./data/chroma
DATA_DIRECTORY=./data
REPOSITORY_STORAGE_DIRECTORY=./data/repos
REPOSITORY_STATE_FILE=./data/state/repositories.json

# Infrastructure (required only with Docker Compose)
DATABASE_URL=postgresql+psycopg://gitmind:gitmind@localhost:5432/gitmind
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

**`frontend/.env`**:
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 11. Docker and Deployment

**`docker-compose.yml`** — 4-service stack:

| Service | Image | Port | Health Check | Depends On |
|---|---|---|---|---|
| backend | ./backend/Dockerfile | 8000 | GET /health | postgres, redis |
| frontend | ./frontend/Dockerfile | 5173 | — | backend |
| postgres | postgres:16-alpine | 5432 | pg_isready | — |
| redis | redis:7-alpine | 6379 | redis-cli ping | — |

The `backend-data` named volume mounts to `/app/data` inside the backend container, persisting all ChromaDB collections, cloned repositories, and the JSON state file across restarts and re-deployments.

```bash
# Start full stack
docker compose up --build

# Start backend + dependencies only
docker compose up backend postgres redis

# View backend logs
docker compose logs -f backend

# Wipe everything including volumes
docker compose down -v
```

---

## 12. Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Git available on PATH

### Backend Setup

```bash
cd backend

# Virtual environment
python -m venv .venv
.venv\Scripts\activate           # Windows PowerShell
source .venv/bin/activate          # macOS / Linux

# Dependencies
pip install -r requirements.txt
# Downloads all-MiniLM-L6-v2 (~80MB) to HuggingFace cache on first run

# Environment
copy .env.example .env             # Windows
cp .env.example .env               # macOS / Linux
# Add GROQ_API_KEY to .env

# Start with hot-reload
uvicorn app.main:app --reload --port 8000
# API: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

### First Use

1. Open `http://localhost:5173` — cinematic landing page loads
2. Click **Launch App →** — navigates to `/app`
3. `IntroScreen` boot sequence plays once
4. Click **+ Index** in the top bar
5. Paste any public GitHub URL: `https://github.com/PathanWasim/GitMind`
6. Watch live SSE progress: cloning → scanning → chunking → embedding (30-60s)
7. Repo auto-selected after indexing completes
8. Click **Chat** tab
9. Ask: *'How does the indexing pipeline work?'*
10. Receive streaming answer with file:line source citations

---

## 13. Key Design Decisions

### Local Embeddings Instead of OpenAI Embeddings API

`all-MiniLM-L6-v2` runs locally: zero API cost, zero latency, source code never leaves the machine during indexing. The 384-dimensional output is more than sufficient for semantic code search. The 22M parameter model fits comfortably in RAM and runs at ~800ms per 64-chunk batch on CPU. Most importantly, using the same model for both indexing and querying guarantees vector space compatibility — a different model for each would produce garbage retrieval.

### JSON File Store Instead of PostgreSQL

The metadata query pattern is always 'list all' or 'get by UUID' — no SQL joins or aggregations. A JSON file with atomic writes and advisory locking handles this correctly with zero external dependencies. PostgreSQL and SQLAlchemy are fully wired and ready to activate for multi-user support. Switching requires only a change to the store implementation, not the service layer.

### SSE Instead of WebSockets

Both indexing progress and LLM streaming are strictly unidirectional: server pushes data, client only receives. SSE is the correct protocol for this pattern. It works over standard HTTP/1.1 and HTTP/2, passes through any proxy without configuration, and requires no handshake overhead. `fetch()` + `ReadableStream` is used instead of `EventSource` to enable POST request bodies.

### Always-Mounted Tab Views

Conditional rendering (`activeTab === 'chat' && <ChatView />`) would unmount `ChatView` every time the user switches to Overview, destroying all message history, streaming state, and citations. The solution — render both always, toggle `display` CSS property — preserves the entire React subtree state. The display property hides the element from layout without triggering React unmounting. Memory cost: negligible.

### Shallow Clone (depth=1)

GitMind indexes the current source tree only — git history is irrelevant. A `depth=1` shallow clone fetches only the latest commit and no ancestor history. For repos with thousands of commits and years of history, this reduces clone time from 5–10 minutes to 5–30 seconds and storage from gigabytes to megabytes.

### Deterministic Chunk IDs

Chunk IDs incorporate `sha1(content)[:12]`. This ensures that identical code appearing in different files produces unique IDs. Re-running the indexer on the same repo produces the same IDs, enabling idempotent behavior. In practice, the entire collection is deleted and recreated on each index run for simplicity, but deterministic IDs are ready for incremental indexing.

---

## 14. Performance Characteristics

| Operation | Duration | Bottleneck |
|---|---|---|
| Shallow git clone | 5–30 seconds | Network + repo size |
| File scan (1,000 files) | < 1 second | Filesystem I/O |
| Chunking (1,000 files) | 1–3 seconds | CPU string processing |
| Embedding 64 chunks | ~800 ms | CPU inference (no GPU) |
| Embedding 1,000 chunks | ~12 seconds | Linear with batch count |
| ChromaDB HNSW insert (1,000 docs) | ~1 second | Local disk + index |
| ChromaDB ANN query (top-12) | < 50 ms | In-memory HNSW |
| Groq LLM first token latency | 200–500 ms | Network + GPU spin-up |
| Groq LLaMA 3.3 70B full response | 2–8 seconds | ~800 tokens/s |
| **Total: ~60-file repo** | **~45 seconds** | Dominated by embedding |
| **Total: ~500-file repo** | **~3–5 minutes** | Linear with chunk count |

GPU-accelerated embedding would reduce the dominant embedding step by 5–10x. ChromaDB ANN search performance degrades only gradually up to millions of documents.

---

## 15. Known Limitations and Roadmap

### Current Limitations

| Limitation | Impact | Notes |
|---|---|---|
| Public GitHub HTTPS only | Cannot index private or non-GitHub repos | By design (URL regex) |
| No authentication | API is open; local use only | Add auth before exposing publicly |
| No incremental indexing | Full re-clone + re-embed every time | Wasteful for small changes |
| Single repo per chat | No cross-repo queries | Per-collection RAG design |
| No automatic cleanup | Repos + ChromaDB collections grow indefinitely | Manual deletion |
| 350 KB file limit | Large generated/bundled files skipped | Expected behavior |
| Line-based chunking | Function bodies may split at window boundaries | Future: AST chunking |
| No conversation persistence | Messages lost on page refresh | Future: database storage |

### Wired Infrastructure (Ready to Enable)

| Feature | Location | What It Needs |
|---|---|---|
| PostgreSQL | `backend/app/database/` | Connect `RepositoryStore` to SQLAlchemy models |
| Celery workers | `backend/app/workers/` | Point indexing at task queue |
| tree-sitter AST | `backend/app/services/ast_service.py` | Implement function-level chunker |
| Analysis endpoints | `backend/app/api/routes/analysis.py` | Implement handlers |
| Authentication | `backend/app/services/security_service.py` | JWT or API key middleware |

### Planned Roadmap

- **Incremental re-indexing** — detect changed files via `git diff`, re-embed only deltas
- **Multi-repo chat** — RAG across multiple ChromaDB collections in one query
- **GitLab and Bitbucket support** — extend URL validation regex
- **Private GitHub repos** — accept GitHub PAT in the index request
- **AST-aware semantic chunking** — tree-sitter splits at function/class boundaries
- **Persistent conversation history** — store messages in PostgreSQL
- **Dependency graph visualization** — render import/dependency graph from AST
- **Multi-user support** — auth layer, per-user repo isolation, usage quotas
- **Codebase diff analysis** — compare two commits or branches semantically

---

*GitMind Pro — built to make any codebase instantly queryable.*
*Local-first. Privacy-preserving. Source-cited.*