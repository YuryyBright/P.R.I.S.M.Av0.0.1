"""Спільні базові класи та helper-и для RAG-моделей.

ПЕРЕВІРИТИ ПРИ ІНТЕГРАЦІЇ З fastapi_rbac:
  * USER_TABLE — реальна назва таблиці користувача (User.__tablename__).
  * Якщо в проєкті вже є BaseUUIDModel (id/created_at/updated_at) —
    RagBaseModel можна замінити на нього, форма полів та сама.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Type

from sqlalchemy import Column, DateTime, ForeignKey, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlmodel import Field, SQLModel

# ---- ЄДИНЕ місце, яке залежить від існуючої RBAC-моделі User ----------------
USER_TABLE = "user"
USER_ID_FK = f"{USER_TABLE}.id"
# ------------------------------------------------------------------------------


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RagImmutableModel(SQLModel):
    """id + created_at. Для append-only записів (логи, запити, цитати)."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now()},
    )


class RagBaseModel(RagImmutableModel):
    """id + created_at + updated_at."""

    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now(), "onupdate": utcnow},
    )


# ---- column factories (кожен виклик повертає НОВИЙ Column) -------------------

def fk_column(
    target: str,
    *,
    ondelete: str,
    nullable: bool = False,
    index: bool = True,
) -> Column:
    return Column(
        PG_UUID(as_uuid=True),
        ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
        index=index,
    )


def enum_column(
    enum_cls: Type[Enum],
    *,
    default: Enum | None = None,
    nullable: bool = False,
    index: bool = False,
) -> Column:
    """Enum → VARCHAR(32) (без native ENUM у Postgres)."""
    return Column(
        SAEnum(
            enum_cls,
            name=enum_cls.__name__.lower(),
            native_enum=False,
            length=32,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=nullable,
        index=index,
        server_default=default.value if default is not None else None,
    )


def jsonb_column(name: str, *, empty: str = "{}") -> Column:
    """NOT NULL JSONB із server_default ('{}' або '[]')."""
    return Column(
        name,
        JSONB,
        nullable=False,
        server_default=text(f"'{empty}'::jsonb"),
    )


def meta_field() -> Any:
    """Поле `meta` → колонка `metadata`.

    Атрибут `metadata` зарезервований у SQLAlchemy declarative, тому в Python
    поле називається `meta`, а в БД колонка — `metadata`.
    """
    return Field(default_factory=dict, sa_column=jsonb_column("metadata"))
