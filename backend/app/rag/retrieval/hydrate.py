"""chunk_id → Postgres: текст, title, page, heading_path.

Тут же відкидаємо чанки видалених / не-READY документів (вектори чистить Celery пізніше)
і чанки колекцій поза scope (друга лінія захисту поверх фільтра Qdrant)."""
from __future__ import annotations

import uuid
from typing import Any, Iterable, cast

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.document_chunk import DocumentChunk
from app.rag.domain.enums import DocumentStatus

from .types import RetrievedChunk

_document = cast(Any, Document)
_chunk = cast(Any, DocumentChunk)


def _heading(meta: dict[str, Any] | None, payload: dict[str, Any] | None) -> list[str]:
    hp = (meta or {}).get("heading_path") or (payload or {}).get("heading_path") or []
    return [str(h) for h in hp] if isinstance(hp, (list, tuple)) else [str(hp)]


async def hydrate_chunks(
    db: AsyncSession,
    chunk_ids: Iterable[uuid.UUID],
    *,
    allowed_collections: set[uuid.UUID],
    payloads: dict[uuid.UUID, dict[str, Any]] | None = None,
) -> dict[uuid.UUID, RetrievedChunk]:
    ids = list(chunk_ids)
    if not ids:
        return {}
    rows = (await db.exec(
        select(DocumentChunk, _document.title, _document.collection_id, _document.url)
        .join(Document, _document.id == _chunk.document_id)
        .where(
            _chunk.id.in_(ids),
            _document.deleted_at.is_(None),
            _document.status == DocumentStatus.READY,
        )
    )).all()
    out: dict[uuid.UUID, RetrievedChunk] = {}
    for chunk, title, collection_id, url in rows:
        if collection_id not in allowed_collections:
            continue
        out[chunk.id] = RetrievedChunk(
            chunk_id=chunk.id, document_id=chunk.document_id, collection_id=collection_id,
            document_title=title, text=chunk.content, page=chunk.page_number,
            heading_path=_heading(chunk.meta, (payloads or {}).get(chunk.id)),
            score=0.0, token_count=chunk.token_count, document_url=url,
            chunk_index=chunk.chunk_index,
        )
    return out
