import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, DateTime, Index, Text, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    USER_ID_FK, RagBaseModel, enum_column, fk_column, meta_field,
)
from app.rag.domain.enums import DocumentSourceType, DocumentStatus

if TYPE_CHECKING:
    from app.models.rag.collection import Collection
    from app.models.rag.document_acl import DocumentACL
    from app.models.rag.document_chunk import DocumentChunk
    from app.models.rag.source import Source
    from app.models.users.user_model import User


class Document(RagBaseModel, table=True):
    """Один документ у колекції (таблиця `documents`). Оригінал — у blob storage."""

    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_collection_status", "collection_id", "status"),
        Index("ix_documents_collection_hash", "collection_id", "content_hash"),
        # ідемпотентність sync: той самий зовнішній запис не дублюється
        Index(
            "uq_documents_source_external",
            "collection_id", "source_id", "external_id",
            unique=True,
            postgresql_where=text(
                "source_id IS NOT NULL AND external_id IS NOT NULL AND deleted_at IS NULL"
            ),
        ),
    )

    # RESTRICT: векторів у Qdrant БД-каскад не почистить → колекцію видаляємо
    # лише application-логікою (спершу документи + Qdrant).
    collection_id: uuid.UUID = Field(
        sa_column=fk_column("collections.id", ondelete="RESTRICT")
    )
    # nullable: документи з автоматичних джерел можуть не мати власника-людини
    owner_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(USER_ID_FK, ondelete="SET NULL", nullable=True),
    )
    source_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("sources.id", ondelete="SET NULL", nullable=True),
    )

    title: str = Field(max_length=512)
    filename: Optional[str] = Field(default=None, max_length=512)
    mime_type: Optional[str] = Field(default=None, max_length=128)
    size_bytes: Optional[int] = Field(default=None, sa_type=BigInteger)

    source_type: DocumentSourceType = Field(
        default=DocumentSourceType.UPLOAD,
        sa_column=enum_column(DocumentSourceType, default=DocumentSourceType.UPLOAD, index=True),
    )
    external_id: Optional[str] = Field(default=None, max_length=512)

    storage_path: Optional[str] = Field(default=None, max_length=1024)
    content_hash: Optional[str] = Field(default=None, max_length=64)  # sha256 hex

    # поля з CanonicalDocument (потрібні для цитат)
    language: Optional[str] = Field(default=None, max_length=16)
    author: Optional[str] = Field(default=None, max_length=255)
    url: Optional[str] = Field(default=None, sa_type=Text)
    published_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))

    status: DocumentStatus = Field(
        default=DocumentStatus.PENDING,
        sa_column=enum_column(DocumentStatus, default=DocumentStatus.PENDING, index=True),
    )
    version: int = Field(default=1, sa_column_kwargs={"server_default": text("1")})
    meta: dict = meta_field()

    indexed_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
    deleted_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))

    collection: Optional["Collection"] = Relationship(
        back_populates="documents", sa_relationship_kwargs={"lazy": "selectin"}
    )
    owner: Optional["User"] = Relationship(sa_relationship_kwargs={"lazy": "raise"})
    source: Optional["Source"] = Relationship(
        back_populates="documents", sa_relationship_kwargs={"lazy": "raise"}
    )
    chunks: list["DocumentChunk"] = Relationship(
        back_populates="document",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True, "lazy": "raise",
        },
    )
    acl_entries: list["DocumentACL"] = Relationship(
        back_populates="document",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True, "lazy": "raise",
        },
    )
