"""CollectionService: створення, список, деталі, учасники.
SQL — у CollectionRepository; тут авторизація, правила й commit."""
import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.models.rag.collection_member import CollectionMember
from app.models.users.user_model import User
from app.rag.domain.access import AccessPolicy, Action, visible_where
from app.rag.domain.enums import CollectionRole
from app.rag.domain.exceptions import ConflictError, InvalidInputError, NotFoundError
from app.rag.repositories import CollectionRepository
from app.rag.schemas import CollectionCreate


class CollectionService:
    def __init__(self, db: AsyncSession, policy: AccessPolicy, *,
                 repo: CollectionRepository | None = None) -> None:
        self.db, self.policy = db, policy
        self.repo = repo or CollectionRepository(db)

    async def create(self, user: User, data: CollectionCreate) -> Collection:
        col = Collection(name=data.name, description=data.description,
                         owner_id=user.id, visibility=data.visibility)
        try:
            await self.repo.add(col)                 # flush → uq_collections_owner_name
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictError("You already have a collection with this name")
        await self.db.refresh(col)
        return col

    async def get(self, user: User, collection_id: uuid.UUID
                  ) -> tuple[Collection, CollectionRole | None]:
        col = await self.policy.require(user, collection_id, Action.READ)
        return col, self.policy.role_of(user, col)

    async def list(self, user: User, *, limit: int, offset: int
                   ) -> tuple[list[tuple[Collection, CollectionRole | None]], int]:
        where = visible_where(user)
        total = await self.repo.count_visible(where)
        rows = await self.repo.list_visible(where, limit=limit, offset=offset)
        return [(c, self.policy.role_of(user, c)) for c in rows], total

    async def add_member(self, user: User, collection_id: uuid.UUID,
                         target_user_id: uuid.UUID, role: CollectionRole) -> CollectionRole:
        col = await self.policy.require(user, collection_id, Action.MANAGE)
        if role == CollectionRole.OWNER:
            raise InvalidInputError("Owner role cannot be granted via members")
        if target_user_id == col.owner_id:
            raise ConflictError("User is already the owner of this collection")
        if not await self.repo.user_exists(target_user_id):
            raise NotFoundError("User not found")

        member = await self.repo.get_member(col.id, target_user_id)
        if member is not None:
            member.role = role
        else:
            self.repo.add_member(
                CollectionMember(collection_id=col.id, user_id=target_user_id, role=role))
        await self.db.commit()
        return role
