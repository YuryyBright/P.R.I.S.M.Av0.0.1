"""Доступ до БД для DocumentChunk. Без commit."""
import uuid
from typing import Sequence

from sqlalchemy import Row, delete, update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.rag_base import utcnow


class DocumentChunkRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def replace_for_document(self, document_id: uuid.UUID,
                                   chunks: Sequence[DocumentChunk]) -> None:
        """Видалити старі чанки й додати нові. Атомарність — за рахунок
        транзакції caller-а (один commit після виклику)."""
        await self.db.exec(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
        self.db.add_all(chunks)

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