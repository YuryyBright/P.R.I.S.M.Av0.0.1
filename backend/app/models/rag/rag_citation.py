import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, CheckConstraint, Float, Text, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import RagImmutableModel, fk_column, meta_field

if TYPE_CHECKING:
    from app.models.rag.rag_message import RagMessage


class RagCitation(RagImmutableModel, table=True):
    """Джерело, на яке посилається відповідь (таблиця `rag_citations`).

    document_id / chunk_id — SET NULL: при видаленні документа або
    перечанкінгу цитата у збереженій відповіді лишається (є citation_text).
    """

    __tablename__ = "rag_citations"  # type: ignore[assignment]
    __table_args__ = (
        UniqueConstraint("message_id", "rank", name="uq_rag_citations_message_rank"),
        CheckConstraint("rank >= 1", name="ck_rag_citations_rank"),
    )

    message_id: uuid.UUID = Field(sa_column=fk_column("rag_messages.id", ondelete="CASCADE"))
    document_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("documents.id", ondelete="SET NULL", nullable=True),
    )
    chunk_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("document_chunks.id", ondelete="SET NULL", nullable=True),
    )

    rank: int
    score: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    citation_text: str = Field(sa_type=Text)  # snapshot фрагмента
    meta: dict = meta_field()  # напр. snapshot title/url/page

    message: Optional["RagMessage"] = Relationship(back_populates="citations")
