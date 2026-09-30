"""Доступ до БД для Collection / CollectionMember. Без бізнес-логіки і без commit:
транзакцією керує сервіс (flush тут — лише щоб отримати IntegrityError раніше)."""
import uuid
from datetime import datetime

from sqlalchemy import ColumnElement, delete
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

    async def flush(self) -> None:
        await self.db.flush()          # щоб отримати IntegrityError при update

    async def list_visible(self, where: ColumnElement[bool], *, limit: int, offset: int
                           ) -> list[Collection]:
        rows = await self.db.exec(
            select(Collection).where(where)
            .order_by(Collection.created_at.desc()).limit(limit).offset(offset))
        return list(rows.all())

    async def count_visible(self, where: ColumnElement[bool]) -> int:
        return (await self.db.exec(
            select(func.count()).select_from(Collection).where(where))).one()

    # ---- members -----------------------------------------------------------

    async def get_member(self, collection_id: uuid.UUID, user_id: uuid.UUID
                         ) -> CollectionMember | None:
        return (await self.db.exec(select(CollectionMember).where(
            CollectionMember.collection_id == collection_id,
            CollectionMember.user_id == user_id))).first()

    def add_member(self, member: CollectionMember) -> None:
        self.db.add(member)

    async def remove_member(self, collection_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        res = await self.db.exec(delete(CollectionMember).where(
            CollectionMember.collection_id == collection_id,
            CollectionMember.user_id == user_id))
        return (getattr(res, "rowcount", 0) or 0) > 0

    async def user_exists(self, user_id: uuid.UUID) -> bool:
        return await self.db.get(User, user_id) is not None

    # ---- видалення ---------------------------------------------------------

    async def list_deleted(self, *, older_than: datetime, limit: int) -> list[uuid.UUID]:
        """Колекції, позначені видаленими, але ще не очищені фізично."""
        rows = await self.db.exec(
            select(Collection.id)
            .where(Collection.deleted_at.is_not(None), Collection.deleted_at <= older_than)
            .limit(limit))
        return list(rows.all())

    async def hard_delete(self, collection_id: uuid.UUID) -> None:
        """Фізичне видалення. Документи мають бути видалені раніше (FK RESTRICT)."""
        await self.db.exec(delete(CollectionMember).where(
            CollectionMember.collection_id == collection_id))
        await self.db.exec(delete(Collection).where(Collection.id == collection_id))