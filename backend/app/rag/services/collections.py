from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator, List

from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.models.rag.collection_member import CollectionMember
from app.models.users.user_model import User

from app.rag.domain.access import AccessPolicy, Action, archived_where, visible_where
from app.rag.domain.enums import CollectionRole
from app.rag.domain.exceptions import (
    ConflictError,
    InvalidInputError,
    NotFoundError,
)
from app.rag.repositories import CollectionRepository
from app.rag.schemas import CollectionCreate, CollectionUpdate


class CollectionService:
    """
    Business logic for collections.

    Responsibilities: authorization, business rules,
    transaction boundaries, mapping domain errors.
    All DB reads/writes go through CollectionRepository.
    """

    def __init__(
        self,
        db: AsyncSession,
        policy: AccessPolicy,
        *,
        repo: CollectionRepository | None = None,
    ) -> None:
        self.db = db  # тільки для commit/rollback
        self.policy = policy
        self.repo = repo or CollectionRepository(db)

    @asynccontextmanager
    async def _transaction(self, conflict_message: str) -> AsyncIterator[None]:
        try:
            yield
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictError(conflict_message)

    # ---------------- Collections ----------------

    async def create(self, user: User, data: CollectionCreate) -> Collection:
        async with self._transaction("You already have a collection with this name"):
            collection = await self.repo.create(
                owner_id=user.id,
                name=data.name,
                description=data.description,
                visibility=data.visibility,
            )

        await self.repo.refresh(collection)
        return collection

    async def get(
        self, user: User, collection_id: uuid.UUID
    ) -> tuple[Collection, CollectionRole | None]:
        collection = await self.policy.require(user, collection_id, Action.READ)
        return collection, self.policy.role_of(user, collection)

    async def list(
        self, user: User, *, limit: int, offset: int
    ) -> tuple[list[tuple[Collection, CollectionRole | None]], int]:
        where = visible_where(user)
        total = await self.repo.count_visible(where)
        collections = await self.repo.list_visible(where, limit=limit, offset=offset)
        return (
            [(c, self.policy.role_of(user, c)) for c in collections],
            total,
        )

    async def update(
        self,
        user: User,
        collection_id: uuid.UUID,
        data: CollectionUpdate,
    ) -> tuple[Collection, CollectionRole | None]:
        collection = await self.policy.require(user, collection_id, Action.MANAGE)
        changes = data.model_dump(exclude_unset=True)

        async with self._transaction("You already have a collection with this name"):
            await self.repo.update(collection, changes)

        await self.repo.refresh(collection)
        return collection, self.policy.role_of(user, collection)

    async def delete(self, user: User, collection_id: uuid.UUID) -> None:
        collection = await self.policy.require(user, collection_id, Action.MANAGE)

        async with self._transaction("Unable to delete collection"):
            await self.repo.soft_delete(collection)

    # ---------------- Archive ----------------

    async def list_archived(
        self, user: User, *, limit: int, offset: int
    ) -> tuple[List[tuple[Collection, CollectionRole]], int]:
        """Архів користувача. Роль у відповіді — owner (керувати архівом може лише власник)."""
        where = archived_where(user)
        total = await self.repo.count_archived(where)
        collections = await self.repo.list_archived(where, limit=limit, offset=offset)
        return [(c, CollectionRole.OWNER) for c in collections], total

    async def restore(
        self, user: User, collection_id: uuid.UUID
    ) -> tuple[Collection, CollectionRole | None]:
        collection = await self.policy.require_archived(user, collection_id)

        async with self._transaction("Unable to restore collection"):
            await self.repo.restore(collection)

        await self.repo.refresh(collection)
        return collection, self.policy.role_of(user, collection)

    async def delete_permanently(
        self, user: User, collection_id: uuid.UUID
    ) -> uuid.UUID:
        """Позначає архівну колекцію на фізичне видалення (після цього відновлення неможливе).

        Повертає id: роутер після commit ставить dispatch_purge_collection(id).
        Якщо dispatch упаде — sweep підбере колекцію за purge_requested_at.
        """
        collection = await self.policy.require_archived(user, collection_id)

        async with self._transaction("Unable to delete collection permanently"):
            await self.repo.request_purge(collection)

        return collection.id

    # ---------------- Members ----------------

    async def add_member(
        self,
        user: User,
        collection_id: uuid.UUID,
        target_user_id: uuid.UUID,
        role: CollectionRole,
    ) -> CollectionRole:
        collection = await self.policy.require(user, collection_id, Action.MANAGE)

        if role == CollectionRole.OWNER:
            raise InvalidInputError("Owner role cannot be granted via members")
        if target_user_id == collection.owner_id:
            raise ConflictError("User is already the owner of this collection")
        if not await self.repo.user_exists(target_user_id):
            raise NotFoundError("User not found")

        async with self._transaction("Unable to add collection member"):
            await self.repo.upsert_member(collection.id, target_user_id, role)

        return role

    async def remove_member(
        self,
        user: User,
        collection_id: uuid.UUID,
        target_user_id: uuid.UUID,
    ) -> None:
        collection = await self.policy.require(user, collection_id, Action.MANAGE)

        if target_user_id == collection.owner_id:
            raise ConflictError("Cannot remove the owner from members")

        async with self._transaction("Unable to remove collection member"):
            removed = await self.repo.remove_member(collection.id, target_user_id)
            if not removed:
                raise NotFoundError("Member not found")

    async def list_members(
        self, user: User, collection_id: uuid.UUID
    ) -> List[CollectionMember]:
        collection = await self.policy.require(user, collection_id, Action.MANAGE)
        return await self.repo.list_members(collection.id)

    async def get_member(
        self,
        user: User,
        collection_id: uuid.UUID,
        target_user_id: uuid.UUID,
    ) -> CollectionMember | None:
        collection = await self.policy.require(user, collection_id, Action.MANAGE)
        return await self.repo.get_member(collection.id, target_user_id)
