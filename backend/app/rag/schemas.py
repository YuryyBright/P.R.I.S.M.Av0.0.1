"""Pydantic-схеми RAG API. Окремі від моделей: storage_path, meta та ін. назовні не віддаємо."""
import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.rag.domain.enums import (
    CollectionRole, CollectionVisibility, DocumentStatus, IngestionStageName,
    JobStatus, JobType, StageStatus,
)

T = TypeVar("T")


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


# ---- collections -------------------------------------------------------------

class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    visibility: CollectionVisibility = CollectionVisibility.PRIVATE

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


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
    def from_collection(cls, col: object, role: CollectionRole | None) -> "CollectionRead":
        return cls.model_validate(col).model_copy(update={"my_role": role})


class MemberAdd(BaseModel):
    user_id: uuid.UUID
    role: CollectionRole = CollectionRole.VIEWER

    @field_validator("role")
    @classmethod
    def _not_owner(cls, v: CollectionRole) -> CollectionRole:
        if v == CollectionRole.OWNER:
            raise ValueError("owner role cannot be granted via members")
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


class UploadResponse(BaseModel):
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
    stages: list[StageRead] = []