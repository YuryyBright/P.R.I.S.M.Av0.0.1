import uuid
from typing import Optional

from sqlalchemy import Text, UniqueConstraint
from sqlmodel import Field

from app.models.rag.rag_base import (
    USER_ID_FK, RagImmutableModel, fk_column, jsonb_column,
)


class AiPromptVersion(RagImmutableModel, table=True):
    """Незмінна версія промпту (таблиця `ai_prompt_versions`).

    Редагування = нова версія + перестановка active_version_id. Відкат = зміна вказівника.
    `changelog` вигляду "seed:<hash12>" позначає версії, синхронізовані з seeds/*.j2.
    """

    __tablename__ = "ai_prompt_versions"
    __table_args__ = (
        UniqueConstraint("template_id", "version", name="uq_ai_prompt_versions_number"),
    )

    template_id: uuid.UUID = Field(
        sa_column=fk_column("ai_prompt_templates.id", ondelete="CASCADE"))
    version: int
    content: str = Field(sa_type=Text)                         # Jinja2 ({{ variables }})
    variables_schema: dict = Field(default_factory=dict, sa_column=jsonb_column("variables_schema"))
    model_params: dict = Field(default_factory=dict, sa_column=jsonb_column("model_params"))
    changelog: Optional[str] = Field(default=None, sa_type=Text)
    created_by_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(USER_ID_FK, ondelete="SET NULL", nullable=True),
    )
