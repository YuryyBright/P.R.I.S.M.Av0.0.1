import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, Index, Text, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    USER_ID_FK, RagBaseModel, enum_column, fk_column, jsonb_column,
)
from app.rag.domain.enums import SourceType

if TYPE_CHECKING:
    from app.models.rag.collection import Collection
    from app.models.rag.document import Document
    from app.models.rag.source_credential import SourceCredential


class Source(RagBaseModel, table=True):
    """Джерело даних: Telegram-канал, RSS, сайт... (таблиця `sources`)."""

    __tablename__ = "sources"  # type: ignore[assignment]
    __table_args__ = (
        # планувальник синхронізацій: WHERE is_active AND next_sync_at <= now()
        Index("ix_sources_active_next_sync", "is_active", "next_sync_at"),
        # один і той самий зовнішній ресурс не реєструємо двічі
        Index(
            "uq_sources_type_external",
            "type", "external_id",
            unique=True,
            postgresql_where=text("external_id IS NOT NULL"),
        ),
    )

    name: str = Field(max_length=255)
    type: SourceType = Field(
        sa_column=enum_column(SourceType, index=True)
    )
    url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    external_id: Optional[str] = Field(default=None, max_length=512)
    parser_type: Optional[str] = Field(default=None, max_length=64)

    is_active: bool = Field(
        default=True, sa_column_kwargs={"server_default": text("true")}
    )
    config: dict = Field(default_factory=dict, sa_column=jsonb_column("config"))

    # у яку колекцію потрапляють документи цього джерела
    default_collection_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("collections.id", ondelete="SET NULL", nullable=True),
    )
    created_by_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(USER_ID_FK, ondelete="SET NULL", nullable=True),
    )

    sync_interval_seconds: Optional[int] = Field(default=None)
    last_sync_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    next_sync_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    last_sync_status: Optional[str] = Field(default=None, max_length=32)
    last_sync_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    default_collection: Optional["Collection"] = Relationship(
        back_populates="sources", sa_relationship_kwargs={"lazy": "selectin"}
    )
    credentials: list["SourceCredential"] = Relationship(
        back_populates="source",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True, "lazy": "raise",
        },
    )
    documents: list["Document"] = Relationship(
        back_populates="source", sa_relationship_kwargs={"lazy": "raise"}
    )
