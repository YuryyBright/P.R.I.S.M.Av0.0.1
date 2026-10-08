"""Доступ до БД для Document. Soft-delete (deleted_at) інкапсульований тут.

Без commit. Методи set_*/merge_*/fill_*/mark_*/soft_delete* лише змінюють стан у сесії.
"""
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import delete, or_, update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.document_acl import DocumentACL
from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus



def _alive(collection_id: uuid.UUID | None = None) -> list[Any]:
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

    # ---- агрегати для картки документа -------------------------------------

    async def chunk_stats(self, document_id: uuid.UUID) -> dict[str, Any]:
        """Зведення по чанках документа (без вмісту): кількість, токени, індексація, моделі."""
        row = (await self.db.exec(
            select(
                func.count(DocumentChunk.id),
                func.coalesce(func.sum(DocumentChunk.token_count), 0),
                func.count(DocumentChunk.indexed_at),
                func.max(DocumentChunk.indexed_at),
                func.max(DocumentChunk.page_number),
            ).where(DocumentChunk.document_id == document_id))).one()
        models = (await self.db.exec(
            select(DocumentChunk.embedding_model).where(
                DocumentChunk.document_id == document_id,
                DocumentChunk.embedding_model.is_not(None)).distinct())).all()
        versions = (await self.db.exec(
            select(DocumentChunk.chunking_version).where(
                DocumentChunk.document_id == document_id).distinct())).all()
        return {
            "total": int(row[0]), "total_tokens": int(row[1]), "indexed": int(row[2]),
            "last_indexed_at": row[3], "max_page": row[4],
            "embedding_models": sorted(m for m in models if m),
            "chunking_versions": sorted(v for v in versions if v),
        }

    async def acl_count(self, document_id: uuid.UUID) -> int:
        return (await self.db.exec(
            select(func.count()).select_from(DocumentACL)
            .where(DocumentACL.document_id == document_id))).one()

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

    # ---- видалення ---------------------------------------------------------

    def soft_delete(self, doc: Document) -> None:
        doc.status, doc.deleted_at = DocumentStatus.DELETED, utcnow()

    async def soft_delete_in_collection(self, collection_id: uuid.UUID) -> int:
        """Масово позначити всі живі документи колекції видаленими (ідемпотентно)."""
        res = await self.db.exec(update(Document).where(*_alive(collection_id)).values(
            status=DocumentStatus.DELETED, deleted_at=utcnow()))
        return getattr(res, "rowcount", 0) or 0

    async def list_pending_cleanup(self, *, older_than: datetime, limit: int
                                   ) -> list[tuple[uuid.UUID, uuid.UUID]]:
        """(document_id, collection_id) видалених документів, чиє очищення ще не завершене."""
        rows = await self.db.exec(
            select(Document.id, Document.collection_id).where(
                Document.status == DocumentStatus.DELETED,
                ~Document.meta.has_key("cleanup"),
                or_(Document.deleted_at.is_(None), Document.deleted_at <= older_than),
            ).limit(limit))
        return [(r[0], r[1]) for r in rows.all()]

    async def ids_in_collection(self, collection_id: uuid.UUID) -> list[uuid.UUID]:
        """Усі документи колекції, включно з видаленими."""
        rows = await self.db.exec(
            select(Document.id).where(Document.collection_id == collection_id))
        return list(rows.all())

    async def hard_delete_in_collection(self, collection_id: uuid.UUID) -> None:
        """Фізичне видалення (chunks/acl зникають каскадом БД). Лише після purge векторів."""
        await self.db.exec(delete(Document).where(Document.collection_id == collection_id))
