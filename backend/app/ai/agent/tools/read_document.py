from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.ai.prompts.protocol import format_sources
from app.ai.runtime.context import RunContext

from .base import BaseTool, ToolOutput


class ReadDocumentArgs(BaseModel):
    document_id: uuid.UUID = Field(description="ID документа з результатів пошуку")
    start_chunk: int = Field(default=0, ge=0, description="З якого фрагмента починати")
    count: int = Field(default=5, ge=1, le=10, description="Скільки послідовних фрагментів прочитати")


class ReadDocument(BaseTool):
    name = "read_document"
    description = ("Читає послідовні фрагменти конкретного документа (щоб побачити контекст "
                   "навколо знайденого місця). Повертає пронумеровані джерела.")
    args_model = ReadDocumentArgs
    requires_rag = True

    def __init__(self, retrieval: Any) -> None:
        self._retrieval = retrieval

    async def run(self, ctx: RunContext, args: ReadDocumentArgs) -> ToolOutput:
        chunks = await self._retrieval.read_chunks(
            ctx.user, args.document_id, start=args.start_chunk, count=args.count)
        # колекція документа має входити в дозволені для run-а
        allowed = ctx.config.collection_ids
        if allowed is not None:
            chunks = [c for c in chunks if c.collection_id in set(allowed)]
        if not chunks:
            return ToolOutput("No chunks in this range (end of document or no access).", "порожній діапазон")
        numbered = ctx.citations.register_all(chunks)
        last = max(c.chunk_index for c in chunks)
        hint = f"\nMore chunks may follow: call again with start_chunk={last + 1}."
        return ToolOutput(
            for_llm=f"Document «{chunks[0].document_title}», chunks {chunks[0].chunk_index}-{last}.\n"
                    f"{format_sources(numbered)}{hint}",
            ui_summary=f"«{chunks[0].document_title}», фрагм. {chunks[0].chunk_index}–{last}",
            citations=chunks, chunk_ids=[str(c.chunk_id) for c in chunks], numbered=numbered)
