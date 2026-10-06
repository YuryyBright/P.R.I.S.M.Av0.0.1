"""Small adapter boundary for a real search provider.

The provider is intentionally injected. This module does not give the agent a
raw HTTP client, preventing SSRF and arbitrary outbound requests by default.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from .ports import WebSource


class FunctionWebSearch:
    def __init__(self, fn: Callable[[str, int], Awaitable[list[WebSource]]]) -> None:
        self._fn = fn

    async def search(self, query: str, *, limit: int = 5) -> list[WebSource]:
        query = query.strip()
        if not query:
            return []
        return await self._fn(query, max(1, min(limit, 10)))
