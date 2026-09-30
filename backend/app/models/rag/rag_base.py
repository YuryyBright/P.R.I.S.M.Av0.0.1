"""Спільні базові класи та helper-и для RAG-моделей.

RAG-моделі використовують існуючий BaseUUIDModel проєкту, щоб:
- не дублювати id / created_at / updated_at;
- використовувати той самий UUID7;
- мати однакову структуру базових полів у всій системі;
- коректно працювати з існуючою RBAC-моделлю User.

ВАЖЛИВО:
User.__tablename__ = "User", тому ForeignKey повинен посилатися саме
на '"User".id', а не на 'user.id'.
"""

from enum import Enum
from typing import Any, Type

from sqlalchemy import Column, ForeignKey, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlmodel import Field

from app.models.base_uuid_model import BaseUUIDModel


# ---------------------------------------------------------------------------
# Existing RBAC User table
# ---------------------------------------------------------------------------

# User model:
#
# class User(BaseUUIDModel, UserBase, table=True):
#     __tablename__ = "User"
#
# PostgreSQL quoted identifier is therefore required.
USER_TABLE = "User"
USER_ID_FK = f"{USER_TABLE}.id"


# ---------------------------------------------------------------------------
# RAG base models
# ---------------------------------------------------------------------------

class RagImmutableModel(BaseUUIDModel):
    """Базова модель для append-only RAG записів.

    Наслідує:
        id
        created_at
        updated_at

    від існуючого BaseUUIDModel.

    Для записів, які фактично не повинні оновлюватися, updated_at
    все одно залишається частиною базової моделі для узгодженості
    з рештою системи.
    """

    pass


class RagBaseModel(BaseUUIDModel):
    """Базова модель для звичайних RAG-сутностей.

    Використовує існуючий BaseUUIDModel проєкту.
    """

    pass


# ---------------------------------------------------------------------------
# Column factories
# ---------------------------------------------------------------------------

def fk_column(
    target: str,
    *,
    ondelete: str,
    nullable: bool = False,
    index: bool = True,
) -> Column:
    """Створює UUID ForeignKey column.

    Приклад:

        user_id: UUID = Field(
            sa_column=fk_column(
                USER_ID_FK,
                ondelete="CASCADE",
            )
        )
    """

    return Column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            target,
            ondelete=ondelete,
        ),
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
    """Enum → VARCHAR(32), без native PostgreSQL ENUM."""

    return Column(
        SAEnum(
            enum_cls,
            name=enum_cls.__name__.lower(),
            native_enum=False,
            length=32,
            validate_strings=True,
            values_callable=lambda enum: [
                member.value
                for member in enum
            ],
        ),
        nullable=nullable,
        index=index,
        server_default=(
            default.value
            if default is not None
            else None
        ),
    )


def jsonb_column(
    name: str,
    *,
    empty: str = "{}",
) -> Column:
    """NOT NULL JSONB із server_default."""

    return Column(
        name,
        JSONB,
        nullable=False,
        server_default=text(
            f"'{empty}'::jsonb"
        ),
    )


def meta_field() -> Any:
    """Python-поле `meta` → PostgreSQL-колонка `metadata`.

    `metadata` зарезервований SQLAlchemy як атрибут declarative-моделей,
    тому Python attribute називається `meta`.
    """

    return Field(
        default_factory=dict,
        sa_column=jsonb_column("metadata"),
    )