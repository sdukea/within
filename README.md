# RecallDB

An AI-native **knowledge database**. The product is PostgreSQL: tables, indexes, tsvector, and pgvector. Claude is a capability on top of those retrieval primitives — not the other way around.

This is not a chatbot with a document uploader. You can inspect three retrieval strategies independently, read the SQL they run, fuse them with reciprocal rank fusion, then optionally ask a model to answer or to write a `SELECT`.

## Architecture

```
React studio  →  FastAPI  →  PostgreSQL + pgvector
                     │
                     ├─ ingest: chunk → embed (OpenAI 1536-d) → INSERT
                     ├─ structured / full-text / semantic / hybrid retrieve
                     ├─ RAG: hybrid retrieve → Claude
                     └─ NL-to-SQL: Claude → validate SELECT → execute
```

- **Backend:** Python, FastAPI, **raw SQL via psycopg3** (no ORM).
- **Database:** Postgres with `vector`. Schema lives in `backend/schema.sql` and is applied on API startup.
- **Frontend:** React + TypeScript + Tailwind. One shell: sidebar + Ask / Query / Search.
- **Generation:** Anthropic Claude (RAG answers, NL-to-SQL).
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dimensions). Claude has no embedding endpoint; the column is `VECTOR(1536)` to match this model.

### Data model

| Table | Role |
|---|---|
| `projects` | Namespace for documents |
| `documents` | Ingested source (title + optional source label) |
| `document_chunks` | Retrieval unit: `content`, `embedding`, `tsv` |

`tsv` is maintained by a `BEFORE INSERT OR UPDATE` trigger from `content`. Application code never writes `tsv` directly. GIN sits on `tsv`; HNSW (cosine) sits on `embedding`.

Chunking (`backend/chunking.py`): split on blank lines; if a paragraph exceeds ~400 words, sentence-split and pack.

All queries that take user values use psycopg placeholders (`%s` / `%(name)s`). Nothing concatenates untrusted strings into SQL except the NL-to-SQL path, which only runs after a validator accepts a single `SELECT`.

## Three retrieval strategies (and why hybrid)

Implemented as **four separate functions** in `backend/retrieval.py` and four routes. Do not collapse them — the Search tab exists so you can see them disagree.

### 1. Structured (`structured_retrieve`)

SQL filters: `project_id`, title `ILIKE`, `created_at` range. Ordered by recency, not relevance. This is the relational database doing what it already does well: predicates on columns.

### 2. Full-text (`fulltext_retrieve`)

`plainto_tsquery('english', query)` against `document_chunks.tsv`, ranked with `ts_rank_cd`. This is lexical. It wins when the query shares terms with the document (names, error codes, identifiers). It fails on paraphrase.

### 3. Semantic (`semantic_retrieve`)

Embed the query, then `ORDER BY embedding <=> :q` (pgvector cosine distance). Score is `1 - distance`. This wins when the user asks with different words than the author used. It can miss exact tokens and will retrieve “about the same topic” chunks that are not actually answering the question.

### 4. Hybrid (`hybrid_retrieve`) — default for RAG

Reciprocal Rank Fusion of the full-text list and the semantic list:

```
score(d) = Σ  1 / (k + rank_i(d))     with k = 60
```

Ranks are fused, not raw scores. `ts_rank_cd` and cosine similarity are not on the same scale; averaging them would let one channel dominate. RRF only cares about order, so a chunk that is #1 in either list stays near the top, and a chunk that is decent in **both** lists is boosted.

RAG (`POST /rag`) always uses hybrid, then sends those chunks to Claude with instructions to cite `[chunk:<id>]`. The API also returns the chunk bodies so the UI can expand citations.

## RAG vs NL-to-SQL

| | RAG (`/rag`) | NL-to-SQL (`/nl-sql`) |
|---|---|---|
| Question type | “What does the runbook say about timeouts?” | “How many chunks per document?” |
| Engine | Hybrid retrieval + generation | Claude writes SQL, Postgres executes |
| Grounding | Chunk text in the prompt | Rows in tables |
| Citations | Chunk IDs + document titles | The generated SQL itself |
| Writes | None | None (validator + `transaction_read_only`) |

Use RAG for meaning. Use NL-to-SQL for aggregates, joins, and inventory over the schema. Mixing them in one “chat” box hides which system answered.

NL-to-SQL validation (`backend/nl_sql.py`): one statement, `sqlparse` type `SELECT`, forbidden-keyword blocklist, only `projects` / `documents` / `document_chunks` (plus CTE names), 5s `statement_timeout`, `SET LOCAL transaction_read_only = on`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| CRUD | `/projects`, `/documents` | Create / list / get / delete |
| POST | `/ingest` | Chunk, embed, insert |
| POST | `/retrieve/structured` | Metadata filter |
| POST | `/retrieve/fulltext` | `tsvector` search |
| POST | `/retrieve/semantic` | pgvector search |
| POST | `/retrieve/hybrid` | RRF merge |
| POST | `/rag` | Hybrid + Claude |
| POST | `/nl-sql` | Generate + execute SELECT |

No authentication.

## Environment

| Variable | Used by |
|---|---|
| `DATABASE_URL` | psycopg (Neon / Supabase / local). Hosted Postgres: add `?sslmode=require`. |
| `ANTHROPIC_API_KEY` | RAG + NL-to-SQL |
| `OPENAI_API_KEY` | Ingestion + semantic/hybrid embeddings |
| `CORS_ORIGINS` | Comma-separated browser origins |
| `VITE_API_BASE_URL` | Frontend (Vite / Vercel) |

Copy `.env.example` → `.env` at the repo root and `frontend/.env.example` → `frontend/.env`.

Enable the `vector` extension on the database (Neon and Supabase both support pgvector).

## Run locally

Postgres must already be running with pgvector. Create an empty database, then:

```bash
# from repo root
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
uvicorn main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:5173. Create a project, paste a document, then use Search to compare retrievers before using Ask or Query.

## Deploy backend to Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, connect the repo (`render.yaml`), or **New Web Service** with:
   - Root directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Set environment variables: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CORS_ORIGINS`.
4. `CORS_ORIGINS` must include the Vercel origin, e.g. `https://recalldb.vercel.app` (no trailing slash). You can list several, comma-separated, including `http://localhost:5173` while testing.
5. Confirm `GET https://<service>.onrender.com/health` returns `{"status":"ok"}`. Schema migration runs on boot.

## Deploy frontend to Vercel

1. **Add New Project** → this repo.
2. Root directory: `frontend`.
3. Framework preset: Vite. Build `npm run build`, output `dist`.
4. Environment variable: `VITE_API_BASE_URL=https://<service>.onrender.com` (no trailing slash).
5. Redeploy after changing `VITE_API_BASE_URL` — Vite inlines it at build time.
6. Copy the Vercel URL into Render’s `CORS_ORIGINS`, then restart the API.

`frontend/vercel.json` rewrites all routes to `index.html`.

## Connecting the two

```
Browser (Vercel)
  VITE_API_BASE_URL ──► Render FastAPI
                          CORS_ORIGINS must allow the Vercel origin
                          DATABASE_URL ──► Neon or Supabase Postgres
```

If the UI loads but every request fails, it is almost always CORS (Render missing the Vercel origin) or a wrong `VITE_API_BASE_URL` baked into an old Vercel build.

## Interview map

| File | What to say |
|---|---|
| `backend/schema.sql` | Tables, GIN, HNSW, tsvector trigger |
| `backend/chunking.py` | Paragraph then sentence pack |
| `backend/embeddings.py` | Why OpenAI for vectors, Claude for text |
| `backend/retrieval.py` | Four functions, RRF math |
| `backend/nl_sql.py` | Generate / validate / execute |
| `backend/ingest.py` | Trigger owns `tsv` |
| `backend/main.py` | HTTP surface, parameterized SQL |
