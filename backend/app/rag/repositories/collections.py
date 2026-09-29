"""Доступ до БД для Collection / CollectionMember. Без бізнес-логіки і без commit:
транзакцією керує сервіс (flush тут — лише щоб отримати IntegrityError раніше)."""
import uuid

from sqlalchemy import ColumnElement
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.models.rag.collection_member import CollectionMember
from app.models.users.user_model import User


class CollectionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, collection_id: uuid.UUID) -> Collection | None:
        return await self.db.get(Collection, collection_id)   # members — selectin

    async def add(self, col: Collection) -> Collection:
        self.db.add(col)
        await self.db.flush()          # uq_collections_owner_name спрацює тут
        return col

    async def list_visible(self, where: ColumnElement[bool], *, limit: int, offset: int
                           ) -> list[Collection]:
        rows = await self.db.exec(
            select(Collection).where(where)
            .order_by(Collection.created_at.desc()).limit(limit).offset(offset))
        return list(rows.all())

    async def count_visible(self, where: ColumnElement[bool]) -> int:
        return (await self.db.exec(
            select(func.count()).select_from(Collection).where(where))).one()

    async def get_member(self, collection_id: uuid.UUID, user_id: uuid.UUID
                         ) -> CollectionMember | None:
        return (await self.db.exec(select(CollectionMember).where(
            CollectionMember.collection_id == collection_id,
            CollectionMember.user_id == user_id))).first()

    def add_member(self, member: CollectionMember) -> None:
        self.db.add(member)

    async def user_exists(self, user_id: uuid.UUID) -> bool:
        return await self.db.get(User, user_id) is not None
