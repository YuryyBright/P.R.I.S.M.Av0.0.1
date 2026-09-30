"""Роути колекцій, учасників і завантаження/списку документів колекції."""
import uuid

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi import status as http

from app.models.users.user_model import User
from app.api.deps import (
    PERM_COLLECTIONS_CREATE, PERM_COLLECTIONS_MANAGE, PERM_COLLECTIONS_READ,
    PERM_DOCUMENTS_READ, PERM_DOCUMENTS_WRITE,
    get_collection_service, get_current_user, get_document_service,
)
from app.rag.domain.enums import CollectionRole, DocumentStatus
from app.rag.schemas import (
    CollectionCreate, CollectionRead, CollectionUpdate, DocumentRead, MemberAdd,
    MemberRead, Page, UploadResponse,
)
from app.rag.services.collections import CollectionService
from app.rag.services.documents import DocumentService

router = APIRouter(prefix="/collections", tags=["rag: collections"])

_col_read = get_current_user([PERM_COLLECTIONS_READ])
_col_create = get_current_user([PERM_COLLECTIONS_CREATE])
_col_manage = get_current_user([PERM_COLLECTIONS_MANAGE])
_doc_read = get_current_user([PERM_DOCUMENTS_READ])
_doc_write = get_current_user([PERM_DOCUMENTS_WRITE])


# ---- collections -------------------------------------------------------------

@router.post("", response_model=CollectionRead, status_code=http.HTTP_201_CREATED)
async def create_collection(data: CollectionCreate, user: User = Depends(_col_create),
                            svc: CollectionService = Depends(get_collection_service)):
    col = await svc.create(user, data)
    return CollectionRead.from_collection(col, CollectionRole.OWNER)


@router.get("", response_model=Page[CollectionRead])
async def list_collections(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                           user: User = Depends(_col_read),
                           svc: CollectionService = Depends(get_collection_service)):
    rows, total = await svc.list(user, limit=limit, offset=offset)
    return Page[CollectionRead](
        items=[CollectionRead.from_collection(c, r) for c, r in rows],
        total=total, limit=limit, offset=offset)


@router.get("/{collection_id}", response_model=CollectionRead)
async def get_collection(collection_id: uuid.UUID, user: User = Depends(_col_read),
                         svc: CollectionService = Depends(get_collection_service)):
    col, role = await svc.get(user, collection_id)
    return CollectionRead.from_collection(col, role)


@router.patch("/{collection_id}", response_model=CollectionRead)
async def update_collection(collection_id: uuid.UUID, data: CollectionUpdate,
                            user: User = Depends(_col_manage),
                            svc: CollectionService = Depends(get_collection_service)):
    col, role = await svc.update(user, collection_id, data)
    return CollectionRead.from_collection(col, role)


@router.delete("/{collection_id}", status_code=http.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_collection(collection_id: uuid.UUID, user: User = Depends(_col_manage),
                            svc: CollectionService = Depends(get_collection_service)):
    """Логічно видаляє одразу; фізичне очищення (документи, вектори) робить Celery."""
    await svc.delete(user, collection_id)
    return Response(status_code=http.HTTP_204_NO_CONTENT)


# ---- members -----------------------------------------------------------------

@router.get("/{collection_id}/members", response_model=list[MemberRead])
async def list_members(collection_id: uuid.UUID, user: User = Depends(_col_manage),
                       svc: CollectionService = Depends(get_collection_service)):
    return await svc.list_members(user, collection_id)


@router.post("/{collection_id}/members", response_model=MemberRead)
async def add_or_update_member(collection_id: uuid.UUID, data: MemberAdd,
                               user: User = Depends(_col_manage),
                               svc: CollectionService = Depends(get_collection_service)):
    """Додати учасника або змінити його роль (upsert)."""
    role = await svc.add_member(user, collection_id, data.user_id, data.role)
    return MemberRead(user_id=data.user_id, role=role)


@router.delete("/{collection_id}/members/{user_id}", status_code=http.HTTP_204_NO_CONTENT,
               response_class=Response)
async def remove_member(collection_id: uuid.UUID, user_id: uuid.UUID,
                        user: User = Depends(_col_manage),
                        svc: CollectionService = Depends(get_collection_service)):
    await svc.remove_member(user, collection_id, user_id)
    return Response(status_code=http.HTTP_204_NO_CONTENT)


# ---- documents у колекції ----------------------------------------------------

@router.post("/{collection_id}/documents", response_model=UploadResponse,
             status_code=http.HTTP_202_ACCEPTED)
async def upload_document(collection_id: uuid.UUID, file: UploadFile = File(...),
                          user: User = Depends(_doc_write),
                          svc: DocumentService = Depends(get_document_service)):
    """Приймає файл і ставить ingestion у чергу; стан — через GET /jobs/{job_id}."""
    return await svc.upload(user, collection_id, file)


@router.get("/{collection_id}/documents", response_model=Page[DocumentRead])
async def list_documents(collection_id: uuid.UUID, limit: int = Query(20, ge=1, le=100),
                         offset: int = Query(0, ge=0),
                         status: DocumentStatus | None = Query(None),
                         user: User = Depends(_doc_read),
                         svc: DocumentService = Depends(get_document_service)):
    items, total = await svc.list(user, collection_id, limit=limit, offset=offset, status=status)
    return Page[DocumentRead](items=items, total=total, limit=limit, offset=offset)