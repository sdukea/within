"""Embedding client.

Embeddings run via Hugging Face's hosted inference API (still
all-MiniLM-L6-v2, still 384-d) instead of loading sentence-transformers/
torch in-process. Only *where* the forward pass runs changed — the vector
space, dimensionality, and every caller's interface are identical, so
existing stored vectors stay comparable to new ones.

This trades a network hop per batch for a much smaller memory footprint:
loading torch locally OOM-kills a 512MB host (confirmed on Render's free
tier), and that ceiling can't be configured around. Requires HF_TOKEN (a
free Hugging Face access token — no card). Groq is used only for
generation (RAG answers, NL-to-SQL) in llm.py; it has no bearing here.
"""

from __future__ import annotations

import time

import httpx

from config import settings

EMBEDDING_DIM = 384

_HF_MODEL = (
    settings.embedding_model
    if "/" in settings.embedding_model
    else f"sentence-transformers/{settings.embedding_model}"
)
_HF_URL = f"https://router.huggingface.co/hf-inference/models/{_HF_MODEL}/pipeline/feature-extraction"


def _post_with_retry(payload: dict, attempts: int = 3) -> list:
    headers = {"Authorization": f"Bearer {settings.hf_token}"}
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            resp = httpx.post(_HF_URL, headers=headers, json=payload, timeout=30)
            if resp.status_code == 503:
                # Serverless model is cold-starting on HF's side; back off and retry.
                wait = 5
                try:
                    wait = min(float(resp.json().get("estimated_time", 5)), 10)
                except (ValueError, TypeError):
                    pass
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"Embedding request failed: {last_error}")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return one 384-d embedding per input string, preserving order."""
    if not texts:
        return []
    return _post_with_retry({"inputs": texts})


def embed_query(text: str) -> list[float]:
    """Embed a single search/RAG query."""
    return embed_texts([text])[0]
