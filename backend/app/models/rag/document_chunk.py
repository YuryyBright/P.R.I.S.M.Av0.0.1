import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, DateTime, Index, Text, UniqueConstraint, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import RagBaseModel, fk_column, meta_field

if TYPE_CHECKING:
    from app.models.rag.document import Document


class DocumentChunk(RagBaseModel, table=True):
    """Текстовий чанк (таблиця `document_chunks`).

    id чанка = id точки в Qdrant. Сам вектор у PostgreSQL НЕ зберігається.
    """

    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_position"),
        CheckConstraint("chunk_index >= 0", name="ck_document_chunks_index"),
        CheckConstraint("token_count >= 0", name="ck_document_chunks_tokens"),
        Index("ix_document_chunks_hash", "content_hash"),
    )

    document_id: uuid.UUID = Field(sa_column=fk_column("documents.id", ondelete="CASCADE"))

    chunk_index: int
    content: str = Field(sa_type=Text)
    token_count: int = Field(default=0, sa_column_kwargs={"server_default": text("0")})
    content_hash: str = Field(max_length=64)

    # позиція для цитат / підсвітки в UI
    page_number: Optional[int] = Field(default=None)
    char_start: Optional[int] = Field(default=None)
    char_end: Optional[int] = Field(default=None)

    meta: dict = meta_field()  # напр. heading_path

    chunking_version: str = Field(default="v1", max_length=32)
    embedding_model: Optional[str] = Field(default=None, max_length=255)
    embedding_version: Optional[str] = Field(default=None, max_length=64)
    indexed_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))

    document: Optional["Document"] = Relationship(back_populates="chunks")
