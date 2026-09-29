import uuid

from fastapi import APIRouter, Depends

from app.api.deps import PERM_DOCUMENTS_READ, get_current_user, get_job_service
from app.models.users.user_model import User
from app.rag.schemas import JobRead
from app.rag.services.documents import JobService

router = APIRouter(prefix="/jobs", tags=["rag: jobs"])


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user([PERM_DOCUMENTS_READ])),
    svc: JobService = Depends(get_job_service),
):
    return await svc.get(user, job_id)