"""Етап FINALIZE: перевірка повноти індексації → Job.COMPLETED, Document.READY.

Окремий крок, щоб завершення pipeline не змішувалось із логікою vector store.
Ідемпотентний: повторний виклик для COMPLETED job повертає skipped.
"""
import logging
import uuid
from typing import Any

from app.rag.domain.enums import IngestionStageName
from app.rag.ingestion.stage_common import (
    SessionFactory, fail_job_stages, fail_stages, load_context,
)
from app.rag.repositories import DocumentChunkRepository

logger = logging.getLogger(__name__)

FINALIZE = IngestionStageName.FINALIZE


async def run_finalize_stage(session_factory: SessionFactory, job_id: uuid.UUID) -> dict[str, Any]:
    """Повертає {"status": "finalized"|"failed"|"skipped", ...}."""
    async with session_factory() as db:
        ctx = await load_context(db, job_id, FINALIZE)
        if isinstance(ctx, dict):
            return ctx
        job, doc = ctx.job, ctx.doc
        chunks = DocumentChunkRepository(db)

        ctx.jobs.mark_processing(job, FINALIZE)
        await ctx.jobs.begin_stage(job_id, FINALIZE)

        total = await chunks.count(doc.id)
        pending = await chunks.count(doc.id, pending_only=True)
        if total == 0 or pending:
            msg = f"{pending} of {total} chunks are not indexed"
            await fail_stages(db, job, doc, "index_incomplete", msg, FINALIZE)
            return {"status": "failed", "error_code": "index_incomplete",
                    "error_message": msg, "job_id": str(job_id)}

        await ctx.jobs.complete_stage(job_id, FINALIZE, items=total)
        ctx.jobs.mark_completed(job)
        ctx.docs.mark_ready(doc)
        await db.commit()

    return {"status": "finalized", "job_id": str(job_id), "document_id": str(doc.id), "chunks": total}


async def fail_finalize_job(session_factory: SessionFactory, job_id: uuid.UUID,
                            code: str, message: str) -> None:
    await fail_job_stages(session_factory, job_id, code, message, FINALIZE)