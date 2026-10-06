import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.ai.attachments import AttachmentService
from app.api.deps import PERM_AI_RUNS_CREATE, get_current_user, get_storage
from app.models.users.user_model import User
from app.rag.domain.ports import BlobStorage

router = APIRouter(prefix="/attachments", tags=["ai: attachments"])

_run_create = get_current_user([PERM_AI_RUNS_CREATE])


def get_attachment_service(
    storage: BlobStorage = Depends(get_storage),
) -> AttachmentService:
    return AttachmentService(storage)


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile = File(...),
    user: User = Depends(_run_create),
    svc: AttachmentService = Depends(get_attachment_service),
):
    """Upload one chat attachment and return its metadata."""
    return await svc.upload(user, file)


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: uuid.UUID,
    user: User = Depends(_run_create),
    svc: AttachmentService = Depends(get_attachment_service),
) -> None:
    """Delete one uploaded attachment owned by the current user."""
    await svc.delete(user, attachment_id)
