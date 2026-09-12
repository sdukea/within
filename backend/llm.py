"""Thin Groq client for text generation (RAG answers, NL-to-SQL).

Groq exposes an OpenAI-compatible /chat/completions endpoint, so this reuses
the `openai` SDK purely as an HTTP client, pointed at Groq's base URL with a
Groq API key. No OpenAI account or billing involved. Free tier, no card:
https://console.groq.com
"""

from __future__ import annotations

from openai import OpenAI

from config import settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def complete(system: str, user: str, max_tokens: int = 1024) -> str:
    """Run a single chat turn and return the response text."""
    client = OpenAI(api_key=settings.groq_api_key, base_url=GROQ_BASE_URL)
    response = client.chat.completions.create(
        model=settings.groq_model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (response.choices[0].message.content or "").strip()
