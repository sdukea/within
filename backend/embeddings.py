"""Embedding client.

Claude is used for generation (RAG / NL-to-SQL). It has no embedding endpoint.
Vectors are 1536-d to match OpenAI text-embedding-3-small, which is what
document_chunks.embedding VECTOR(1536) is sized for.
"""

from __future__ import annotations

import httpx

from config import settings

OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
BATCH_SIZE = 64


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return one 1536-d embedding per input string, preserving order."""
    if not texts:
        return []
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is required to generate embeddings. "
            "Anthropic Claude has no embedding API."
        )

    vectors: list[list[float]] = []
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=60.0) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            response = client.post(
                OPENAI_EMBEDDINGS_URL,
                headers=headers,
                json={"model": settings.embedding_model, "input": batch},
            )
            response.raise_for_status()
            data = response.json()["data"]
            data.sort(key=lambda row: row["index"])
            vectors.extend(row["embedding"] for row in data)
    return vectors


def embed_query(text: str) -> list[float]:
    """Embed a single search/RAG query."""
    return embed_texts([text])[0]
