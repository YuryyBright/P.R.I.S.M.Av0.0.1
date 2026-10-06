"""Роути job-ів ingestion: статус, скасування, повтор."""
import uuid

from fastapi import APIRouter, Depends, Query
from fastapi import status as http

from app.models.users.user_model import User
from app.api.deps import (
    PERM_DOCUMENTS_READ, PERM_DOCUMENTS_WRITE,
    get_current_user, get_document_service, get_job_service,
)
from app.rag.schemas import JobRead, UploadResponse
from app.rag.services.documents import DocumentService, JobService
from app.rag.domain.enums import JobStatus
from app.rag.schemas import JobListItem, JobRead, Page, UploadResponse


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

@router.get("", response_model=Page[JobListItem])
async def list_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: JobStatus | None = None,
    document_id: uuid.UUID | None = None,
    user: User = Depends(_doc_read),
    svc: JobService = Depends(get_job_service),
):
    items, total = await svc.list_page(
        user, limit=limit, offset=offset, status=status, document_id=document_id)
    return Page(items=items, total=total, limit=limit, offset=offset)