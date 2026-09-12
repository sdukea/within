-- Within schema. Idempotent: applied on every API startup.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
