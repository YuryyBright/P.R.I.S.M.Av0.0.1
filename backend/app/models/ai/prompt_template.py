import uuid
from typing import Optional

from sqlalchemy import Column, Index, Text, UniqueConstraint, text
from sqlmodel import Field

from app.ai.domain.enums import PromptKind
from app.models.rag.rag_base import USER_ID_FK, RagBaseModel, enum_column, fk_column


class AiPromptTemplate(RagBaseModel, table=True):
    """Іменований промпт (таблиця `ai_prompt_templates`). owner_id IS NULL = системний."""

    __tablename__ = "ai_prompt_templates"  # type: ignore[assignment]
    __table_args__ = (
        UniqueConstraint("owner_id", "slug", name="uq_ai_prompt_templates_owner_slug"),
        # у PostgreSQL NULL != NULL → окремий partial unique для системних промптів
        Index("uq_ai_prompt_templates_system_slug", "slug", unique=True,
              postgresql_where=text("owner_id IS NULL")),
    )

    owner_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(USER_ID_FK, ondelete="CASCADE", nullable=True),
    )
    slug: str = Field(max_length=128)
    name: str = Field(max_length=255)
    kind: PromptKind = Field(sa_column=enum_column(PromptKind, index=True))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_archived: bool = Field(default=False, sa_column_kwargs={"server_default": text("false")})
    # без FK (уникаємо циклу template ↔ version); цілісність — у PromptRepository
    active_version_id: Optional[uuid.UUID] = Field(default=None)
