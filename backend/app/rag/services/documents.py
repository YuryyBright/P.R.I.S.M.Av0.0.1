"""DocumentService (upload/list/get) і JobService.

Upload: перевірки → читання з лімітом і sha256 → дедуплікація → файл у storage →
Document+Job в ОДНІЙ транзакції → commit → dispatch у Celery. Dispatch після commit,
щоб worker не отримав job, якого ще нема в БД. Якщо dispatch впав, job лишається
QUEUED без celery_task_id (його підхопить періодична перепостановка —
IngestionJobRepository.claim_undispatched).
"""
import asyncio
import logging
import uuid
from hashlib import sha256
from pathlib import PurePosixPath
from typing import Callable

from fastapi import UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob
from app.models.users.user_model import User
from app.rag.domain.access import AccessPolicy, Action
from app.rag.domain.enums import DocumentSourceType, DocumentStatus, JobType
from app.rag.domain.exceptions import (
    ConflictError, InvalidInputError, NotFoundError, PayloadTooLargeError, UnsupportedMediaError,
)
from app.rag.domain.ports import BlobStorage
from app.rag.domain.uploads import clean_filename, resolve_mime, title_from_filename
from app.rag.repositories import DocumentRepository, IngestionJobRepository
from app.rag.schemas import UploadResponse
from app.rag.services.dispatch import dispatch_parse
from app.rag.settings import IngestionSettings, get_rag_settings

logger = logging.getLogger(__name__)

_READ_CHUNK = 1024 * 1024


class DocumentService:
    def __init__(self, db: AsyncSession, policy: AccessPolicy, storage: BlobStorage, *,
                 cfg: IngestionSettings | None = None,
                 dispatcher: Callable[[uuid.UUID], str | None] = dispatch_parse,
                 docs: DocumentRepository | None = None,
                 jobs: IngestionJobRepository | None = None) -> None:
        self.db, self.policy, self.storage = db, policy, storage
        self.cfg = cfg or get_rag_settings().ingestion
        self.dispatcher = dispatcher
        self.docs = docs or DocumentRepository(db)
        self.jobs = jobs or IngestionJobRepository(db)

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

        try:
            task_id = await asyncio.to_thread(self.dispatcher, job_id)
            await self.jobs.set_celery_task_id(job_id, task_id)
            await self.db.commit()
        except Exception:                      # job лишається QUEUED — перепоставить планувальник
            logger.exception("dispatch failed for job=%s (will stay QUEUED)", job_id)
            await self.db.rollback()

        return UploadResponse(document_id=doc_id, job_id=job_id)

    # ---- read ------------------------------------------------------------------

    async def get(self, user: User, document_id: uuid.UUID) -> Document:
        doc = await self.docs.get_active(document_id)
        if doc is None:
            raise NotFoundError("Document not found")
        await self.policy.require(user, doc.collection_id, Action.READ)   # 404, якщо колекція недоступна
        return doc

    async def list(self, user: User, collection_id: uuid.UUID, *, limit: int, offset: int,
                   status: DocumentStatus | None = None) -> tuple[list[Document], int]:
        await self.policy.require(user, collection_id, Action.READ)
        return await self.docs.list_page(collection_id, limit=limit, offset=offset, status=status)


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
        return job