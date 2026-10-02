"""Роути окремого документа: читання, деталі, перейменування, видалення, reindex, історія job-ів."""
import uuid

from fastapi import APIRouter, Depends, Query, Response
from fastapi import status as http

from app.models.users.user_model import User
from app.api.deps import (
    PERM_DOCUMENTS_READ, PERM_DOCUMENTS_WRITE,
    get_current_user, get_document_service, get_job_service,
)
from app.rag.schemas import (
    DocumentDetailRead, DocumentRead, DocumentUpdate, JobRead, UploadResponse,
)
from app.rag.services.documents import DocumentService, JobService

router = APIRouter(prefix="/documents", tags=["rag: documents"])

_doc_read = get_current_user([PERM_DOCUMENTS_READ])
_doc_write = get_current_user([PERM_DOCUMENTS_WRITE])


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(document_id: uuid.UUID, user: User = Depends(_doc_read),
                       svc: DocumentService = Depends(get_document_service)):
    return await svc.get(user, document_id)


@router.get("/{document_id}/details", response_model=DocumentDetailRead)
async def get_document_details(document_id: uuid.UUID, user: User = Depends(_doc_read),
                               svc: DocumentService = Depends(get_document_service)):
    """Повна картка: метадані з БД, статистика чанків, останні job-и."""
    return await svc.get_details(user, document_id)


@router.patch("/{document_id}", response_model=DocumentRead)
async def rename_document(document_id: uuid.UUID, data: DocumentUpdate,
                          user: User = Depends(_doc_write),
                          svc: DocumentService = Depends(get_document_service)):
    return await svc.rename(user, document_id, data)


@router.delete("/{document_id}", status_code=http.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_document(document_id: uuid.UUID, user: User = Depends(_doc_write),
                          svc: DocumentService = Depends(get_document_service)):
    """Логічно видаляє одразу; вектори/чанки/файли прибирає Celery."""
    await svc.delete(user, document_id)
    return Response(status_code=http.HTTP_204_NO_CONTENT)


@router.post("/{document_id}/reindex", response_model=UploadResponse,
             status_code=http.HTTP_202_ACCEPTED)
async def reindex_document(document_id: uuid.UUID, user: User = Depends(_doc_write),
                           svc: DocumentService = Depends(get_document_service)):
    return await svc.reindex(user, document_id)


@router.get("/{document_id}/jobs", response_model=list[JobRead])
async def list_document_jobs(document_id: uuid.UUID, limit: int = Query(20, ge=1, le=100),
                             user: User = Depends(_doc_read),
                             svc: JobService = Depends(get_job_service)):
    return await svc.list_for_document(user, document_id, limit=limit)