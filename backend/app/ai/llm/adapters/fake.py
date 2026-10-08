"""Скриптований LLM для тестів: кожен виклик stream()/complete() бере наступний сценарій."""
from __future__ import annotations

from typing import AsyncGenerator, Sequence

from app.ai.llm.types import (
    ChatRequest, Finished, LLMEvent, LLMResult, LLMUsage, TextDelta, ToolCall, ToolCallReady,
)


def text_turn(text: str, *, chunk: int = 5, usage: tuple[int, int] = (10, 5)) -> list[LLMEvent]:
    evs: list[LLMEvent] = [TextDelta(text[i:i + chunk]) for i in range(0, len(text), chunk)]
    evs += [LLMUsage(*usage), Finished("stop")]
    return evs


def tool_turn(*calls: ToolCall, text: str = "", usage: tuple[int, int] = (10, 5)) -> list[LLMEvent]:
    evs: list[LLMEvent] = [TextDelta(text)] if text else []
    evs += [ToolCallReady(c) for c in calls]
    evs += [LLMUsage(*usage), Finished("tool_calls")]
    return evs


class FakeLLM:
    def __init__(self, script: Sequence[Sequence[LLMEvent]]) -> None:
        self._script = [list(s) for s in script]
        self.calls: list[ChatRequest] = []

    def _next(self, req: ChatRequest) -> list[LLMEvent]:
        self.calls.append(req)
        if not self._script:
            raise AssertionError("FakeLLM: script exhausted")
        return self._script.pop(0)

    async def stream(self, req: ChatRequest) -> AsyncGenerator[LLMEvent, None]:
        for ev in self._next(req):
            yield ev

    async def complete(self, req: ChatRequest) -> LLMResult:
        res = LLMResult()
        for ev in self._next(req):
            if isinstance(ev, TextDelta):
                res.text += ev.text
            elif isinstance(ev, ToolCallReady):
                res.tool_calls.append(ev.call)
            elif isinstance(ev, LLMUsage):
                res.usage = ev
            elif isinstance(ev, Finished):
                res.finish_reason = ev.reason
        return res

    async def aclose(self) -> None:
        return None
