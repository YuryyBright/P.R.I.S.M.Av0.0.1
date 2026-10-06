from __future__ import annotations
from typing import Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.ai.agent.tools.base import BaseTool, ToolOutput
from app.ai.analysis.contracts import DocumentRef
from app.ai.runtime.context import RunContext

class ListDocumentsArgs(BaseModel):
    collection_id: UUID | None = None
    limit: int = Field(default=100, ge=1, le=5000)

class ListDocuments(BaseTool):
    name = "list_documents"
    description = "Enumerate documents the user can access. Use this before exhaustive/bulk analysis."
    args_model = ListDocumentsArgs
    requires_rag = True
    def __init__(self, catalog: Any) -> None: self._catalog = catalog
    async def run(self, ctx: RunContext, args: ListDocumentsArgs) -> ToolOutput:
        requested = [args.collection_id] if args.collection_id else ctx.config.collection_ids
        docs: list[DocumentRef] = await self._catalog.list_documents(ctx.user, collection_ids=requested, document_ids=None, limit=args.limit)
        if not docs: return ToolOutput("No accessible documents found.", "0 документів")
        return ToolOutput("\n".join(f"{d.id}\t{d.title}\tcollection={d.collection_id}" for d in docs), f"{len(docs)} документів доступно")
