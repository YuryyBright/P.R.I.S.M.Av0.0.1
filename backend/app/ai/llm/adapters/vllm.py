"""OpenAI-сумісний /v1/chat/completions (vLLM).

Для tool calling vLLM треба запускати з:
    --enable-auto-tool-choice --tool-call-parser hermes
(для Qwen2.5 зазвичай hermes; перевірте парсер для вашої моделі).

У стрімі `delta.tool_calls` приходять частинами за `index` → склеюємо; usage приходить
в останньому чанку завдяки stream_options.include_usage.
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from app.ai.llm.types import (
    ChatRequest, Finished, LLMEvent, LLMResult, LLMUsage, TextDelta, ToolCallReady, make_tool_call,
)
from app.ai.settings import ProviderSettings
from app.rag.adapters._http import check, make_client, secret


class VLLMClient:
    def __init__(self, cfg: ProviderSettings, *, client: Any | None = None) -> None:
        if not cfg.api_base:
            raise ValueError("api_base is required for provider backend 'vllm'")
        self.cfg = cfg
        self._client = client or make_client(
            cfg.api_base, secret(cfg.api_key), cfg.timeout_s, retries=cfg.max_retries)

    # ---- request ---------------------------------------------------------------

    @staticmethod
    def _body(req: ChatRequest, stream: bool) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": req.model,
            "messages": [m.to_openai() for m in req.messages],
            "stream": stream,
        }
        if req.temperature is not None:
            body["temperature"] = req.temperature
        if req.max_tokens is not None:
            body["max_tokens"] = req.max_tokens
        if req.tools:
            body["tools"] = [
                {"type": "function",
                 "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
                for t in req.tools
            ]
            body["tool_choice"] = req.tool_choice
        if stream:
            body["stream_options"] = {"include_usage": True}
        return body

    # ---- non-stream ------------------------------------------------------------

    async def complete(self, req: ChatRequest) -> LLMResult:
        resp = await self._client.post("chat/completions", json=self._body(req, False))
        check(resp)
        data = resp.json()
        choice = data["choices"][0]
        msg = choice.get("message") or {}
        calls = [
            make_tool_call(tc.get("id"), (tc.get("function") or {}).get("name", ""),
                           (tc.get("function") or {}).get("arguments", ""), fallback_id=f"call_{i}")
            for i, tc in enumerate(msg.get("tool_calls") or [])
        ]
        usage = data.get("usage")
        return LLMResult(
            text=msg.get("content") or "",
            tool_calls=calls,
            usage=LLMUsage(usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)) if usage else None,
            finish_reason=choice.get("finish_reason") or "stop",
        )

    # ---- stream ----------------------------------------------------------------

    async def stream(self, req: ChatRequest) -> AsyncIterator[LLMEvent]:
        acc: dict[int, dict[str, str | None]] = {}
        usage: LLMUsage | None = None
        finish: str | None = None

        async with self._client.stream("POST", "chat/completions", json=self._body(req, True)) as resp:
            if resp.status_code >= 400:
                await resp.aread()
            check(resp)
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    break
                chunk = json.loads(payload)
                if chunk.get("usage"):
                    u = chunk["usage"]
                    usage = LLMUsage(u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                ch = choices[0]
                delta = ch.get("delta") or {}
                if delta.get("content"):
                    yield TextDelta(delta["content"])
                for tc in delta.get("tool_calls") or []:
                    slot = acc.setdefault(tc.get("index", 0), {"id": None, "name": "", "args": ""})
                    if tc.get("id"):
                        slot["id"] = tc["id"]
                    fn = tc.get("function") or {}
                    if fn.get("name") and not slot["name"]:
                        slot["name"] = fn["name"]
                    if fn.get("arguments"):
                        slot["args"] = (slot["args"] or "") + fn["arguments"]
                if ch.get("finish_reason"):
                    finish = ch["finish_reason"]

        for i in sorted(acc):
            s = acc[i]
            yield ToolCallReady(make_tool_call(s["id"], s["name"] or "", s["args"] or "",
                                               fallback_id=f"call_{i}"))
        if usage is not None:
            yield usage
        yield Finished(finish or ("tool_calls" if acc else "stop"))

    async def aclose(self) -> None:
        await self._client.aclose()
