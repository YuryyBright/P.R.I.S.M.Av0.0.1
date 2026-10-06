import uuid

from fastapi import APIRouter, Depends, Response, status

from app.ai.container import AiContainer
from app.ai.schemas import ProfileCreate, ProfileOut
from app.api.deps import (
    PERM_AI_PROFILES_CREATE, PERM_AI_PROFILES_MANAGE, PERM_AI_PROFILES_READ,
    get_current_user,
)
from app.models.users.user_model import User

from ._deps import container

router = APIRouter(prefix="/profiles", tags=["ai: agent profiles"])

_profile_read = get_current_user([PERM_AI_PROFILES_READ])
_profile_create = get_current_user([PERM_AI_PROFILES_CREATE])
_profile_manage = get_current_user([PERM_AI_PROFILES_MANAGE])


@router.get("", response_model=list[ProfileOut])
async def list_profiles(user: User = Depends(_profile_read), c: AiContainer = Depends(container)):
    return await c.profile_service.list(user)


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(body: ProfileCreate, user: User = Depends(_profile_create),
                         c: AiContainer = Depends(container)):
    return await c.profile_service.create(user, body)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_profile(profile_id: uuid.UUID, user: User = Depends(_profile_manage),
                          c: AiContainer = Depends(container)):
    await c.profile_service.archive(user, profile_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
