"""Document ingestion: chunk → embed → insert. Trigger fills tsv."""

from __future__ import annotations

from chunking import chunk_text
from db import get_conn
from embeddings import embed_texts


def ingest_document(
    project_id: int, title: str, text: str, source: str | None = None
) -> dict:
    """Create a document and persist its chunks with embeddings.

    tsv is not set here — the BEFORE INSERT trigger derives it from content.
    """
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("Text produced no chunks")

    embeddings = embed_texts(chunks)

    with get_conn() as conn:
        project = conn.execute(
            "SELECT id FROM projects WHERE id = %s", (project_id,)
        ).fetchone()
        if project is None:
            raise LookupError(f"Project {project_id} not found")

        document = conn.execute(
            """
            INSERT INTO documents (project_id, title, source)
            VALUES (%s, %s, %s)
            RETURNING id, project_id, title, source, created_at
            """,
            (project_id, title, source),
        ).fetchone()

        for index, (content, vector) in enumerate(zip(chunks, embeddings)):
            conn.execute(
                """
                INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
                VALUES (%s, %s, %s, %s)
                """,
                (document["id"], index, content, vector),
            )
        conn.commit()

    return {
        "document": {**document, "chunk_count": len(chunks)},
        "chunk_count": len(chunks),
    }
