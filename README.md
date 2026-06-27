# GitMind Pro

**AI-powered codebase intelligence. Ask anything about any GitHub repository and get source-cited answers grounded in the actual code.**

---

## What it does

GitMind Pro lets you index any public GitHub repository and query it in plain English. Under the hood it:

1. **Clones** the repo (shallow, `depth=1`)
2. **Scans** source files - 30+ extensions supported, auto-generated lockfiles excluded
3. **Chunks** every file into 80-line overlapping windows
4. **Embeds** each chunk locally using `sentence-transformers/all-MiniLM-L6-v2` (no external API for embeddings)
5. **Stores** vectors in a local ChromaDB collection
6. **Retrieves** the top-6 most relevant chunks per query
7. **Streams** a source-cited answer via Groq LLaMA 3.1 8B Instant (or OpenAI as fallback)

Everything runs locally except LLM inference. No data leaves your machine beyond the chat request.

---

## Tech Stack

| Component | Technology |
|---|---|
| **Backend** | FastAPI, Uvicorn, Pydantic v2 |
| **Vectors** | ChromaDB (local persistent HNSW) |
| **Embeddings** | sentence-transformers all-MiniLM-L6-v2 |
| **LLM** | Groq LLaMA 3.1 8B Instant, OpenAI GPT-4o-mini (fallback) |
| **Git** | GitPython (shallow clone) |
| **Frontend** | React 18, Vite, Three.js, React Router |
| **Deployment** | Docker Compose (backend, frontend, PostgreSQL, Redis) |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+
- A [Groq API key](https://console.groq.com) (free tier works)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
cp .env.example .env          # fill in GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

The embedding model (~90 MB) downloads automatically on first run and is cached locally.

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

### Environment Variables

| Variable | Where | Required |
|---|---|---|
| `GROQ_API_KEY` | `backend/.env` | Yes (or `OPENAI_API_KEY`) |
| `VITE_API_BASE_URL` | `frontend/.env` | No - defaults to `http://localhost:8000` |

### Docker (full stack)

```bash
docker compose up --build
```

Starts backend (:8000), frontend (:5173), PostgreSQL (:5432), Redis (:6379).

---

## Usage

1. Open `http://localhost:5173`
2. Click **Index a Repository**, paste a public GitHub URL
3. Watch the real-time progress: clone -> scan -> embed -> done
4. Switch to the **Chat** tab and ask anything:
   - *How does authentication work?*
   - *What is the overall architecture?*
   - *Where is the database connection configured?*
5. Every answer includes file path + line number citations

---

## Project Structure

```
GitMind/
+- backend/
|  +- app/
|  |  +- main.py               # FastAPI entry point
|  |  +- core/config.py        # Pydantic settings
|  |  +- api/routes/           # REST + SSE endpoints
|  |  +- services/             # IndexingService, RAGService, etc.
|  |  +- storage/              # JSON state store with advisory lock
|  |  +- vector/               # ChromaDB client
|  |  +- requirements.txt
+- frontend/
|  +- src/
|     +- pages/LandingPage.jsx # Scroll-driven Three.js story
|     +- pages/AppPage.jsx     # Main app shell
|     +- components/           # ChatView, RepoOverview, Cursor, etc.
|     +- services/api.js       # HTTP + SSE client
+- docker-compose.yml
+- README.md
+- gitmind.md                    # Full technical reference
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/repositories/` | List all indexed repositories |
| `POST` | `/api/repositories/index/stream` | Index repo with SSE progress |
| `GET` | `/api/repositories/{id}` | Get repository metadata |
| `POST` | `/api/chat/stream` | Stream RAG chat response |

Full API docs at `http://localhost:8000/docs` (FastAPI auto-generated Swagger UI).

---

## Design Notes

- **Local-first** - embeddings and vector search run entirely on your machine
- **No duplicate repos** - re-indexing the same URL replaces the existing entry (URL-based deduplication)
- **Lockfile exclusion** - `package-lock.json`, `yarn.lock`, `Cargo.lock` etc. are skipped to prevent token overflow
- **Token budget** - retrieval capped at 6 chunks to stay within Groq's free-tier 12K TPM limit
- **Crash-safe writes** - state uses atomic rename (`os.replace`) on every write
- **Tab state preserved** - chat messages survive tab switches via `display:none` (no unmount)

---

## Roadmap

- [ ] Multi-turn conversation history
- [ ] Private repository support (GitHub PAT)
- [ ] AST-based semantic chunking (tree-sitter already installed)
- [ ] Incremental re-indexing via git diff
- [ ] Background indexing via Celery workers
- [ ] PostgreSQL multi-user persistence
- [ ] GitLab / Bitbucket support

---

## License

MIT
