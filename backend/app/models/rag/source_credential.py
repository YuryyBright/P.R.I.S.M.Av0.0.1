import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Text, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import RagBaseModel, fk_column

if TYPE_CHECKING:
    from app.models.rag.source import Source


class SourceCredential(RagBaseModel, table=True):
    """Секрети джерела (таблиця `source_credentials`).

    `encrypted_value` — ВЖЕ зашифроване значення (напр. Fernet-токен);
    шифрування/дешифрування робить application-шар, ніколи не модель.
    """

    __tablename__ = "source_credentials"
    __table_args__ = (
        UniqueConstraint("source_id", "credential_type", name="uq_source_credentials_type"),
    )

    source_id: uuid.UUID = Field(sa_column=fk_column("sources.id", ondelete="CASCADE"))
    credential_type: str = Field(max_length=64)  # api_key, bot_token, session, ...
    encrypted_value: str = Field(sa_type=Text, repr=False)
    key_version: str = Field(
        default="v1", max_length=32, sa_column_kwargs={"server_default": "v1"}
    )

    source: Optional["Source"] = Relationship(back_populates="credentials")
