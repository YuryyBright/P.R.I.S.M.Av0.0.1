import uuid

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    PERM_COLLECTIONS_CREATE, PERM_COLLECTIONS_MANAGE, PERM_COLLECTIONS_READ,
    get_collection_service, get_current_user,
)
from app.models.users.user_model import User
from app.rag.domain.enums import CollectionRole
from app.rag.schemas import CollectionCreate, CollectionRead, MemberAdd, MemberRead, Page
from app.rag.services.collections import CollectionService

router = APIRouter(prefix="/collections", tags=["rag: collections"])


@router.post("", response_model=CollectionRead, status_code=201)
async def create_collection(
    body: CollectionCreate,
    user: User = Depends(get_current_user([PERM_COLLECTIONS_CREATE])),
    svc: CollectionService = Depends(get_collection_service),
):
    col = await svc.create(user, body)
    return CollectionRead.from_collection(col, CollectionRole.OWNER)


@router.get("", response_model=Page[CollectionRead])
async def list_collections(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user([PERM_COLLECTIONS_READ])),
    svc: CollectionService = Depends(get_collection_service),
):
    rows, total = await svc.list(user, limit=limit, offset=offset)
    return Page(items=[CollectionRead.from_collection(c, r) for c, r in rows],
                total=total, limit=limit, offset=offset)


@router.get("/{collection_id}", response_model=CollectionRead)
async def get_collection(
    collection_id: uuid.UUID,
    user: User = Depends(get_current_user([PERM_COLLECTIONS_READ])),
    svc: CollectionService = Depends(get_collection_service),
):
    col, role = await svc.get(user, collection_id)
    return CollectionRead.from_collection(col, role)


@router.post("/{collection_id}/members", response_model=MemberRead, status_code=201)
async def add_member(
    collection_id: uuid.UUID,
    body: MemberAdd,
    user: User = Depends(get_current_user([PERM_COLLECTIONS_MANAGE])),
    svc: CollectionService = Depends(get_collection_service),
):
    role = await svc.add_member(user, collection_id, body.user_id, body.role)
    return MemberRead(user_id=body.user_id, role=role)