"""Inspectable retrieval strategies. Keep these as separate functions on purpose.

SQL/structured: metadata filters (project, title, date). No ranking model.
Full-text: Postgres tsvector / ts_rank_cd — lexical match, exact terms, BM25-like.
Semantic: pgvector cosine — meaning match, even when words differ.
Hybrid: Reciprocal Rank Fusion of full-text + semantic so neither channel dominates.
"""

from __future__ import annotations

from datetime import datetime

from embeddings import embed_query
from db import get_conn

RRF_K = 60

# Shared FROM/JOIN so every strategy returns the same hit shape.
_FROM = """
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    JOIN projects p ON p.id = d.project_id
"""

_SELECT = """
    SELECT
        c.id AS chunk_id,
        c.document_id,
        d.title AS document_title,
        d.project_id,
        c.chunk_index,
        c.content,
        c.created_at
"""

_FILTERS = """
    AND (%(project_id)s::int IS NULL OR d.project_id = %(project_id)s)
    AND (%(title)s::text IS NULL OR d.title ILIKE '%%' || %(title)s || '%%')
    AND (%(created_from)s::timestamptz IS NULL OR d.created_at >= %(created_from)s)
    AND (%(created_to)s::timestamptz IS NULL OR d.created_at <= %(created_to)s)
"""


def _params(
    project_id: int | None,
    title: str | None,
    created_from: datetime | None,
    created_to: datetime | None,
    **extra,
) -> dict:
    return {
        "project_id": project_id,
        "title": title,
        "created_from": created_from,
        "created_to": created_to,
        **extra,
    }


def _rows_to_hits(rows: list[dict], score_key: str = "score") -> list[dict]:
    hits = []
    for i, row in enumerate(rows, start=1):
        hits.append(
            {
                "chunk_id": row["chunk_id"],
                "document_id": row["document_id"],
                "document_title": row["document_title"],
                "project_id": row["project_id"],
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "score": float(row.get(score_key) or 0.0),
                "created_at": row["created_at"],
                "rank": i,
                "fulltext_rank": row.get("fulltext_rank"),
                "semantic_rank": row.get("semantic_rank"),
            }
        )
    return hits


def structured_retrieve(
    project_id: int | None = None,
    title: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 20,
) -> list[dict]:
    """Filter chunks by project, document title substring, and created_at range.

    Score is unused (0). Ordering is recency then chunk_index — this is a
    structured scan, not a relevance ranking.
    """
    sql = f"""
        {_SELECT},
        0.0 AS score
        {_FROM}
        WHERE 1=1
        {_FILTERS}
        ORDER BY d.created_at DESC, c.chunk_index ASC
        LIMIT %(limit)s
    """
    with get_conn() as conn:
        rows = conn.execute(
            sql,
            _params(project_id, title, created_from, created_to, limit=limit),
        ).fetchall()
    return _rows_to_hits(rows)


def fulltext_retrieve(
    query: str,
    project_id: int | None = None,
    title: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 10,
) -> list[dict]:
    """Lexical search: plainto_tsquery against the GIN-indexed tsv column.

    ts_rank_cd rewards covering matches and clustered term hits. This wins
    when the user uses the same words that appear in the document.
    """
    sql = f"""
        {_SELECT},
        ts_rank_cd(c.tsv, q.query) AS score
        {_FROM},
        plainto_tsquery('english', %(query)s) AS q(query)
        WHERE c.tsv @@ q.query
        {_FILTERS}
        ORDER BY score DESC, c.id ASC
        LIMIT %(limit)s
    """
    with get_conn() as conn:
        rows = conn.execute(
            sql,
            _params(
                project_id, title, created_from, created_to, query=query, limit=limit
            ),
        ).fetchall()
    return _rows_to_hits(rows)


def semantic_retrieve(
    query: str,
    project_id: int | None = None,
    title: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 10,
) -> list[dict]:
    """Vector search: cosine similarity via pgvector's <=> distance.

    Score is 1 - cosine_distance, so 1.0 is identical and 0.0 is orthogonal.
    This wins when the question paraphrases the document.
    """
    vector = embed_query(query)
    sql = f"""
        {_SELECT},
        (1 - (c.embedding <=> %(embedding)s::vector)) AS score
        {_FROM}
        WHERE c.embedding IS NOT NULL
        {_FILTERS}
        ORDER BY c.embedding <=> %(embedding)s::vector
        LIMIT %(limit)s
    """
    with get_conn() as conn:
        rows = conn.execute(
            sql,
            _params(
                project_id,
                title,
                created_from,
                created_to,
                embedding=vector,
                limit=limit,
            ),
        ).fetchall()
    return _rows_to_hits(rows)


def hybrid_retrieve(
    query: str,
    project_id: int | None = None,
    title: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 10,
) -> list[dict]:
    """Reciprocal Rank Fusion of full-text and semantic lists.

    RRF score(d) = Σ 1 / (k + rank_i(d)), k=60.
    Using ranks instead of raw scores avoids mixing ts_rank and cosine,
    which live on incompatible scales. Default retrieval for RAG.
    """
    # Over-fetch so fusion has room to reorder before we cut to `limit`.
    pool_size = max(limit * 4, 20)
    lexical = fulltext_retrieve(
        query, project_id, title, created_from, created_to, pool_size
    )
    vector = semantic_retrieve(
        query, project_id, title, created_from, created_to, pool_size
    )

    fused: dict[int, dict] = {}
    for rank, hit in enumerate(lexical, start=1):
        item = fused.setdefault(hit["chunk_id"], {**hit, "score": 0.0})
        item["fulltext_rank"] = rank
        item["score"] += 1.0 / (RRF_K + rank)
        item["content"] = hit["content"]
        item["document_title"] = hit["document_title"]
    for rank, hit in enumerate(vector, start=1):
        item = fused.setdefault(hit["chunk_id"], {**hit, "score": 0.0})
        item["semantic_rank"] = rank
        item["score"] += 1.0 / (RRF_K + rank)
        item["content"] = hit["content"]
        item["document_title"] = hit["document_title"]

    ranked = sorted(fused.values(), key=lambda h: h["score"], reverse=True)[:limit]
    for i, hit in enumerate(ranked, start=1):
        hit["rank"] = i
    return ranked
