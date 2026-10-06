"""Read-only web search port. No arbitrary HTTP tool is exposed to the model."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class WebSource:
    title: str
    url: str
    snippet: str


class WebSearch(Protocol):
    async def search(self, query: str, *, limit: int = 5) -> list[WebSource]: ...
