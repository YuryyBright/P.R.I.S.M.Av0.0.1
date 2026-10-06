import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, Relationship

from app.ai.domain.enums import StepStatus, StepType
from app.models.rag.rag_base import RagImmutableModel, enum_column, fk_column, jsonb_column

if TYPE_CHECKING:
    from app.models.ai.ai_run import AiRun


class AiRunStep(RagImmutableModel, table=True):
    """Завершений крок run-а (таблиця `ai_run_steps`). Пишеться ОДИН раз, без UPDATE.

    Подія step.started існує лише в SSE. Токени не зберігаються (живуть у Redis Stream).
    """

    __tablename__ = "ai_run_steps"
    __table_args__ = (
        UniqueConstraint("run_id", "idx", name="uq_ai_run_steps_position"),
        CheckConstraint("idx >= 0", name="ck_ai_run_steps_idx"),
    )

    run_id: uuid.UUID = Field(sa_column=fk_column("ai_runs.id", ondelete="CASCADE"))
    idx: int
    type: StepType = Field(sa_column=enum_column(StepType))
    name: Optional[str] = Field(default=None, max_length=128)     # ім'я інструмента / підтип
    status: StepStatus = Field(
        default=StepStatus.OK, sa_column=enum_column(StepStatus, default=StepStatus.OK))

    input: dict = Field(default_factory=dict, sa_column=jsonb_column("input"))
    output: dict = Field(default_factory=dict, sa_column=jsonb_column("output"))

    latency_ms: int = Field(default=0)
    prompt_tokens: Optional[int] = Field(default=None)
    completion_tokens: Optional[int] = Field(default=None)

    run: "AiRun" = Relationship(back_populates="steps")
