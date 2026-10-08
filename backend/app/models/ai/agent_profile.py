from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import CheckConstraint, Column, String, Text, text
from sqlmodel import Field

from app.models.rag.rag_base import USER_ID_FK, RagBaseModel, fk_column, jsonb_column


class AiAgentProfile(RagBaseModel, table=True):
    __tablename__ = "ai_agent_profiles"  # type: ignore[assignment]
    __table_args__ = (
        CheckConstraint(
            "max_steps BETWEEN 1 AND 50",
            name="ck_ai_agent_profiles_max_steps",
        ),
    )

    owner_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(USER_ID_FK, ondelete="CASCADE", nullable=True),
    )
    name: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    prompt_template_id: uuid.UUID = Field(
        sa_column=fk_column("ai_prompt_templates.id", ondelete="RESTRICT")
    )
    # Keep the existing database column while matching the API/service attribute.
    model: Optional[str] = Field(
        default=None,
        sa_column=Column("model_alias", String(255), nullable=True),
    )
    allowed_tools: list[str] = Field(
        default_factory=list,
        sa_column=jsonb_column("allowed_tools", empty="[]"),
    )
    default_collection_ids: list[str] = Field(
        default_factory=list,
        sa_column=jsonb_column("default_collection_ids", empty="[]"),
    )
    max_steps: int = Field(default=8, ge=1, le=50)
    is_archived: bool = Field(
        default=False,
        sa_column_kwargs={"server_default": text("false")},
    )
