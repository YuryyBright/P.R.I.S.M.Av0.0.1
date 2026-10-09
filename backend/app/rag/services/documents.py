"""DocumentService (upload/list/get/rename/delete/reindex) і JobService (get/list/cancel/retry).

Upload: перевірки → читання з лімітом і sha256 → дедуплікація → файл у storage →
Document+Job в ОДНІЙ транзакції → commit → dispatch у Celery. Dispatch після commit,
щоб worker не отримав job, якого ще нема в БД. Якщо dispatch впав, job лишається
QUEUED без celery_task_id (його підхопить періодична перепостановка —
IngestionJobRepository.claim_undispatched).

Delete: soft-delete + скасування активних job-ів + commit; фізичне очищення (вектори,
чанки, blob-и) — у Celery (rag.purge_document), з sweep як страховкою.

Reindex/retry: завжди НОВИЙ job (історія зберігається); pipeline ідемпотентний,
старі вектори лишаються доступними до завершення нового індексування (delete_stale в кінці).
"""
import asyncio
import logging
import uuid
from hashlib import sha256
from pathlib import PurePosixPath
from typing import Any, Callable, List

from fastapi import UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.ingestion_job import IngestionJob
from app.models.users.user_model import User
from app.rag.domain.exceptions import (
    ConflictError, ForbiddenError, InvalidInputError, NotFoundError,
    PayloadTooLargeError, UnsupportedMediaError,
)
from app.rag.domain.ports import BlobStorage
from app.rag.domain.uploads import clean_filename, resolve_mime, title_from_filename
from app.rag.repositories import DocumentChunkRepository, DocumentRepository, IngestionJobRepository
from app.rag.services.dispatch import dispatch_parse, dispatch_purge_document
from app.rag.settings import IngestionSettings, get_rag_settings
from app.rag.domain.access import AccessPolicy, Action, collections_with_role_where
from app.rag.domain.enums import (
    CollectionRole,
    DocumentSourceType,
    DocumentStatus,
    IngestionStageName,
    JobStatus,
    JobType,
)
from app.rag.schemas import (
    ChunkBriefDbRow,
    ChunkOutlineDbRow,
    ChunkStatsRead,
    DocumentDetailRead,
    DocumentJobBrief,
    DocumentUpdate,
    JobListItem,
    UploadResponse,
)
logger = logging.getLogger(__name__)

_READ_CHUNK = 1024 * 1024
_ACTIVE = (JobStatus.QUEUED, JobStatus.PROCESSING)
_SETTLED_DOC = (DocumentStatus.READY, DocumentStatus.FAILED, DocumentStatus.DELETED)
JOB_LIST_MIN_ROLE = CollectionRole.EDITOR

class DocumentService:
    def __init__(self, db: AsyncSession, policy: AccessPolicy, storage: BlobStorage, *,
                 cfg: IngestionSettings | None = None,
                 dispatcher: Callable[[uuid.UUID], str | None] = dispatch_parse,
                 purge_dispatcher: Callable[[uuid.UUID], str | None] = dispatch_purge_document,
                 docs: DocumentRepository | None = None,
                 jobs: IngestionJobRepository | None = None,
                 chunks: DocumentChunkRepository | None = None) -> None:
        self.db, self.policy, self.storage = db, policy, storage
        self.cfg = cfg or get_rag_settings().ingestion
        self.dispatcher = dispatcher
        self.purge_dispatcher = purge_dispatcher
        self.docs = docs or DocumentRepository(db)
        self.jobs = jobs or IngestionJobRepository(db)
        self.chunks = chunks or DocumentChunkRepository(db)

    # ---- helpers ---------------------------------------------------------------

    async def _enqueue(self, job_id: uuid.UUID) -> None:
        """Dispatch ПІСЛЯ commit. Збій не піднімається: job лишається QUEUED без
        celery_task_id, і його перепоставить планувальник."""
        try:
            task_id = await asyncio.to_thread(self.dispatcher, job_id)
            await self.jobs.set_celery_task_id(job_id, task_id)
            await self.db.commit()
        except Exception:
            logger.exception("dispatch failed for job=%s (will stay QUEUED)", job_id)
            await self.db.rollback()

    async def _get_active_or_404(self, document_id: uuid.UUID) -> Document:
        doc = await self.docs.get_active(document_id)
        if doc is None:
            raise NotFoundError("Document not found")
        return doc

    # ---- upload ----------------------------------------------------------------

    async def _read_limited(self, file: UploadFile) -> tuple[bytes, str]:
        max_bytes = self.cfg.max_file_mb * 1024 * 1024
        buf, digest = bytearray(), sha256()
        while chunk := await file.read(_READ_CHUNK):
            buf += chunk
            if len(buf) > max_bytes:
                raise PayloadTooLargeError(f"File is larger than {self.cfg.max_file_mb} MB")
            digest.update(chunk)
        if not buf:
            raise InvalidInputError("File is empty")
        return bytes(buf), digest.hexdigest()

    async def upload(self, user: User, collection_id: uuid.UUID, file: UploadFile) -> UploadResponse:
        col = await self.policy.require(user, collection_id, Action.WRITE)

        filename = clean_filename(file.filename)
        mime = resolve_mime(filename)
        if mime is None or mime not in self.cfg.allowed_mime:
            raise UnsupportedMediaError(
                "Unsupported file type", extra={"allowed": self.cfg.allowed_mime})

        data, digest = await self._read_limited(file)

        existing = await self.docs.find_active_id_by_hash(col.id, digest)
        if existing is not None:
            raise ConflictError("A document with identical content already exists in this collection",
                                extra={"document_id": str(existing)})

        doc_id, job_id = uuid.uuid4(), uuid.uuid4()
        ext = PurePosixPath(filename).suffix.lower()
        storage_path = f"originals/{str(doc_id)[:2]}/{doc_id}{ext}"
        await asyncio.to_thread(self.storage.write_bytes, storage_path, data)

        self.docs.add(Document(
            id=doc_id, collection_id=col.id, owner_id=user.id,
            title=title_from_filename(filename), filename=filename, mime_type=mime,
            size_bytes=len(data), source_type=DocumentSourceType.UPLOAD,
            storage_path=storage_path, content_hash=digest, status=DocumentStatus.PENDING))
        self.jobs.add(IngestionJob(
            id=job_id, user_id=user.id, document_id=doc_id,
            job_type=JobType.DOCUMENT_INGEST, payload={"filename": filename}))
        await self.db.commit()

        await self._enqueue(job_id)
        return UploadResponse(document_id=doc_id, job_id=job_id)

    # ---- read ------------------------------------------------------------------

    async def get(self, user: User, document_id: uuid.UUID) -> Document:
        doc = await self._get_active_or_404(document_id)
        await self.policy.require(user, doc.collection_id, Action.READ)   # 404, якщо колекція недоступна
        return doc

    async def get_details(self, user: User, document_id: uuid.UUID) -> DocumentDetailRead:
        """Повна картка документа: метадані + агрегати по чанках + останні job-и.

        Доступ — як у get() (READ на колекцію). Чутливі поля віддаємо вужчому колу:
        owner_email / acl_count — лише тим, хто має WRITE на колекцію; storage_path — superuser.
        """
        doc = await self.get(user, document_id)
        is_superuser = bool(getattr(user, "is_superuser", False))
        can_write = is_superuser or await self.policy.can(user, doc.collection_id, Action.WRITE)

        stats = await self.docs.chunk_stats(doc.id)
        jobs = await self.jobs.list_for_document(doc.id, limit=5)

        owner_email = None
        acl_count = None
        if can_write:
            acl_count = await self.docs.acl_count(doc.id)
            if doc.owner_id is not None:
                owner = await self.db.get(User, doc.owner_id)
                owner_email = getattr(owner, "email", None)

        def _val(value: Any) -> Any:  # Enum -> str
            return getattr(value, "value", value)

        return DocumentDetailRead(
            id=doc.id, collection_id=doc.collection_id,
            collection_name=getattr(doc.collection, "name", None),
            title=doc.title, filename=doc.filename, mime_type=doc.mime_type,
            size_bytes=doc.size_bytes,
            source_type=_val(doc.source_type), source_id=doc.source_id,
            external_id=doc.external_id,
            language=doc.language, author=doc.author, url=doc.url,
            published_at=doc.published_at,
            status=_val(doc.status), version=doc.version, content_hash=doc.content_hash,
            has_original=bool(doc.storage_path),
            storage_path=doc.storage_path if is_superuser else None,
            owner_id=doc.owner_id, owner_email=owner_email, acl_count=acl_count,
            meta=doc.meta or {},
            created_at=getattr(doc, "created_at", None),
            updated_at=getattr(doc, "updated_at", None),
            indexed_at=doc.indexed_at,
            chunks=ChunkStatsRead(**stats),
            recent_jobs=[
                DocumentJobBrief(
                    id=j.id, job_type=_val(j.job_type), status=_val(j.status),
                    created_at=getattr(j, "created_at", None))
                for j in jobs
            ],
        )

    # ---- chunks (перегляд; доступ — як у get(): READ на колекцію) --------------

    async def list_chunks(self, user: User, document_id: uuid.UUID, *, limit: int, offset: int,
                          q: str | None = None) -> tuple[List[ChunkBriefDbRow], int]:
        doc = await self.get(user, document_id)
        return await self.chunks.list_brief_page(doc.id, limit=limit, offset=offset, q=q)

    async def get_chunk(self, user: User, document_id: uuid.UUID, chunk_index: int) -> DocumentChunk:
        doc = await self.get(user, document_id)
        chunk = await self.chunks.get_by_index(doc.id, chunk_index)
        if chunk is None:
            raise NotFoundError("Chunk not found")
        return chunk

    async def chunk_outline(
        self, user: User, document_id: uuid.UUID
    ) -> List[ChunkOutlineDbRow]:
        doc = await self.get(user, document_id)
        return await self.chunks.outline(doc.id)

    async def list(self, user: User, collection_id: uuid.UUID, *, limit: int, offset: int,
                   status: DocumentStatus | None = None) -> tuple[list[Document], int]:
        await self.policy.require(user, collection_id, Action.READ)
        return await self.docs.list_page(collection_id, limit=limit, offset=offset, status=status)

    # ---- update / delete / reindex ---------------------------------------------

    async def rename(self, user: User, document_id: uuid.UUID, data: DocumentUpdate) -> Document:
        doc = await self._get_active_or_404(document_id)
        await self.policy.require(user, doc.collection_id, Action.WRITE)
        doc.title = data.title
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def delete(self, user: User, document_id: uuid.UUID) -> None:
        """Soft-delete одразу, фізичне очищення (вектори/чанки/blob-и) — у Celery.

        Активні job-и скасовуються; embed-етап помічає це між батчами й сам прибирає
        вектори, що встигли записатись.
        """
        doc = await self._get_active_or_404(document_id)
        await self.policy.require(user, doc.collection_id, Action.WRITE)
        self.docs.soft_delete(doc)
        await self.jobs.cancel_active_for_documents([doc.id])
        await self.db.commit()
        try:
            await asyncio.to_thread(self.purge_dispatcher, doc.id)
        except Exception:
            logger.exception("purge dispatch failed document=%s (sweep will pick it up)", doc.id)

    async def reindex(self, user: User, document_id: uuid.UUID) -> UploadResponse:
        """Новий job для існуючого документа (перепарсинг → чанкінг → ембединг).
        Використовується і для retry невдалого/скасованого job-а."""
        doc = await self._get_active_or_404(document_id)
        await self.policy.require(user, doc.collection_id, Action.WRITE)
        if not doc.storage_path:
            raise InvalidInputError("Document has no original file to reindex")
        if await self.jobs.find_active_for_document(doc.id) is not None:
            raise ConflictError("Document is already being processed")

        job_id = uuid.uuid4()
        self.jobs.add(IngestionJob(
            id=job_id, user_id=user.id, document_id=doc.id,
            job_type=JobType.REINDEX, payload={"reason": "manual"}))
        await self.db.commit()

        await self._enqueue(job_id)
        return UploadResponse(document_id=doc.id, job_id=job_id)


class JobService:
    def __init__(self, db: AsyncSession, policy: AccessPolicy, *,
                 jobs: IngestionJobRepository | None = None,
                 docs: DocumentRepository | None = None) -> None:
        self.db, self.policy = db, policy
        self.jobs = jobs or IngestionJobRepository(db)
        self.docs = docs or DocumentRepository(db)

    async def get(self, user: User, job_id: uuid.UUID) -> IngestionJob:
        job = await self.jobs.get(job_id)                      # stages — selectin
        if job is None:
            raise NotFoundError("Job not found")
        allowed = bool(getattr(user, "is_superuser", False)) or job.user_id == user.id
        if not allowed and job.document_id:
            doc = await self.docs.get(job.document_id)
            allowed = doc is not None and await self.policy.can(user, doc.collection_id, Action.READ)
        if not allowed:
            raise NotFoundError("Job not found")

        # EMBED and INDEX are one batch pipeline. Use persisted chunk markers as
        # the source of truth so old/stale stage counters cannot show 0/N while
        # successful Qdrant upserts have already been committed.
        if job.document_id:
            chunks = DocumentChunkRepository(self.db)
            total = await chunks.count(job.document_id)
            if total:
                pending = await chunks.count(job.document_id, pending_only=True)
                for stage in job.stages:
                    if stage.stage in (IngestionStageName.EMBED, IngestionStageName.INDEX):
                        stage.items_total = total
                        stage.items_processed = total - pending
        return job

    async def list_for_document(self, user: User, document_id: uuid.UUID, *,
                                limit: int = 20) -> list[IngestionJob]:
        doc = await self.docs.get_active(document_id)
        if doc is None:
            raise NotFoundError("Document not found")
        await self.policy.require(user, doc.collection_id, Action.READ)
        return await self.jobs.list_for_document(document_id, limit=limit)

    async def _can_write(self, user: User, job: IngestionJob) -> bool:
        if getattr(user, "is_superuser", False):
            return True
        if job.document_id:
            doc = await self.docs.get(job.document_id)
            return doc is not None and await self.policy.can(user, doc.collection_id, Action.WRITE)
        return job.user_id == user.id

    async def cancel(self, user: User, job_id: uuid.UUID) -> IngestionJob:
        """QUEUED/PROCESSING → CANCELLED. Етапи перевіряють статус на старті, embed — між батчами.

        Незавершений документ (ще не READY) позначається FAILED, щоб не «висів» у проміжному
        статусі; READY-документ, чий reindex скасовано до старту, лишається READY.
        """
        job = await self.get(user, job_id)
        if not await self._can_write(user, job):
            raise ForbiddenError("Insufficient permissions")
        if job.status not in _ACTIVE:
            raise ConflictError("Job is not active")
        self.jobs.cancel(job)
        if job.document_id:
            doc = await self.docs.get(job.document_id)
            if doc is not None and doc.status not in _SETTLED_DOC:
                self.docs.set_status(doc, DocumentStatus.FAILED)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def ensure_retryable(self, user: User, job_id: uuid.UUID) -> uuid.UUID:
        """Перевіряє, що job можна повторити, і повертає document_id.
        Сам повтор = DocumentService.reindex(document_id) (новий job)."""
        job = await self.get(user, job_id)
        if job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
            raise ConflictError("Only failed or cancelled jobs can be retried")
        if job.document_id is None:
            raise InvalidInputError("Job has no document to retry")
        return job.document_id
    
    async def list_page(self, user: User, *, limit: int, offset: int,
                            status: JobStatus | None = None,
                            document_id: uuid.UUID | None = None,
                            ) -> tuple[list[JobListItem], int]:
            """Свої job-и + job-и документів колекцій, де користувач ≥ JOB_LIST_MIN_ROLE.
            Superuser бачить усі."""
            if getattr(user, "is_superuser", False):
                user_id, coll_where = None, None
            else:
                user_id = user.id
                coll_where = collections_with_role_where(user, JOB_LIST_MIN_ROLE)
            rows, total = await self.jobs.list_page(
                user_id=user_id, collections_where=coll_where, status=status,
                document_id=document_id, limit=limit, offset=offset)
            return [JobListItem.from_job(j, title, cid) for j, title, cid in rows], total
