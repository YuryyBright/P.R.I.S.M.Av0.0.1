"""Доступ до БД для DocumentChunk. Без commit."""
import uuid
from typing import Sequence

from sqlalchemy import Row, delete, update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.rag_base import utcnow

PREVIEW_CHARS = 240


def _like_escape(q: str) -> str:
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class DocumentChunkRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def replace_for_document(self, document_id: uuid.UUID,
                                   chunks: Sequence[DocumentChunk]) -> None:
        """Видалити старі чанки й додати нові. Атомарність — за рахунок
        транзакції caller-а (один commit після виклику)."""
        await self.delete_for_document(document_id)
        self.db.add_all(chunks)

    async def delete_for_document(self, document_id: uuid.UUID) -> None:
        await self.db.exec(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))

    async def list_for_embedding(self, document_id: uuid.UUID) -> list[Row]:
        """(id, chunk_index, content, page_number, meta) у порядку chunk_index."""
        rows = await self.db.exec(
            select(DocumentChunk.id, DocumentChunk.chunk_index, DocumentChunk.content,
                   DocumentChunk.page_number, DocumentChunk.meta)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index))
        return list(rows.all())

    async def mark_indexed(self, chunk_ids: Sequence[uuid.UUID], model: str, version: str) -> None:
        await self.db.exec(update(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)).values(
            embedding_model=model, embedding_version=version, indexed_at=utcnow()))

    async def count(self, document_id: uuid.UUID, *, pending_only: bool = False) -> int:
        """Кількість чанків документа; pending_only — лише ще не проіндексовані."""
        conds = [DocumentChunk.document_id == document_id]
        if pending_only:
            conds.append(DocumentChunk.indexed_at.is_(None))
        return (await self.db.exec(
            select(func.count()).select_from(DocumentChunk).where(*conds))).one()

    # ---- перегляд у UI (без векторів) ---------------------------------------

    async def list_brief_page(self, document_id: uuid.UUID, *, limit: int, offset: int,
                              q: str | None = None) -> tuple[list[Row], int]:
        """Легкий список: (id, chunk_index, preview, token_count, page_number, meta, indexed_at).
        Повний content не вантажимо; q — пошук підрядка в тексті (без урахування регістру)."""
        conds = [DocumentChunk.document_id == document_id]
        if q:
            conds.append(DocumentChunk.content.ilike(f"%{_like_escape(q)}%", escape="\\"))
        total = (await self.db.exec(
            select(func.count()).select_from(DocumentChunk).where(*conds))).one()
        rows = await self.db.exec(
            select(DocumentChunk.id, DocumentChunk.chunk_index,
                   func.left(DocumentChunk.content, PREVIEW_CHARS).label("preview"),
                   DocumentChunk.token_count, DocumentChunk.page_number,
                   DocumentChunk.meta, DocumentChunk.indexed_at)
            .where(*conds).order_by(DocumentChunk.chunk_index).limit(limit).offset(offset))
        return list(rows.all()), total

    async def get_by_index(self, document_id: uuid.UUID, chunk_index: int) -> DocumentChunk | None:
        return (await self.db.exec(
            select(DocumentChunk).where(DocumentChunk.document_id == document_id,
                                        DocumentChunk.chunk_index == chunk_index))).first()

    async def outline(self, document_id: uuid.UUID) -> list[Row]:
        """(chunk_index, token_count, indexed) для всіх чанків — «карта» документа в UI."""
        rows = await self.db.exec(
            select(DocumentChunk.chunk_index, DocumentChunk.token_count,
                   DocumentChunk.indexed_at.is_not(None).label("indexed"))
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index))
        return list(rows.all())
