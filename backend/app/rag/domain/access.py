from enum import Enum
from typing import Any
import uuid

from sqlalchemy import ColumnElement, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.models.rag.collection_member import CollectionMember
from app.rag.domain.enums import CollectionRole, CollectionVisibility
from app.rag.domain.exceptions import ForbiddenError, NotFoundError


class Action(str, Enum):
    READ = "read"
    WRITE = "write"
    MANAGE = "manage"


ROLE_RANK: dict[CollectionRole, int] = {
    CollectionRole.VIEWER: 1,
    CollectionRole.EDITOR: 2,
    CollectionRole.OWNER: 3,
}

MIN_ROLE: dict[Action, CollectionRole] = {
    Action.READ: CollectionRole.VIEWER,
    Action.WRITE: CollectionRole.EDITOR,
    Action.MANAGE: CollectionRole.OWNER,
}


def role_at_least(
    role: CollectionRole | None,
    minimum: CollectionRole,
) -> bool:
    return role is not None and ROLE_RANK[role] >= ROLE_RANK[minimum]


def role_allows(
    role: CollectionRole | None,
    action: Action,
) -> bool:
    return role_at_least(role, MIN_ROLE[action])


def roles_at_least(
    minimum: CollectionRole,
) -> list[CollectionRole]:
    return [
        role
        for role in CollectionRole
        if ROLE_RANK[role] >= ROLE_RANK[minimum]
    ]


def effective_role(
    user: Any,
    collection: Any,
) -> CollectionRole | None:
    if getattr(user, "is_superuser", False):
        return CollectionRole.OWNER

    if not collection.is_active:
        return None

    if collection.owner_id == user.id:
        return CollectionRole.OWNER

    best: CollectionRole | None = None

    for member in collection.members:
        if member.user_id != user.id:
            continue

        if (
            best is None
            or ROLE_RANK[member.role] > ROLE_RANK[best]
        ):
            best = member.role

    if best is None and collection.visibility == CollectionVisibility.PUBLIC:
        best = CollectionRole.VIEWER

    return best

class AccessPolicy:
    """Єдина точка перевірки доступу до RAG-колекцій."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_role(self, user: Any, collection_id: uuid.UUID) -> CollectionRole | None:
        collection = await self.db.get(Collection, collection_id)
        if collection is None:
            return None
        return effective_role(user, collection)

    async def can(self, user: Any, collection_id: uuid.UUID, action: Action) -> bool:
        return role_allows(await self.get_role(user, collection_id), action)

    async def require(self, user: Any, collection_id: uuid.UUID, action: Action) -> Collection:
        collection = await self.db.get(Collection, collection_id)
        if collection is None or not getattr(collection, "is_active", False):
            raise NotFoundError("Collection not found")
        role = effective_role(user, collection)
        if not role_allows(role, action):
            raise ForbiddenError("Insufficient permissions")
        return collection

    def role_of(self, user: Any, collection: Any) -> CollectionRole | None:
        return effective_role(user, collection)


def visible_where(user: Any) -> ColumnElement[bool]:
    """SQL-фільтр колекцій, видимих користувачу."""
    if getattr(user, "is_superuser", False):
        return Collection.is_active.is_(True)

    member_subquery = select(CollectionMember.collection_id).where(
        CollectionMember.user_id == user.id
    )
    return Collection.is_active.is_(True) & or_(
        Collection.owner_id == user.id,
        Collection.visibility == CollectionVisibility.PUBLIC,
        Collection.id.in_(member_subquery),
    )

def collections_with_role_where(user: Any, minimum: CollectionRole) -> ColumnElement[bool]:
    """SQL-фільтр колекцій, де користувач має роль НЕ нижче `minimum`.

    SQL-дзеркало effective_role(): owner → member з достатньою роллю →
    (PUBLIC дає лише VIEWER, тож враховується тільки коли minimum == VIEWER).
    Неактивні колекції не враховуються. Superuser — усі активні.
    """
    if getattr(user, "is_superuser", False):
        return Collection.is_active.is_(True)

    member_subquery = select(CollectionMember.collection_id).where(
        CollectionMember.user_id == user.id,
        CollectionMember.role.in_(roles_at_least(minimum)),
    )
    conditions = [Collection.owner_id == user.id, Collection.id.in_(member_subquery)]
    if role_at_least(CollectionRole.VIEWER, minimum):   # minimum == VIEWER
        conditions.append(Collection.visibility == CollectionVisibility.PUBLIC)
    return Collection.is_active.is_(True) & or_(*conditions)
