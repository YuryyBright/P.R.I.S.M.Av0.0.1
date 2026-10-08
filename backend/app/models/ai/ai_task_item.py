

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, Text, UniqueConstraint
from sqlmodel import Field, Relationship

from app.ai.tasks.domain import ItemStatus
from app.models.rag.rag_base import RagImmutableModel, enum_column, fk_column, jsonb_column

if TYPE_CHECKING:
    from app.models.ai import AiTask


class AiTaskItem(RagImmutableModel, table=True):
    __tablename__ = "ai_task_items"  # type: ignore[assignment]
    __table_args__ = (
        UniqueConstraint("task_id", "item_key", name="uq_ai_task_items_task_key"),
    )

    task_id: uuid.UUID = Field(
        sa_column=fk_column("ai_tasks.id", ondelete="CASCADE")
    )
    item_key: str = Field(max_length=512)
    status: ItemStatus = Field(
        default=ItemStatus.PROCESSING,
        sa_column=enum_column(ItemStatus, index=True),
    )
    attempts: int = Field(default=0, ge=0)
    error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    meta: dict[str, object] = Field(
        default_factory=dict,
        sa_column=jsonb_column("metadata"),
    )

    task: "AiTask" = Relationship(back_populates="items")
