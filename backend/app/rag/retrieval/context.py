"""Пакування чанків у бюджет токенів контексту."""
from __future__ import annotations

from typing import Sequence

from .types import RetrievedChunk

_CHARS_PER_TOKEN = 3


def pack_chunks(chunks: Sequence[RetrievedChunk], max_tokens: int) -> list[RetrievedChunk]:
    """Жадібно в порядку релевантності. Мінімум один чанк завжди лишається
    (за потреби текст обрізається), решта — доки вміщується."""
    out: list[RetrievedChunk] = []
    used = 0
    for c in chunks:
        cost = c.token_count or max(1, len(c.text) // _CHARS_PER_TOKEN)
        if used + cost > max_tokens:
            if not out:
                c.text = c.text[: max_tokens * _CHARS_PER_TOKEN]
                c.token_count = max_tokens
                out.append(c)
            break
        out.append(c)
        used += cost
    return out
