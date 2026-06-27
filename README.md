# 🧠 GitMind Pro

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0080FF?style=for-the-badge&logo=vector)](https://www.trychroma.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Groq](https://img.shields.io/badge/Groq-f46336?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**GitMind Pro** is a local-first, privacy-focused AI Codebase Intelligence Platform. Point GitMind Pro at any public GitHub repository, index it into a local vector database using locally computed embeddings, and interrogate the codebase in plain English. Get precise, token-streaming answers grounded in your code, complete with exact source-file citations.

Featuring a **cinematic, scroll-driven WebGL experience** on the landing page and an intuitive, state-preserving terminal interface in the application shell.

---

## ✨ Key Features

- **🔒 100% Local Embeddings:** Utilizes a local `sentence-transformers/all-MiniLM-L6-v2` model. Your source code is embedded on your CPU and never uploaded to third-party APIs during the indexing phase.
- **⚡ High-Speed LLM Inference:** Streams answers at **800+ tokens/sec** using Groq's LLaMA 3.3 70B model (with OpenAI GPT-4o-mini as a built-in fallback).
- **📂 Shallow Git Ingestion:** Performs `depth=1` shallow cloning using GitPython to minimize disk footprint and network overhead for large repositories.
- **📖 Slide-Window Chunking:** Splits code files into overlapping 80-line windows with a 15-line overlap to preserve lexical context across chunk boundaries.
- **💬 State-Preserving Chat UI:** Keep your conversation flow active. The chat interface stays alive and mounted in the DOM when navigating between repository stats and chat view tabs.
- **🎨 Cinematic WebGL Atmosphere:** An interactive 3D particle constellation (Three.js/GLSL shaders) visualizes your repository files as floating star clusters that morph and orbit dynamically as you scroll through the pipeline lifecycle.
- **📌 Exact Inline Citations:** Every assistant response highlights source files and line ranges (e.g., `middleware/auth.py:34-52`) as clickable badges.

---

## 📐 Architecture & Data Flow

```
                     ┌───────────────────────────────┐
                     │         React 18 SPA          │
                     │  (Vite, Three.js, Vanilla CSS)│
                     └───────────────┬───────────────┘
                                     │
                        HTTP REST / SSE (Port 8000)
                                     │
                     ┌───────────────▼───────────────┐
                     │        FastAPI Backend        │
                     │    (Uvicorn ASGI Web Server)   │
                     └───────┬───────────────┬───────┘
                             │               │
                 ┌───────────▼───┐       ┌───▼───────────┐
                 │IndexingService│       │  RAGService   │
                 └───────┬───────┘       └───┬───────────┘
                         │                   │
                 ┌───────▼───────┐       ┌───▼───────────┐
                 │ GitHubService │       │  Local Model  │
                 │(Shallow Clone)│       │(all-MiniLM-L6)│
                 └───────┬───────┘       └───┬───────────┘
                         │                   │
                 ┌───────▼───────┐       ┌───▼───────────┐
                 │Local Storage  │       │  ChromaDB     │
                 │(JSON + Repos) │       │(Persistent DB)│
                 └───────────────┘       └───────┬───────┘
                                                 │
                                         ┌───────▼───────┐
                                         │  External API │
                                         │(Groq / OpenAI)│
                                         └───────────────┘
```

### Ingestion Pipeline
1. **Clone:** Validate public repository HTTPS format and clone the head commit (`depth=1`).
2. **Scan:** Scan files recursively. Whitelist source extensions (`.py`, `.jsx`, `.go`, etc.), skip ignored directories (`node_modules`, `.git`, `.venv`), and exclude files larger than 350 KB or binary formats.
3. **Chunk:** Segment discovered files into sliding text chunks of 80 lines.
4. **Embed & Store:** Embed chunks using the local sentence transformer model and insert vectors + source metadata into ChromaDB. Save repository catalog to metadata JSON.

### Query Pipeline
1. **Retrieve:** Translate the user query into a vector and perform an HNSW-based vector search against ChromaDB to extract the 12 most similar code snippets.
2. **Context Assembly:** Construct a structured prompt listing the repository file tree, README outline, code snippets with file markers, and the query.
3. **LLM Generation:** Send the prompt to Groq/OpenAI and yield the tokens in real-time using Server-Sent Events (SSE).
4. **Citation Output:** Once generation finishes, emit a final structured payload containing the document citations.

---

## 🛠️ Tech Stack

- **Backend:**
  - **Framework:** FastAPI
  - **Vector DB:** ChromaDB (Persistent local mode)
  - **Embeddings:** HuggingFace `sentence-transformers/all-MiniLM-L6-v2` (L2 Normalized)
  - **LLM Engine:** LangChain + Groq API (`llama-3.3-70b-versatile`) / OpenAI API (`gpt-4o-mini`)
  - **Git Utility:** GitPython
  - **State Store:** JSON Database with cross-platform advisory file locking
- **Frontend:**
  - **Build / Runtime:** React 18 (Vite, React Router DOM v7)
  - **WebGL Physics:** Three.js with Custom GLSL Shader Material
  - **MD Parser:** react-markdown + remark-gfm
  - **HTTP Client:** Axios (Stream parsing with fetch hooks)
- **Infrastructure:**
  - Docker & Docker Compose configuration

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Git installed and added to your system path

### 1. Backend Setup

Configure your Python environment and download the embedding weights:

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies (will fetch HF model cache on first execution)
pip install -r requirements.txt

# Create your local environment file
cp .env.example .env
```

Open `.env` and fill in your API key:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
# Optional fallback:
# OPENAI_API_KEY=sk_your_openai_key_here
```

Start the FastAPI application:
```bash
uvicorn app.main:app --reload --port 8000
```
- API Endpoint: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

### 2. Frontend Setup

Install standard packages and boot up the development server:

```bash
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

# Run the Vite server
npm run dev
```
- Web Application: `http://localhost:5173`

---

### 3. Docker Compose Setup

Run the entire platform (including Postgres and Redis instances pre-configured for future production features):

```bash
# Run from root directory
docker compose up --build
```
- **Frontend Dashboard:** `http://localhost:5173`
- **Backend API Server:** `http://localhost:8000`
- **Postgres Database:** `localhost:5432`
- **Redis Instance:** `localhost:6379`

---

## 📡 API Reference

### Repository Operations

#### `POST /api/repositories/index/stream`
Indexes a repository and streams the progress stage and percentages in real time.
- **Request Body:**
  ```json
  { "repository_url": "https://github.com/PathanWasim/GitMind" }
  ```
- **SSE Stream Sequence:**
  ```
  event: progress
  data: {"stage": "cloning", "percent": 5, "message": "Cloning repository…"}
  ...
  event: complete
  data: {"repository_id": "...", "name": "GitMind", "indexed_files": 60, "chunks": 111}
  ```

#### `GET /api/repositories/`
Returns a list of all locally indexed repositories and metadata.

#### `GET /api/repositories/{id}`
Returns details for a specific repository (e.g., file tree, language analysis stats, README metadata).

---

### Chat Operations

#### `POST /api/chat/stream`
Queries the repository context database and streams back structural answers and file reference citations.
- **Request Body:**
  ```json
  {
    "repository_id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Explain the locking mechanism in repository_store.py"
  }
  ```
- **SSE Stream Sequence:**
  ```
  event: token
  data: {"text": "The "}
  event: token
  data: {"text": "locking "}
  ...
  event: citations
  data: {"citations": [{"file_path": "backend/app/storage/repository_store.py", "start_line": 12, "end_line": 50}]}
  ```

---

## 🗺️ Roadmap & Planned Architecture

- [ ] **Incremental Sync:** Detect changed files via Git diffs and update only corresponding vectors.
- [ ] **Multi-Repo Chat:** Connect multiple codebases to a single chat session for system integration queries.
- [ ] **Abstract Syntax Tree (AST) Indexing:** Replace line-based chunking with tree-sitter AST parsing to keep functions, classes, and methods atomic.
- [ ] **Database Persisted History:** Connect PostgreSQL models to save indexed repositories and chat histories persistently.
- [ ] **Task Offloading:** Offload cloning and embedding runs to Redis-backed Celery background workers.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
