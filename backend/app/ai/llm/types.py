"""Типи LLM-порту (provider-agnostic, OpenAI-подібна семантика)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Literal, Union


@dataclass(frozen=True, slots=True)
class TextPart:
    text: str


@dataclass(frozen=True, slots=True)
class ImagePart:
    url: str                      # https://… або data:image/…;base64,…


ContentPart = Union[TextPart, ImagePart]


@dataclass(frozen=True, slots=True)
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]    # JSON Schema


@dataclass(frozen=True, slots=True)
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    raw: str = ""                 # оригінальний рядок аргументів (для повернення моделі як є)
    parse_error: bool = False


def make_tool_call(call_id: str | None, name: str, raw_args: str, *, fallback_id: str) -> ToolCall:
    raw = raw_args or ""
    try:
        parsed = json.loads(raw) if raw.strip() else {}
        if not isinstance(parsed, dict):
            raise ValueError("arguments must be an object")
        return ToolCall(call_id or fallback_id, name, parsed, raw)
    except (ValueError, TypeError):
        return ToolCall(call_id or fallback_id, name, {}, raw, parse_error=True)


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: Union[str, list[ContentPart]] = ""
    tool_calls: tuple[ToolCall, ...] | None = None
    tool_call_id: str | None = None

    def to_openai(self) -> dict[str, Any]:
        msg: dict[str, Any] = {"role": self.role}
        if isinstance(self.content, str):
            msg["content"] = self.content
        else:
            parts: list[dict[str, Any]] = []
            for p in self.content:
                if isinstance(p, TextPart):
                    parts.append({"type": "text", "text": p.text})
                else:
                    parts.append({"type": "image_url", "image_url": {"url": p.url}})
            msg["content"] = parts
        if self.tool_calls:
            if msg["content"] == "":
                msg["content"] = None
            msg["tool_calls"] = [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.name,
                              "arguments": tc.raw if tc.raw and not tc.parse_error
                              else json.dumps(tc.arguments, ensure_ascii=False)}}
                for tc in self.tool_calls
            ]
        if self.tool_call_id is not None:
            msg["tool_call_id"] = self.tool_call_id
        return msg

    @property
    def text(self) -> str:
        if isinstance(self.content, str):
            return self.content
        return "".join(p.text for p in self.content if isinstance(p, TextPart))


@dataclass(slots=True)
class ChatRequest:
    messages: list[ChatMessage]
    model: str | None = None                  # alias (router підставляє справжню назву)
    tools: list[ToolSpec] | None = None
    tool_choice: Literal["auto", "none"] = "auto"
    temperature: float | None = None
    max_tokens: int | None = None


# ---- події стріму ------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class TextDelta:
    text: str


@dataclass(frozen=True, slots=True)
class ToolCallReady:
    call: ToolCall


@dataclass(frozen=True, slots=True)
class LLMUsage:
    prompt_tokens: int
    completion_tokens: int


@dataclass(frozen=True, slots=True)
class Finished:
    reason: str                               # stop | length | tool_calls | …


LLMEvent = Union[TextDelta, ToolCallReady, LLMUsage, Finished]


@dataclass(slots=True)
class LLMResult:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    usage: LLMUsage | None = None
    finish_reason: str = "stop"
