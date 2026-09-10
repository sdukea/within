"""Split ingested text into retrieval-sized chunks.

Strategy:
1. Split on blank lines (paragraphs).
2. If a paragraph exceeds ~400 words, fall back to sentence splitting
   and pack sentences until the word budget is hit.
"""

from __future__ import annotations

import re

MAX_WORDS = 400
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def word_count(text: str) -> int:
    return len(text.split())


def split_sentences(text: str) -> list[str]:
    parts = SENTENCE_SPLIT.split(text.strip())
    return [p.strip() for p in parts if p.strip()]


def split_words(text: str, max_words: int = MAX_WORDS) -> list[str]:
    """Last resort when a sentence itself exceeds the budget (no punctuation)."""
    words = text.split()
    return [
        " ".join(words[i : i + max_words])
        for i in range(0, len(words), max_words)
    ]


def pack_sentences(sentences: list[str], max_words: int = MAX_WORDS) -> list[str]:
    """Greedy-pack sentences into chunks that stay under the word budget."""
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0
    for sentence in sentences:
        n = word_count(sentence)
        if n > max_words:
            if current:
                chunks.append(" ".join(current))
                current, current_words = [], 0
            chunks.extend(split_words(sentence, max_words))
            continue
        if current and current_words + n > max_words:
            chunks.append(" ".join(current))
            current = [sentence]
            current_words = n
        else:
            current.append(sentence)
            current_words += n
    if current:
        chunks.append(" ".join(current))
    return chunks


def chunk_text(text: str, max_words: int = MAX_WORDS) -> list[str]:
    """Return ordered chunks for a document body."""
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks: list[str] = []
    for paragraph in paragraphs:
        if word_count(paragraph) <= max_words:
            chunks.append(paragraph)
        else:
            chunks.extend(pack_sentences(split_sentences(paragraph), max_words))
    return chunks
