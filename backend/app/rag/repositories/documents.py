"""Доступ до БД для Document. Soft-delete (deleted_at) інкапсульований тут.

Без commit. Методи set_*/merge_*/fill_*/mark_* лише змінюють об'єкт у сесії.
"""
import uuid
from typing import Any

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus


def _alive(collection_id: uuid.UUID | None = None) -> list:
    conds = [Document.deleted_at.is_(None), Document.status != DocumentStatus.DELETED]
    if collection_id is not None:
        conds.append(Document.collection_id == collection_id)
    return conds


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, doc: Document) -> None:
        self.db.add(doc)

    async def get(self, document_id: uuid.UUID) -> Document | None:
        """Без фільтра soft-delete (напр. для перевірки доступу до job-а)."""
        return await self.db.get(Document, document_id)

    async def get_active(self, document_id: uuid.UUID) -> Document | None:
        """None, якщо документа нема або він видалений."""
        doc = await self.db.get(Document, document_id)
        if doc is None or doc.deleted_at is not None or doc.status == DocumentStatus.DELETED:
            return None
        return doc

    async def find_active_id_by_hash(self, collection_id: uuid.UUID, content_hash: str) -> uuid.UUID | None:
        return (await self.db.exec(select(Document.id).where(
            Document.collection_id == collection_id,
            Document.content_hash == content_hash,
            Document.deleted_at.is_(None),
            Document.status != DocumentStatus.DELETED))).first()

    async def list_page(self, collection_id: uuid.UUID, *, limit: int, offset: int,
                        status: DocumentStatus | None = None) -> tuple[list[Document], int]:
        conds = _alive(collection_id)
        if status is not None:
            conds.append(Document.status == status)
        total = (await self.db.exec(
            select(func.count()).select_from(Document).where(*conds))).one()
        rows = await self.db.exec(
            select(Document).where(*conds)
            .order_by(Document.created_at.desc()).limit(limit).offset(offset))
        return list(rows.all()), total

    # ---- зміна стану (для ingestion-етапів) --------------------------------

    def set_status(self, doc: Document, status: DocumentStatus) -> None:
        doc.status = status

    def mark_ready(self, doc: Document) -> None:
        doc.status, doc.indexed_at = DocumentStatus.READY, utcnow()

    def merge_meta(self, doc: Document, key: str, value: Any) -> None:
        """Нове значення dict (а не in-place), щоб SQLAlchemy помітила зміну JSONB."""
        doc.meta = {**doc.meta, key: value}

    def fill_missing(self, doc: Document, **values: Any) -> None:
        """Записати лише ті поля, які ще порожні (не перезатираємо задане користувачем)."""
        for name, value in values.items():
            if not getattr(doc, name):
                setattr(doc, name, value)