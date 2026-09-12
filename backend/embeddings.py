"""Embedding client.

Embeddings run locally via sentence-transformers (all-MiniLM-L6-v2, 384-d).
No API key, no network call, no per-token cost. Groq is used only for
generation (RAG answers, NL-to-SQL) in llm.py — it has no bearing on
embeddings. document_chunks.embedding is VECTOR(384) to match this model.

The model is loaded once per process (first call pays the load cost; the
process is expected to stay warm behind uvicorn) and reused for every
embed_texts/embed_query call.
"""

from __future__ import annotations

from functools import lru_cache

from config import settings

EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _model():
    # Imported lazily so the (heavy) torch/transformers stack only loads
    # once a model is actually requested, not at module import time.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return one 384-d embedding per input string, preserving order."""
    if not texts:
        return []
    vectors = _model().encode(
        texts, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=False
    )
    return [vector.tolist() for vector in vectors]


def embed_query(text: str) -> list[float]:
    """Embed a single search/RAG query."""
    return embed_texts([text])[0]
