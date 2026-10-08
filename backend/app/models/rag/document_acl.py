import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import USER_ID_FK, RagBaseModel, fk_column

if TYPE_CHECKING:
    from app.models.rag.document import Document
    from app.models.users.user_model import User


class DocumentACL(RagBaseModel, table=True):
    """Точковий доступ користувача до документа (таблиця `document_acl`).

    Додається до доступу через колекції; НЕ замінює RBAC.
    """

    __tablename__ = "document_acl"  # type: ignore[assignment]
    __table_args__ = (
        UniqueConstraint("document_id", "user_id", name="uq_document_acl_pair"),
    )

    document_id: uuid.UUID = Field(sa_column=fk_column("documents.id", ondelete="CASCADE"))
    user_id: uuid.UUID = Field(sa_column=fk_column(USER_ID_FK, ondelete="CASCADE"))

    can_read: bool = Field(default=True, sa_column_kwargs={"server_default": text("true")})
    can_update: bool = Field(default=False, sa_column_kwargs={"server_default": text("false")})
    can_delete: bool = Field(default=False, sa_column_kwargs={"server_default": text("false")})
    can_share: bool = Field(default=False, sa_column_kwargs={"server_default": text("false")})

    granted_by_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(USER_ID_FK, ondelete="SET NULL", nullable=True),
    )

    document: Optional["Document"] = Relationship(back_populates="acl_entries")
    # дві FK на User → явно вказуємо, яка з них для цього relationship
    user: Optional["User"] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[DocumentACL.user_id]", "lazy": "selectin",
        }
    )
