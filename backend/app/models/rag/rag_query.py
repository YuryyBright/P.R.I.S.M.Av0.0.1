import uuid
from typing import Optional

from sqlalchemy import Column, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlmodel import Field

from app.models.rag.rag_base import (
    USER_ID_FK, RagImmutableModel, fk_column, jsonb_column,
)


class RagQuery(RagImmutableModel, table=True):
    """Технічний запис одного retrieval (таблиця `rag_queries`).

    Зберігає параметри пошуку та snapshot доступу — для аналізу й аудиту.
    """

    __tablename__ = "rag_queries"  # type: ignore[assignment]

    user_id: Optional[uuid.UUID] = Field(
        default=None,  # SET NULL: аналітика переживає видалення користувача
        sa_column=fk_column(USER_ID_FK, ondelete="SET NULL", nullable=True),
    )
    # CASCADE: видалення діалогу прибирає й тексти запитів (приватність)
    conversation_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("rag_conversations.id", ondelete="CASCADE", nullable=True),
    )
    message_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("rag_messages.id", ondelete="SET NULL", nullable=True),
    )

    # [AI-PATCH] м'які посилання на ai_runs / ai_run_steps БЕЗ FK-констрейнту:
    # rag не залежить від ai навіть на рівні схеми БД.
    run_id: Optional[uuid.UUID] = Field(
        default=None, sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True))
    step_id: Optional[uuid.UUID] = Field(
        default=None, sa_column=Column(PG_UUID(as_uuid=True), nullable=True))

    query_text: str = Field(sa_type=Text)
    rewritten_query: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    embedding_model: Optional[str] = Field(default=None, max_length=255)
    llm_model: Optional[str] = Field(default=None, max_length=255)
    reranker_model: Optional[str] = Field(default=None, max_length=255)

    dense_top_k: Optional[int] = Field(default=None)
    sparse_top_k: Optional[int] = Field(default=None)
    fused_top_n: Optional[int] = Field(default=None)
    reranker_top_k: Optional[int] = Field(default=None)
    results_count: Optional[int] = Field(default=None)
    latency_ms: Optional[int] = Field(default=None)

    filters: dict = Field(default_factory=dict, sa_column=jsonb_column("filters"))
    # snapshot AccessScope на момент запиту (які колекції/документи були доступні)
    access_scope: dict = Field(default_factory=dict, sa_column=jsonb_column("access_scope"))
    # {"dense_ms":..,"sparse_ms":..,"rerank_ms":..,"llm_ms":..}
    timings: dict = Field(default_factory=dict, sa_column=jsonb_column("timings"))
