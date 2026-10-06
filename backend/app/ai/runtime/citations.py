"""CitationRegistry: стабільні номери [n] для чанків, які бачила модель, на весь run.

На finalize зі справжньої відповіді парсяться [n]; у rag_citations потрапляють лише
валідні (існуючі в реєстрі) посилання.
"""
from __future__ import annotations

import re
import uuid
from typing import Iterable

from app.rag.retrieval.types import RetrievedChunk

# [1], [1][3], [1, 2], [1,2,3]
_BRACKET = re.compile(r"\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]")


def strip_markers(text: str) -> str:
    """Прибрати [n] з тексту (для історії: номери минулих run-ів не мають плутати модель)."""
    return re.sub(r"\s*" + _BRACKET.pattern, "", text)


class CitationRegistry:
    def __init__(self) -> None:
        self._by_chunk: dict[uuid.UUID, int] = {}
        self._by_n: dict[int, RetrievedChunk] = {}

    def register(self, chunk: RetrievedChunk) -> int:
        """Дедуп за chunk_id: повторна поява того ж чанка → той самий номер."""
        n = self._by_chunk.get(chunk.chunk_id)
        if n is None:
            n = len(self._by_chunk) + 1
            self._by_chunk[chunk.chunk_id] = n
            self._by_n[n] = chunk
        return n

    def register_all(self, chunks: Iterable[RetrievedChunk]) -> list[tuple[int, RetrievedChunk]]:
        return [(self.register(c), c) for c in chunks]

    def get(self, n: int) -> RetrievedChunk | None:
        return self._by_n.get(n)

    def number_of(self, chunk_id: uuid.UUID) -> int | None:
        return self._by_chunk.get(chunk_id)

    def parse(self, text: str) -> list[int]:
        """Унікальні валідні номери в порядку першої появи."""
        seen: list[int] = []
        for m in _BRACKET.finditer(text):
            for part in m.group(1).split(","):
                n = int(part.strip())
                if n in self._by_n and n not in seen:
                    seen.append(n)
        return seen

    def referenced(self, text: str) -> list[tuple[int, RetrievedChunk]]:
        return [(n, self._by_n[n]) for n in self.parse(text)]

    def __len__(self) -> int:
        return len(self._by_n)
