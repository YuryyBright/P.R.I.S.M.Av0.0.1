"""Reciprocal Rank Fusion (dense + sparse)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from app.rag.domain.ports import ScoredPoint


@dataclass(slots=True)
class FusedHit:
    id: str
    score: float
    payload: dict[str, Any]


def rrf(lists: Sequence[Sequence[ScoredPoint]], *, k: int = 60) -> list[FusedHit]:
    """Один список → повертається як є (зберігаємо «сирий» cosine-score).
    Кілька списків → RRF: score = Σ 1/(k + rank)."""
    non_empty = [l for l in lists if l]
    if not non_empty:
        return []
    if len(non_empty) == 1:
        return [FusedHit(p.id, p.score, p.payload) for p in non_empty[0]]

    scores: dict[str, float] = {}
    payloads: dict[str, dict[str, Any]] = {}
    for lst in non_empty:
        for rank, p in enumerate(lst, start=1):
            scores[p.id] = scores.get(p.id, 0.0) + 1.0 / (k + rank)
            payloads.setdefault(p.id, p.payload)
    ordered = sorted(scores, key=lambda i: (-scores[i], i))
    return [FusedHit(i, scores[i], payloads[i]) for i in ordered]
