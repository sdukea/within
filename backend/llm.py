"""Thin Anthropic Claude client. No LangChain."""

from __future__ import annotations

import anthropic

from config import settings


def complete(system: str, user: str, max_tokens: int = 1024) -> str:
    """Run a single Claude turn and return the concatenated text blocks."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    parts: list[str] = []
    for block in message.content:
        if block.type == "text":
            parts.append(block.text)
    return "".join(parts).strip()
