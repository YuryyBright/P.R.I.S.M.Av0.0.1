"""Pydantic-схеми RAG API.

Схеми окремі від ORM-моделей:
storage_path, meta та інші внутрішні поля не віддаємо назовні
без відповідної перевірки доступу.
"""

import uuid
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.rag.domain.enums import (
    CollectionRole,
    CollectionVisibility,
    DocumentStatus,
    IngestionStageName,
    JobStatus,
    JobType,
    StageStatus,
)


T = TypeVar("T")


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


def _strip_nonblank(v: str | None) -> str | None:
    """Trim string and reject blank values."""
    if v is None:
        return None

    value = v.strip()

    if not value:
        raise ValueError("must not be blank")

    return value


# ---- collections -------------------------------------------------------------


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    visibility: CollectionVisibility = CollectionVisibility.PRIVATE

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        value = v.strip()

        if not value:
            raise ValueError("name must not be blank")

        return value


class CollectionUpdate(BaseModel):
    """PATCH: змінюються лише передані поля.

    `description: null` — очистити опис.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    visibility: CollectionVisibility | None = None

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return _strip_nonblank(v)


class CollectionRead(_ORM):
    id: uuid.UUID
    name: str
    description: str | None
    visibility: CollectionVisibility
    is_active: bool
    owner_id: uuid.UUID
    created_at: datetime
    my_role: CollectionRole | None = None

    @classmethod
    def from_collection(
        cls,
        col: object,
        role: CollectionRole | None,
    ) -> "CollectionRead":
        return cls.model_validate(col).model_copy(
            update={"my_role": role},
        )


class MemberAdd(BaseModel):
    user_id: uuid.UUID
    role: CollectionRole = CollectionRole.VIEWER

    @field_validator("role")
    @classmethod
    def _not_owner(cls, v: CollectionRole) -> CollectionRole:
        if v == CollectionRole.OWNER:
            raise ValueError(
                "owner role cannot be granted via members",
            )

        return v


class MemberRead(BaseModel):
    user_id: uuid.UUID
    role: CollectionRole


# ---- documents / jobs --------------------------------------------------------


class DocumentRead(_ORM):
    id: uuid.UUID
    collection_id: uuid.UUID
    title: str
    filename: str | None
    mime_type: str | None
    size_bytes: int | None
    status: DocumentStatus
    language: str | None
    author: str | None
    created_at: datetime
    indexed_at: datetime | None


class DocumentUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=512)

    @field_validator("title")
    @classmethod
    def _strip(cls, v: str) -> str:
        value = v.strip()

        if not value:
            raise ValueError("title must not be blank")

        return value


class UploadResponse(BaseModel):
    """Відповідь на upload, reindex та retry.

    Містить документ і щойно створений job.
    """

    document_id: uuid.UUID
    job_id: uuid.UUID
    status: JobStatus = JobStatus.QUEUED


class StageRead(_ORM):
    stage: IngestionStageName
    status: StageStatus
    items_total: int
    items_processed: int
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None


class JobRead(_ORM):
    id: uuid.UUID
    document_id: uuid.UUID | None
    job_type: JobType
    status: JobStatus
    current_stage: IngestionStageName | None
    progress: int
    error_code: str | None
    error_message: str | None
    retry_count: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    stages: list[StageRead] = Field(default_factory=list)


class JobListItem(_ORM):
    """Рядок списку job-ів.

    JobRead без stages + дані документа для таблиці.
    """

    id: uuid.UUID
    document_id: uuid.UUID | None
    document_title: str | None = None
    collection_id: uuid.UUID | None = None
    job_type: JobType
    status: JobStatus
    current_stage: IngestionStageName | None
    progress: int
    error_code: str | None
    error_message: str | None
    retry_count: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    @classmethod
    def from_job(
        cls,
        job: object,
        document_title: str | None,
        collection_id: uuid.UUID | None,
    ) -> "JobListItem":
        return cls.model_validate(job).model_copy(
            update={
                "document_title": document_title,
                "collection_id": collection_id,
            },
        )


class ChunkStatsRead(BaseModel):
    """Зведення по чанках документа без тексту чанків."""

    total: int = 0
    total_tokens: int = 0
    indexed: int = 0
    last_indexed_at: datetime | None = None
    max_page: int | None = None
    embedding_models: list[str] = Field(default_factory=list)
    chunking_versions: list[str] = Field(default_factory=list)


class DocumentJobBrief(BaseModel):
    """Короткий запис про job документа.

    Повна історія:
    GET /documents/{id}/jobs
    """

    id: uuid.UUID
    job_type: JobType
    status: JobStatus
    created_at: datetime | None = None


class DocumentDetailRead(BaseModel):
    """Повна картка документа.

    Метадані з БД + агрегати.
    GET /documents/{id}/details
    """

    id: uuid.UUID
    collection_id: uuid.UUID
    collection_name: str | None = None

    title: str
    filename: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None

    source_type: str
    source_id: uuid.UUID | None = None
    external_id: str | None = None

    language: str | None = None
    author: str | None = None
    url: str | None = None
    published_at: datetime | None = None

    status: DocumentStatus
    version: int = 1
    content_hash: str | None = None

    # Чи існує оригінал у storage.
    # Сам storage_path назовні не віддаємо звичайним користувачам.
    has_original: bool = False

    # Має бути заповнений тільки для superuser.
    storage_path: str | None = None

    # Дані owner доступні лише за відповідними ACL/permission.
    owner_id: uuid.UUID | None = None
    owner_email: str | None = None

    # Кількість ACL-записів доступна лише користувачам
    # з відповідним правом WRITE.
    acl_count: int | None = None

    meta: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime | None = None
    updated_at: datetime | None = None
    indexed_at: datetime | None = None

    chunks: ChunkStatsRead = Field(default_factory=ChunkStatsRead)
    recent_jobs: list[DocumentJobBrief] = Field(default_factory=list)
