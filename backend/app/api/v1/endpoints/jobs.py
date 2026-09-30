"""Роути job-ів ingestion: статус, скасування, повтор."""
import uuid

from fastapi import APIRouter, Depends
from fastapi import status as http

from app.models.users.user_model import User
from app.api.deps import (
    PERM_DOCUMENTS_READ, PERM_DOCUMENTS_WRITE,
    get_current_user, get_document_service, get_job_service,
)
from app.rag.schemas import JobRead, UploadResponse
from app.rag.services.documents import DocumentService, JobService

router = APIRouter(prefix="/jobs", tags=["rag: jobs"])

_doc_read = get_current_user([PERM_DOCUMENTS_READ])
_doc_write = get_current_user([PERM_DOCUMENTS_WRITE])


@router.get("/{job_id}", response_model=JobRead)
async def get_job(job_id: uuid.UUID, user: User = Depends(_doc_read),
                  svc: JobService = Depends(get_job_service)):
    return await svc.get(user, job_id)


@router.post("/{job_id}/cancel", response_model=JobRead)
async def cancel_job(job_id: uuid.UUID, user: User = Depends(_doc_write),
                     svc: JobService = Depends(get_job_service)):
    return await svc.cancel(user, job_id)


@router.post("/{job_id}/retry", response_model=UploadResponse, status_code=http.HTTP_202_ACCEPTED)
async def retry_job(job_id: uuid.UUID, user: User = Depends(_doc_write),
                    jobs: JobService = Depends(get_job_service),
                    docs: DocumentService = Depends(get_document_service)):
    """Повтор FAILED/CANCELLED job-а = новий reindex-job для того ж документа."""
    document_id = await jobs.ensure_retryable(user, job_id)
    return await docs.reindex(user, document_id)