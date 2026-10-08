"""AccessScope = ACL(VIEWER) ∩ запитані колекції ∩ активні й не видалені."""
from __future__ import annotations

import uuid
from typing import Any, Sequence, cast

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.rag.domain.access import collections_with_role_where
from app.rag.domain.enums import CollectionRole

from .types import AccessScope, CollectionBrief

_collection = cast(Any, Collection)


async def resolve_scope(db: AsyncSession, user: Any,
                        requested: Sequence[uuid.UUID] | None) -> AccessScope:
    stmt = select(_collection.id).where(
        collections_with_role_where(user, CollectionRole.VIEWER),
        _collection.deleted_at.is_(None),
    )
    if requested is not None:
        if not requested:
            return AccessScope([], [], [])
        stmt = stmt.where(_collection.id.in_(list(requested)))
    allowed = list((await db.exec(stmt)).all())
    denied: list[uuid.UUID] = []
    if requested is not None:
        allowed_set = set(allowed)
        denied = [c for c in requested if c not in allowed_set]
    return AccessScope(allowed, list(requested) if requested is not None else None, denied)


async def list_accessible(db: AsyncSession, user: Any) -> list[CollectionBrief]:
    rows = (await db.exec(
        select(_collection.id, _collection.name, _collection.description).where(
            collections_with_role_where(user, CollectionRole.VIEWER),
            _collection.deleted_at.is_(None),
        ).order_by(_collection.name)
    )).all()
    return [CollectionBrief(r[0], r[1], r[2]) for r in rows]
