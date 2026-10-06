"""Базові типи інструментів агента."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, ClassVar

from pydantic import BaseModel

from app.ai.domain.enums import ToolRisk
from app.ai.llm.types import ToolSpec
from app.ai.runtime.context import RunContext
from app.rag.retrieval.types import RetrievalResult, RetrievedChunk


@dataclass
class ToolOutput:
    for_llm: str                                   # обрізається циклом до бюджету
    ui_summary: str                                # для картки в таймлайні
    citations: list[RetrievedChunk] = field(default_factory=list)
    chunk_ids: list[str] = field(default_factory=list)
    # якщо інструмент робив retrieval — loop запише rag_queries і надішле retrieval.done
    retrieval: RetrievalResult | None = None
    query: str | None = None
    numbered: list[tuple[int, RetrievedChunk]] = field(default_factory=list)
    artifacts: list[dict[str, Any]] = field(default_factory=list)


class BaseTool:
    name: ClassVar[str]
    description: ClassVar[str]
    args_model: ClassVar[type[BaseModel]]
    risk: ClassVar[ToolRisk] = ToolRisk.READ
    requires_rag: ClassVar[bool] = False           # вимикається, коли RAG вимкнено в run-і

    async def run(self, ctx: RunContext, args: Any) -> ToolOutput:  # pragma: no cover
        raise NotImplementedError

    @classmethod
    def spec(cls) -> ToolSpec:
        schema = cls.args_model.model_json_schema()
        schema.pop("title", None)
        return ToolSpec(cls.name, cls.description, schema)
