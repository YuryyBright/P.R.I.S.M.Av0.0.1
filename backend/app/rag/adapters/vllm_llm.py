"""LLM через OpenAI-сумісний /v1/chat/completions (vLLM)."""
from __future__ import annotations

import json
from typing import AsyncIterator

from app.rag.settings import LLMSettings

from ._http import check, make_client, secret


class VLLMProvider:
    def __init__(self, cfg: LLMSettings) -> None:
        if not cfg.api_base:
            raise ValueError("RAG_LLM__API_BASE is required for llm backend 'vllm'")
        self.cfg = cfg
        self._client = make_client(cfg.api_base, secret(cfg.api_key), cfg.timeout_s, retries=cfg.max_retries)

    def _body(self, messages: list[dict[str, str]], stream: bool) -> dict:
        return {"model": self.cfg.model, "messages": messages, "stream": stream,
                "temperature": self.cfg.temperature, "max_tokens": self.cfg.max_output_tokens}

    async def generate(self, messages: list[dict[str, str]]) -> str:
        resp = await self._client.post("chat/completions", json=self._body(messages, False))
        check(resp)
        return resp.json()["choices"][0]["message"]["content"] or ""

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        async with self._client.stream("POST", "chat/completions", json=self._body(messages, True)) as resp:
            if resp.status_code >= 400:
                await resp.aread()
            check(resp)
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    break
                delta = json.loads(payload)["choices"][0].get("delta", {}).get("content")
                if delta:
                    yield delta

    async def aclose(self) -> None:
        await self._client.aclose()