from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.ai.runtime.context import RunContext

from .base import BaseTool, ToolOutput


class ListCollectionsArgs(BaseModel):
    pass


class ListCollections(BaseTool):
    name = "list_collections"
    description = "Список колекцій бази знань, у яких агент може шукати (id, назва, опис)."
    args_model = ListCollectionsArgs
    requires_rag = True

    def __init__(self, retrieval: Any) -> None:
        self._retrieval = retrieval

    async def run(self, ctx: RunContext, args: ListCollectionsArgs) -> ToolOutput:
        briefs = await self._retrieval.list_collections(ctx.user)
        allowed = ctx.config.collection_ids
        if allowed is not None:
            briefs = [b for b in briefs if b.id in set(allowed)]
        if not briefs:
            return ToolOutput("No collections available.", "колекцій немає")
        lines = [f"- {b.id}: {b.name}" + (f" — {b.description}" if b.description else "") for b in briefs]
        return ToolOutput("\n".join(lines), f"{len(briefs)} колекц.")
