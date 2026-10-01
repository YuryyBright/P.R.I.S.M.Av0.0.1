import uuid
from typing import TYPE_CHECKING, Optional
from datetime import datetime
from sqlalchemy import Text, UniqueConstraint, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    USER_ID_FK, RagBaseModel, enum_column, fk_column,
)
from app.rag.domain.enums import CollectionVisibility

if TYPE_CHECKING:
    from app.models.rag.collection_member import CollectionMember
    from app.models.rag.document import Document
    from app.models.rag.source import Source
    from app.models.users.user_model import User   


class Collection(RagBaseModel, table=True):
    """Логічний контейнер документів (таблиця `collections`)."""

    __tablename__ = "collections"
    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_collections_owner_name"),
    )

    name: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, sa_type=Text)

    # RESTRICT: не можна видалити користувача, поки в нього є колекції
    owner_id: uuid.UUID = Field(sa_column=fk_column(USER_ID_FK, ondelete="RESTRICT"))

    visibility: CollectionVisibility = Field(
        default=CollectionVisibility.PRIVATE,
        sa_column=enum_column(
            CollectionVisibility, default=CollectionVisibility.PRIVATE, index=True
        ),
    )
    is_active: bool = Field(
        default=True, sa_column_kwargs={"server_default": text("true")}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # one-way до User: існуюча модель User не змінюється
    owner: Optional["User"] = Relationship(sa_relationship_kwargs={"lazy": "selectin"})
    members: list["CollectionMember"] = Relationship(
        back_populates="collection",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True, "lazy": "selectin",
        },
    )
    # lazy="raise": великі колекції завантажуємо лише явно (selectinload)
    documents: list["Document"] = Relationship(
        back_populates="collection", sa_relationship_kwargs={"lazy": "raise"}
    )
    sources: list["Source"] = Relationship(
        back_populates="default_collection", sa_relationship_kwargs={"lazy": "raise"}
    )
