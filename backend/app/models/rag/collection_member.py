import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    USER_ID_FK,
    RagBaseModel,
    enum_column,
    fk_column,
)
from app.rag.domain.enums import CollectionRole


if TYPE_CHECKING:
    from app.models.rag.collection import Collection
    from app.models.users.user_model import User


class CollectionMember(RagBaseModel, table=True):
    """Участь користувача в RAG-колекції."""

    __tablename__ = "collection_members"

    __table_args__ = (
        UniqueConstraint(
            "collection_id",
            "user_id",
            name="uq_collection_members_pair",
        ),
    )

    collection_id: uuid.UUID = Field(
        sa_column=fk_column(
            "collections.id",
            ondelete="CASCADE",
        )
    )

    user_id: uuid.UUID = Field(
        sa_column=fk_column(
            USER_ID_FK,
            ondelete="CASCADE",
        )
    )

    role: CollectionRole = Field(
        default=CollectionRole.VIEWER,
        sa_column=enum_column(
            CollectionRole,
            default=CollectionRole.VIEWER,
        ),
    )

    collection: Optional["Collection"] = Relationship(
        back_populates="members",
    )

    user: Optional["User"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
        },
    )