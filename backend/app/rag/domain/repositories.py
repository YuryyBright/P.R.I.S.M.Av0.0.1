"""Порти репозиторіїв (domain). Сервіси залежать від цих протоколів, а не від SQLAlchemy.

Контракт: репозиторій НІКОЛИ не робить commit/rollback — лише flush.
Транзакцією володіє сервіс / stage.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Protocol, Sequence

if TYPE_CHECKING:
    from app.models.rag.collection import Collection
    from app.models.rag.collection_member import CollectionMember
    from app.models.rag.document import Document
    from app.models.rag.document_chunk import DocumentChunk
    from app.models.rag.ingestion_job import IngestionJob
    from app.models.rag.ingestion_stage import IngestionStage
    from app.rag.domain.enums import CollectionRole, DocumentStatus, IngestionStageName


class CollectionRepository(Protocol):
    async def get(self, collection_id: uuid.UUID) -> Collection | None: ...
    async def add(self, collection: Collection) -> Collection:
        """flush; uq_collections_owner_name → ConflictError."""
    async def list_visible(self, where: Any, *, limit: int, offset: int
                           ) -> list[Collection]: ...
    async def count_visible(self, where: Any) -> int: ...
    def add_member(self, member: CollectionMember) -> None: ...
    async def user_exists(self, user_id: uuid.UUID) -> bool: ...
    async def get_member(self, collection_id: uuid.UUID, user_id: uuid.UUID
                         ) -> CollectionMember | None: ...


class DocumentRepository(Protocol):
    async def get(self, document_id: uuid.UUID) -> Document | None: ...
    async def get_active(self, document_id: uuid.UUID) -> Document | None:
        """Не видалений (deleted_at IS NULL і status != DELETED)."""
    async def find_active_id_by_hash(self, collection_id: uuid.UUID,
                                     content_hash: str) -> uuid.UUID | None: ...
    def add(self, document: Document) -> None: ...
    async def list_page(self, collection_id: uuid.UUID, *, limit: int, offset: int,
                        status: DocumentStatus | None = None) -> tuple[list[Document], int]: ...


class IngestionJobRepository(Protocol):
    async def get(self, job_id: uuid.UUID) -> IngestionJob | None: ...
    def add(self, job: IngestionJob) -> None: ...
    async def set_celery_task_id(self, job_id: uuid.UUID, task_id: str | None) -> None: ...
    async def claim_undispatched(self, *, older_than: datetime, limit: int
                                 ) -> Sequence[IngestionJob]:
        """QUEUED без celery_task_id, FOR UPDATE SKIP LOCKED — для планувальника."""
    async def get_or_create_stage(self, job_id: uuid.UUID,
                                  name: IngestionStageName) -> IngestionStage: ...


class ChunkRepository(Protocol):
    async def list_for_document(self, document_id: uuid.UUID) -> Sequence[DocumentChunk]: ...
    async def replace_for_document(self, document_id: uuid.UUID,
                                   chunks: Sequence[DocumentChunk]) -> None: ...
    async def mark_indexed(self, chunk_ids: Sequence[uuid.UUID], *,
                           model: str, version: str) -> None: ...
    async def count_indexed(self, document_id: uuid.UUID) -> tuple[int, int]:
        """(total, pending) — pending = indexed_at IS NULL."""