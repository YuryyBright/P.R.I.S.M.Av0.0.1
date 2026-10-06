from fastapi import APIRouter, Depends

from app.ai.container import AiContainer
from app.ai.schemas import CapabilitiesOut
from app.api.deps import PERM_AI_CAPABILITIES_READ, get_current_user
from app.models.users.user_model import User

from ._deps import container

router = APIRouter(tags=["ai: capabilities"])

_cap_read = get_current_user([PERM_AI_CAPABILITIES_READ])


@router.get("/capabilities", response_model=CapabilitiesOut)
async def capabilities(user: User = Depends(_cap_read), c: AiContainer = Depends(container)):
    """Що реально доступно UI: моделі (vision/tools), reranker, інструменти, профілі, промпти."""
    return await c.capabilities_service.build(user)
