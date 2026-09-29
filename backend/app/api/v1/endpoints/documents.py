import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.api.deps import (
    PERM_DOCUMENTS_READ, PERM_DOCUMENTS_WRITE, get_current_user, get_document_service,
)
from app.models.users.user_model import User
from app.rag.domain.enums import DocumentStatus
from app.rag.schemas import DocumentRead, Page, UploadResponse
from app.rag.services.documents import DocumentService

router = APIRouter(tags=["rag: documents"])


@router.post("/collections/{collection_id}/documents", response_model=UploadResponse,
             status_code=202)
async def upload_document(
    collection_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user([PERM_DOCUMENTS_WRITE])),
    svc: DocumentService = Depends(get_document_service),
):
    """Приймає файл і ставить ingestion у чергу. 202: обробка асинхронна — стежте за /jobs/{job_id}."""
    return await svc.upload(user, collection_id, file)


@router.get("/collections/{collection_id}/documents", response_model=Page[DocumentRead])
async def list_documents(
    collection_id: uuid.UUID,
    status: DocumentStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user([PERM_DOCUMENTS_READ])),
    svc: DocumentService = Depends(get_document_service),
):
    rows, total = await svc.list(user, collection_id, limit=limit, offset=offset, status=status)
    return Page(items=[DocumentRead.model_validate(d) for d in rows],
                total=total, limit=limit, offset=offset)


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user([PERM_DOCUMENTS_READ])),
    svc: DocumentService = Depends(get_document_service),
):
    return await svc.get(user, document_id)