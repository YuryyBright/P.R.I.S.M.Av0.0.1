"""LLMRouter: alias → ModelSpec → адаптер провайдера. Реалізує LLMClient."""
from __future__ import annotations

import dataclasses
from typing import AsyncGenerator, Mapping

from app.ai.domain.ports import LLMClient

from .registry import ModelRegistry
from .types import ChatRequest, LLMEvent, LLMResult


class LLMRouter:
    def __init__(self, registry: ModelRegistry, clients: Mapping[str, LLMClient]) -> None:
        self.registry = registry
        self._clients = clients

    def _resolve(self, req: ChatRequest) -> tuple[LLMClient, ChatRequest]:
        spec = self.registry.get(req.model)
        client = self._clients[spec.provider]
        resolved = dataclasses.replace(
            req,
            model=spec.name,
            temperature=spec.temperature if req.temperature is None else req.temperature,
            max_tokens=min(req.max_tokens or spec.max_output_tokens, spec.max_output_tokens),
        )
        return client, resolved

    async def complete(self, req: ChatRequest) -> LLMResult:
        client, resolved = self._resolve(req)
        return await client.complete(resolved)

    def stream(self, req: ChatRequest) -> AsyncGenerator[LLMEvent, None]:
        client, resolved = self._resolve(req)
        return client.stream(resolved)

    async def aclose(self) -> None:
        for c in self._clients.values():
            close = getattr(c, "aclose", None)
            if close is not None:
                await close()
