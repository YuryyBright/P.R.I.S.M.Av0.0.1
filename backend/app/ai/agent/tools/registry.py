"""Реєстр інструментів + фільтр за allowed_tools профілю."""
from __future__ import annotations

from typing import Any

from app.ai.domain.enums import ToolRisk
from app.ai.domain.exceptions import InvalidInputError
from app.ai.llm.types import ToolSpec

from .base import BaseTool
from .list_collections import ListCollections
from .list_documents import ListDocuments
from .analyze_documents import AnalyzeDocuments
from .web_search import WebSearchTool
from .read_document import ReadDocument
from .search_knowledge import SearchKnowledge
from .task_tools import CreateTaskTool, GetTaskStatusTool, CancelTaskTool


class ToolRegistry:
    def __init__(self, *, allow_write: bool = False) -> None:
        self._tools: dict[str, BaseTool] = {}
        self._allow_write = allow_write

    def register(self, tool: BaseTool) -> None:
        if tool.risk == ToolRisk.WRITE and not self._allow_write:
            raise ValueError(f"write tool {tool.name!r} is disabled (AI_AGENT__ALLOW_WRITE_TOOLS)")
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return list(self._tools)

    def describe(self) -> list[dict[str, Any]]:
        return [{"name": t.name, "description": t.description, "risk": t.risk.value,
                 "requires_rag": t.requires_rag} for t in self._tools.values()]

    def resolve_allowed(self, requested: list[str] | None, *, rag_enabled: bool) -> list[str]:
        """Перетин запитаного (профіль) з наявним. None = усі дозволені. Невідоме → помилка.
        Інструменти, що потребують RAG, відкидаються, коли RAG вимкнено."""
        names = self.names() if requested is None else list(requested)
        unknown = [n for n in names if n not in self._tools]
        if unknown:
            raise InvalidInputError(f"Unknown tools: {', '.join(unknown)}")
        return [n for n in names if rag_enabled or not self._tools[n].requires_rag]

    def specs(self, allowed: list[str]) -> list[ToolSpec]:
        return [self._tools[n].spec() for n in allowed if n in self._tools]


def default_registry(
    retrieval: Any,
    *,
    allow_write: bool = False,
    catalog: Any = None,
    analyzer: Any = None,
    report_store: Any = None,
    web_search: Any = None,
    task_service_factory: Any = None,
) -> ToolRegistry:
    reg = ToolRegistry(allow_write=allow_write)

    reg.register(SearchKnowledge(retrieval))
    reg.register(ReadDocument(retrieval))
    reg.register(ListCollections(retrieval))

    if catalog is not None:
        reg.register(ListDocuments(catalog))

    if analyzer is not None:
        reg.register(AnalyzeDocuments(analyzer, report_store=report_store))

    if web_search is not None:
        reg.register(WebSearchTool(web_search))

    if task_service_factory is not None:
        if allow_write:
            reg.register(CreateTaskTool(task_service_factory))
            reg.register(CancelTaskTool(task_service_factory))

        reg.register(GetTaskStatusTool(task_service_factory))

    return reg
