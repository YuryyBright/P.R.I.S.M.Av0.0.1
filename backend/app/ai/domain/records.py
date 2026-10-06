"""Внутрішні (НЕ публічні) записи, які executor віддає раннеру поряд з подіями.

Executor — async-генератор `RunEvent | StepRecord`. Події йдуть у bus, StepRecord —
у БД (ai_run_steps, а для retrieval ще й rag_queries). Так executor нічого не знає
ні про Redis, ні про SQLAlchemy.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Union

from .enums import StepStatus, StepType
from .events import (
    CitationEvent, RetrievalDone, RunFinished, RunStarted, StepFinished, StepStarted,
    TokenDelta, ToolCallEvent, ToolResultEvent, UsageEvent,
)

# Що саме зберігається в кроках (достатньо, щоб відновити хвіст messages для resume у v2):
#   llm_call : input {model, n_messages, tools}, output {content, tool_calls, finish_reason}
#   tool_call: input {tool_call_id, name, args},  output {content, ok, summary, chunk_ids}
#   retrieval: input {query, rewritten_query, collection_ids}, output {chunks:[…]}
# Сирий chain-of-thought НЕ зберігається.


@dataclass(slots=True)
class RetrievalLog:
    query_text: str
    rewritten_query: str | None
    trace: dict[str, Any]       # ключі збігаються з колонками rag_queries (див. RetrievalTrace.to_dict)


@dataclass(slots=True)
class StepRecord:
    idx: int
    type: StepType
    name: str | None = None
    status: StepStatus = StepStatus.OK
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    latency_ms: int = 0
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    retrieval: RetrievalLog | None = None


AnyEvent = Union[
    RunStarted, StepStarted, StepFinished, TokenDelta, RetrievalDone,
    ToolCallEvent, ToolResultEvent, CitationEvent, UsageEvent, RunFinished,
]
ExecutorOutput = Union[AnyEvent, StepRecord]
