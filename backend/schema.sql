-- Within schema. Idempotent: applied on every API startup.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ownership was added after the first projects existed. Nullable on purpose:
-- rows created before auth existed stay visible to every signed-in user
-- (there's no one to assign them to), but every row a user creates from now
-- on is scoped to them via app code and enforced in the database via RLS
-- below.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id INT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(384),
    tsv TSVECTOR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

-- One-time migration: older installs embedded with OpenAI text-embedding-3-small
-- (1536-d). Embeddings now come from a local sentence-transformers model
-- (384-d), so any legacy vectors are the wrong dimension and wrong space —
-- they must be regenerated, not cast. Drop the dependent index and the column
-- data, then let the CREATE INDEX below rebuild against the new dimension.
-- No-op once the column is already VECTOR(384).
DO $$
DECLARE
    dim int;
BEGIN
    SELECT a.atttypmod INTO dim
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'document_chunks'
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF dim IS NOT NULL AND dim <> 384 THEN
        EXECUTE 'DROP INDEX IF EXISTS document_chunks_embedding_hnsw';
        EXECUTE 'ALTER TABLE document_chunks ALTER COLUMN embedding TYPE VECTOR(384) USING NULL';
    END IF;
END $$;

-- Full-text: GIN over the generated tsvector.
CREATE INDEX IF NOT EXISTS document_chunks_tsv_gin
    ON document_chunks USING GIN (tsv);

-- Semantic: HNSW cosine index (better than IVFFlat on small/medium corpora).
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw
    ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS documents_project_id_idx
    ON documents (project_id);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx
    ON document_chunks (document_id);

-- One row per Ask / Search / Query call, so a project's history survives a
-- refresh instead of living only in React state. `request`/`response` are
-- JSONB because the three panels have genuinely different shapes (a
-- question + citations; a query + ranked hits; a question + SQL + a result
-- table) — one table, not three, since they're the same kind of thing:
-- something the user asked and what came back.
CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('ask', 'search', 'query')),
    request JSONB NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interactions_lookup_idx
    ON interactions (user_id, project_id, kind, created_at DESC);

-- Row-level security: a last line of defense specifically for NL-to-SQL.
-- Every other route filters by ownership in application code (see main.py),
-- but NL-to-SQL executes SQL the model wrote — a WHERE clause it forgot or
-- got wrong shouldn't be able to read another account's rows. Postgres
-- enforces that here regardless of what the generated query looks like.
-- FORCE is required: without it, RLS is skipped for the role that owns
-- these tables, which is exactly the role this API connects as.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_isolation ON projects;
CREATE POLICY projects_isolation ON projects
    USING (owner_id IS NULL OR owner_id = current_setting('app.user_id', true)::int);

DROP POLICY IF EXISTS documents_isolation ON documents;
CREATE POLICY documents_isolation ON documents
    USING (EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = documents.project_id
          AND (p.owner_id IS NULL OR p.owner_id = current_setting('app.user_id', true)::int)
    ));

DROP POLICY IF EXISTS document_chunks_isolation ON document_chunks;
CREATE POLICY document_chunks_isolation ON document_chunks
    USING (EXISTS (
        SELECT 1 FROM documents d
        JOIN projects p ON p.id = d.project_id
        WHERE d.id = document_chunks.document_id
          AND (p.owner_id IS NULL OR p.owner_id = current_setting('app.user_id', true)::int)
    ));

-- Keep tsv in sync with content on every insert/update.
CREATE OR REPLACE FUNCTION document_chunks_tsv_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.tsv := to_tsvector('english', coalesce(NEW.content, ''));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_chunks_tsv_update ON document_chunks;
CREATE TRIGGER document_chunks_tsv_update
    BEFORE INSERT OR UPDATE OF content ON document_chunks
    FOR EACH ROW
    EXECUTE PROCEDURE document_chunks_tsv_update();
