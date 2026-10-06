from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.ai.prompts.protocol import format_sources
from app.ai.runtime.context import RunContext
from app.rag.retrieval.types import RetrievalRequest

from .base import BaseTool, ToolOutput


class SearchKnowledgeArgs(BaseModel):
    query: str = Field(min_length=2, max_length=500, description="Пошуковий запит природною мовою")
    collection_ids: list[uuid.UUID] | None = Field(
        default=None, description="Обмежити пошук цими колекціями (за замовчуванням — усі дозволені)")
    top_k: int = Field(default=5, ge=1, le=10, description="Скільки фрагментів повернути")


def effective_collections(ctx: RunContext, requested: list[uuid.UUID] | None) -> list[uuid.UUID] | None:
    """Колекції run-а ∩ запитані моделлю. None = «усі, доступні за ACL»."""
    allowed = ctx.config.collection_ids
    if requested is None:
        return allowed
    if allowed is None:
        return list(requested)
    allowed_set = set(allowed)
    return [c for c in requested if c in allowed_set]


class SearchKnowledge(BaseTool):
    name = "search_knowledge"
    description = ("Семантичний пошук у базі знань користувача. Повертає пронумеровані джерела; "
                   "посилайся на них як [n]. Викликай з різними формулюваннями, якщо результат слабкий.")
    args_model = SearchKnowledgeArgs
    requires_rag = True

    def __init__(self, retrieval: Any) -> None:
        self._retrieval = retrieval

    async def run(self, ctx: RunContext, args: SearchKnowledgeArgs) -> ToolOutput:
        # ACL перевіряється на КОЖЕН виклик: агент працює хвилини, права могли змінитися.
        result = await self._retrieval.retrieve(ctx.user, RetrievalRequest(
            query=args.query, collection_ids=effective_collections(ctx, args.collection_ids),
            rerank=ctx.config.rerank.enabled, top_k=args.top_k))
        numbered = ctx.citations.register_all(result.chunks)
        if not numbered:
            return ToolOutput("No relevant sources found. Try a different wording.",
                              "нічого не знайдено", retrieval=result, query=args.query)
        return ToolOutput(
            for_llm=f"Found {len(numbered)} sources.\n{format_sources(numbered)}",
            ui_summary=f"{len(numbered)} фрагм.: " + ", ".join(
                dict.fromkeys(c.document_title for _, c in numbered))[:160],
            citations=[c for _, c in numbered], chunk_ids=[str(c.chunk_id) for _, c in numbered],
            retrieval=result, query=args.query, numbered=numbered)
