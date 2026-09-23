# Within

An AI-native **knowledge database**. The product is – PostgreSQL  tables, indexes, `tsvector`, and `pgvector`. The LLM is a capability layered on top of those retrieval primitives, not the other way around.

This is not a chatbot with a document uploader. You can inspect three retrieval strategies independently, read the SQL they run, fuse them with reciprocal rank fusion, then optionally ask a model to answer — with citations — or to write a `SELECT` against the schema itself.

**Ask anything about your knowledge.** Not "here's an AI dashboard with seventeen panels."

## Architecture

```
React studio  →  FastAPI  →  PostgreSQL + pgvector
                     │
                     ├─ ingest: extract text (paste / PDF / .txt / .md)
                     │          → chunk → embed (local MiniLM, 384-d) → INSERT
                     ├─ structured / full-text / semantic / hybrid retrieve
                     ├─ RAG: hybrid retrieve → Groq → cited answer
                     └─ NL-to-SQL: Groq → validate SELECT → execute
```

- **Backend:** Python, FastAPI, **raw SQL via psycopg3** — no ORM.
- **Database:** Postgres with `vector`. Schema lives in `backend/schema.sql` and is applied idempotently on every API startup.
- **Frontend:** React + TypeScript + Tailwind. Ask is the front door; Search and Query are real, fully-functional tools reached through a quiet tab switcher, not equal-weight dashboard panels.
- **Generation:** Groq (`openai/gpt-oss-120b` by default) for RAG answers and NL-to-SQL — free tier, no card required.
- **Embeddings:** local `sentence-transformers` (`all-MiniLM-L6-v2`, 384 dimensions), run in-process on the API server. No API call, no key, no per-token cost. `document_chunks.embedding` is `VECTOR(384)` to match.

### Data model

| Table | Role |
|---|---|
| `projects` | Namespace for documents |
| `documents` | Ingested source (title + optional source label) |
| `document_chunks` | Retrieval unit: `content`, `embedding`, `tsv` |

`tsv` is maintained by a `BEFORE INSERT OR UPDATE` trigger from `content`. Application code never writes `tsv` directly. A GIN index sits on `tsv`; an HNSW (cosine) index sits on `embedding`.

Chunking (`backend/chunking.py`): split on blank lines; if a paragraph exceeds ~400 words, sentence-split and pack.

### Ingestion: multimodal input, one text pipeline

Everything ultimately becomes a string before it reaches `chunk_text`. `backend/extract.py` is the seam: it takes a file's bytes and returns plain text, and nothing downstream (chunking, embedding, retrieval) knows or cares where the text came from.

- **Paste** — `POST /ingest` with raw text, as before.
- **File upload** — `POST /ingest/file` (multipart) accepts `.pdf` (extracted via `pypdf`), `.txt`, and `.md`/`.markdown`. Title defaults to the filename when left blank; `source` is set to the original filename so it's traceable back to its file. 20MB upload limit.

This is deliberately the cheap half of "multimodal": formats that already contain text, or reduce to it. Audio (transcription) and images (OCR/captioning) fit the same seam — an extractor that returns text — without touching `chunking.py`, `embeddings.py`, or `retrieval.py`. True multimodal *embeddings* (e.g. CLIP, so an image is searched as an image, not its caption) are a separate, larger change: a second vector space and a retrieval path that can't reuse `hybrid_retrieve`'s single-embedding RRF as-is.

All queries that take user values use psycopg placeholders (`%s` / `%(name)s`). Nothing concatenates untrusted strings into SQL except the NL-to-SQL path, which only ever runs after a validator accepts a single `SELECT`.

## Three retrieval strategies (and why hybrid)

Implemented as **four separate functions** in `backend/retrieval.py` and four routes. They're kept distinct on purpose — the Search tab exists so you can watch them disagree on the same query.

### 1. Structured (`structured_retrieve`)

SQL filters: `project_id`, title `ILIKE`, `created_at` range. Ordered by recency, not relevance. This is the relational database doing what it already does well: predicates on columns.

### 2. Full-text (`fulltext_retrieve`)

`plainto_tsquery('english', query)` against `document_chunks.tsv`, ranked with `ts_rank_cd`. Lexical. Wins when the query shares terms with the document — names, error codes, identifiers. Fails on paraphrase.

### 3. Semantic (`semantic_retrieve`)

Embed the query, then `ORDER BY embedding <=> :q` (pgvector cosine distance). Score is `1 - distance`. Wins when the question uses different words than the author did. Can miss exact tokens and retrieve "about the same topic" chunks that don't actually answer the question.

### 4. Hybrid (`hybrid_retrieve`) – default for RAG

Reciprocal Rank Fusion of the full-text list and the semantic list:

```
score(d) = Σ  1 / (k + rank_i(d))     with k = 60
```

Ranks are fused, not raw scores. `ts_rank_cd` and cosine similarity aren't on the same scale; averaging them would let one channel dominate. RRF only cares about order, so a chunk that's #1 in either list stays near the top, and a chunk that's decent in **both** lists gets boosted above one that's merely great in one.

`POST /rag` always uses hybrid, then sends those chunks to Groq with instructions to cite `[chunk:<id>]`. The frontend renders those markers as numbered footnotes in the answer — click one and it scrolls to and briefly highlights its source. Chunks that were retrieved but not cited stay visible under "Also retrieved," so the retrieval mechanics are still auditable even when the model doesn't reference every chunk it was given.

## RAG vs NL-to-SQL

| | RAG (`/rag`) | NL-to-SQL (`/nl-sql`) |
|---|---|---|
| Question type | "What does the runbook say about timeouts?" | "How many chunks per document?" |
| Engine | Hybrid retrieval + generation | Groq writes SQL, Postgres executes it |
| Grounding | Chunk text in the prompt | Rows in tables |
| Citations | Chunk footnotes → source excerpts | The generated SQL itself |
| Writes | None | None (validator + `transaction_read_only`) |

Use RAG for meaning. Use NL-to-SQL for aggregates, joins, and inventory over the schema. Mixing both into one "chat" box hides which system actually answered.

NL-to-SQL validation (`backend/nl_sql.py`): one statement, `sqlparse` type `SELECT`, a forbidden-keyword blocklist, only `projects` / `documents` / `document_chunks` (plus CTE names) as referenced tables, a 5s `statement_timeout`, and `SET LOCAL transaction_read_only = on`. The model never gets a chance to write.

## Design

The frontend deliberately doesn't look like a generic SaaS "AI" dashboard. A few decisions worth knowing about if you're reading the code:

- **Ask is the product.** A large, centered question field greets you; asking settles it into a compact bar with the answer below. Search and Query are equally real and equally functional, but reached through a quiet text-tab switcher rather than three equal-weight panels — they're tools, not the front door.
- **Citations are footnotes, not database rows.** The backend's `[chunk:19]` markers are parsed client-side into small numbered superscripts in the answer's serif prose. No raw chunk IDs in front of the reader.
- **One accent color**, used only for the primary action, the active tab, and citation marks. Everything else is off-white, white, and Apple's own near-black/gray text tones.
- **Two typefaces, on purpose.** Inter for UI chrome; Source Serif 4 for the answer text itself, so the knowledge reads like considered writing rather than app copy.
- **Progressive disclosure in the sidebar.** Adding a project or a document is a quiet `+` that reveals an inline form and collapses again — it doesn't permanently occupy a third of the rail.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| CRUD | `/projects`, `/documents` | Create / list / get / delete |
| POST | `/ingest` | Chunk, embed, insert (raw text) |
| POST | `/ingest/file` | Extract text from an uploaded PDF/.txt/.md, then chunk, embed, insert |
| POST | `/retrieve/structured` | Metadata filter |
| POST | `/retrieve/fulltext` | `tsvector` search |
| POST | `/retrieve/semantic` | pgvector search |
| POST | `/retrieve/hybrid` | RRF merge |
| POST | `/rag` | Hybrid retrieve + Groq, with citations |
| POST | `/nl-sql` | Generate + validate + execute a `SELECT` |

No authentication — this is a local/portfolio project, not a multi-tenant product. Add auth before putting real data behind a public URL.

## Environment

| Variable | Used by |
|---|---|
| `DATABASE_URL` | psycopg (Neon / Supabase / local). Hosted Postgres: add `?sslmode=require`. |
| `GROQ_API_KEY` | RAG + NL-to-SQL generation. Free, no card: [console.groq.com](https://console.groq.com) |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `VITE_API_BASE_URL` | Frontend build-time API origin (Vite / Vercel) |

Embeddings need no API key — `all-MiniLM-L6-v2` runs locally via `sentence-transformers`, downloaded from Hugging Face on first use and cached after.

Copy `.env.example` → `.env` at the repo root, and `frontend/.env.example` → `frontend/.env`.

Enable the `vector` extension on your database (Neon and Supabase both support pgvector).

## Run locally

Postgres must already be running with pgvector available. Create an empty database, then:

```bash
# from repo root
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
uvicorn main:app --reload --port 8000
```

First boot downloads the embedding model (~90MB) from Hugging Face; subsequent boots use the local cache.

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
3. Set environment variables: `DATABASE_URL`, `GROQ_API_KEY`, `CORS_ORIGINS`.
4. `CORS_ORIGINS` must include the Vercel origin, e.g. `https://within.vercel.app` (no trailing slash). List several, comma-separated, if you're also testing against `http://localhost:5173`.
5. Confirm `GET https://<service>.onrender.com/health` returns `{"status":"ok"}`. The schema migration runs on boot.

`sentence-transformers` pulls in `torch`, a large, RAM-hungry dependency. Render's free plan (512MB RAM) is likely to OOM loading the model — use at least the Starter plan for the API service in production.

## Deploy frontend to Vercel

1. **Add New Project** → this repo.
2. Root directory: `frontend`.
3. Framework preset: Vite. Build `npm run build`, output `dist`.
4. Environment variable: `VITE_API_BASE_URL=https://<service>.onrender.com` (no trailing slash).
5. Redeploy after changing `VITE_API_BASE_URL` — Vite inlines it at build time.
6. Copy the Vercel URL into Render's `CORS_ORIGINS`, then restart the API.

`frontend/vercel.json` rewrites all routes to `index.html`.

## Connecting the two

```
Browser (Vercel)
  VITE_API_BASE_URL ──► Render FastAPI
                          CORS_ORIGINS must allow the Vercel origin
                          DATABASE_URL ──► Neon or Supabase Postgres
```

If the UI loads but every request fails, it's almost always CORS (Render missing the Vercel origin) or a stale `VITE_API_BASE_URL` baked into an old Vercel build.

## Project layout

```
backend/
  main.py         HTTP surface, parameterized SQL
  db.py           Connection pool + schema migration
  schema.sql       Tables, GIN, HNSW, tsvector trigger
  chunking.py      Paragraph-then-sentence packing
  embeddings.py    Local sentence-transformers model
  llm.py           Groq client (OpenAI-compatible)
  retrieval.py     Four retrieval functions, RRF math
  nl_sql.py        Generate / validate / execute SELECT
  extract.py       File bytes → plain text (PDF, .txt, .md)
  ingest.py        Chunk → embed → insert
frontend/
  src/App.tsx          Shell, tab switcher, data loading
  src/Sidebar.tsx       Projects, documents, paste/upload ingest form
  src/AskPanel.tsx      RAG UI, footnote citations
  src/SearchPanel.tsx   Raw retrieval inspector
  src/QueryPanel.tsx    NL-to-SQL UI
  src/SegmentedControl.tsx  Shared quiet tab component
```
