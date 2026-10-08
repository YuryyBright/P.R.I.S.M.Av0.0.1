from __future__ import annotations

import uuid
from datetime import datetime
from datetime import timezone
from typing import Any, cast

from sqlalchemy import ColumnElement, delete, update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.models.rag.collection_member import CollectionMember
from app.models.users.user_model import User
from app.rag.domain.enums import CollectionRole, CollectionVisibility

_collection = cast(Any, Collection)
_member = cast(Any, CollectionMember)
_user = cast(Any, User)
class CollectionRepository:
    """
    Database access for Collection and CollectionMember.

    Responsibilities:
    - SELECT;
    - INSERT;
    - UPDATE through ORM entities;
    - DELETE;
    - existence checks.

    No business rules.
    No authorization.
    No commit / rollback.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        # ---------------- Collection ----------------

    async def create(
        self,
        *,
        owner_id: uuid.UUID,
        name: str,
        description: str | None,
        visibility: CollectionVisibility,
    ) -> Collection:
        collection = Collection(
            name=name,
            description=description,
            owner_id=owner_id,
            visibility=visibility,
        )
        self.db.add(collection)
        await self.db.flush()  # INSERT + перевірка constraint'ів
        return collection

    async def update(
        self,
        collection: Collection,
        changes: dict[str, Any],
    ) -> Collection:
        for field, value in changes.items():
            setattr(collection, field, value)
        self.db.add(collection)
        await self.db.flush()  # UPDATE + перевірка constraint'ів
        return collection

    async def soft_delete(self, collection: Collection) -> None:
        collection.is_active = False
        collection.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.db.add(collection)
        await self.db.flush()

    async def restore(self, collection: Collection) -> None:
        """Archive -> active. Документи не чіпаємо: до purge вони лишаються ACTIVE."""
        collection.is_active = True
        collection.deleted_at = None
        self.db.add(collection)
        await self.db.flush()

    async def request_purge(self, collection: Collection) -> None:
        collection.purge_requested_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.db.add(collection)
        await self.db.flush()

    async def refresh(self, entity: Collection) -> None:
        await self.db.refresh(entity)

    # ---------------- Members ----------------

    async def upsert_member(
        self,
        collection_id: uuid.UUID,
        user_id: uuid.UUID,
        role: CollectionRole,
    ) -> CollectionMember:
        member = await self.get_member(collection_id, user_id)
        if member is None:
            member = CollectionMember(
                collection_id=collection_id,
                user_id=user_id,
                role=role,
            )
        else:
            member.role = role
        self.db.add(member)
        await self.db.flush()
        return member
    # ------------------------------------------------------------------
    # Collection
    # ------------------------------------------------------------------

    async def get(
        self,
        collection_id: uuid.UUID,
    ) -> Collection | None:
        return await self.db.get(
            Collection,
            collection_id,
        )

    async def add(
        self,
        collection: Collection,
    ) -> Collection:
        self.db.add(collection)

        # Force INSERT and constraint validation.
        await self.db.flush()

        return collection

    async def flush(self) -> None:
        await self.db.flush()

    async def list_visible(
        self,
        where: ColumnElement[bool],
        *,
        limit: int,
        offset: int,
    ) -> list[Collection]:
        result = await self.db.exec(
            select(Collection)
            .where(where)
            .order_by(_collection.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return list(result.all())

    async def count_visible(
        self,
        where: ColumnElement[bool],
    ) -> int:
        result = await self.db.exec(
            select(func.count())
            .select_from(Collection)
            .where(where)
        )

        return result.one()

    # ------------------------------------------------------------------
    # Members
    # ------------------------------------------------------------------

    async def get_member(
        self,
        collection_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> CollectionMember | None:
        result = await self.db.exec(
            select(CollectionMember).where(
                _member.collection_id == collection_id,
                _member.user_id == user_id,
            )
        )

        return result.first()

    def add_member(
        self,
        member: CollectionMember,
    ) -> None:
        self.db.add(member)

    async def remove_member(
        self,
        collection_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        result = await self.db.exec(
            delete(CollectionMember).where(
                _member.collection_id == collection_id,
                _member.user_id == user_id,
            )
        )

        return bool(
            getattr(result, "rowcount", 0)
        )

    async def list_members(
        self,
        collection_id: uuid.UUID,
    ) -> list[CollectionMember]:
        result = await self.db.exec(
            select(CollectionMember).where(
                _member.collection_id == collection_id
            )
        )

        return list(result.all())

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    async def user_exists(
        self,
        user_id: uuid.UUID,
    ) -> bool:
        return (
            await self.db.get(User, user_id)
        ) is not None

    # ------------------------------------------------------------------
    # Cleanup / physical deletion
    # ------------------------------------------------------------------

    async def list_archived(
        self,
        where: ColumnElement[bool],
        *,
        limit: int,
        offset: int,
    ) -> list[Collection]:
        result = await self.db.exec(
            select(Collection)
            .where(where)
            .order_by(_collection.deleted_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return list(result.all())

    async def count_archived(
        self,
        where: ColumnElement[bool],
    ) -> int:
        result = await self.db.exec(
            select(func.count())
            .select_from(Collection)
            .where(where)
        )

        return result.one()

    async def mark_expired_for_purge(
        self,
        *,
        archived_before: datetime,
    ) -> int:
        """Архів старший за retention -> purge_requested_at = now (далі purge як зазвичай)."""
        result = await self.db.exec(
            update(Collection)
            .where(
                _collection.deleted_at.is_not(None),
                _collection.deleted_at <= archived_before,
                _collection.purge_requested_at.is_(None),
            )
            .values(
                purge_requested_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
        )

        return int(getattr(result, "rowcount", 0) or 0)

    async def list_deleted(
        self,
        *,
        older_than: datetime,
        limit: int,
    ) -> list[uuid.UUID]:
        """Колекції, для яких запрошено purge (явно або після retention), але не завершено."""
        result = await self.db.exec(
            select(_collection.id)
            .where(
                _collection.deleted_at.is_not(None),
                _collection.purge_requested_at.is_not(None),
                _collection.purge_requested_at <= older_than,
            )
            .limit(limit)
        )

        return list(result.all())

    async def hard_delete(
        self,
        collection_id: uuid.UUID,
    ) -> None:
        await self.db.exec(
            delete(CollectionMember).where(
                _member.collection_id == collection_id
            )
        )

        await self.db.exec(
            delete(Collection).where(
                _collection.id == collection_id
            )
        )
