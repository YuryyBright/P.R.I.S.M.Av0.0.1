from fastapi import APIRouter

from . import capabilities, conversations, profiles, prompts, runs, attachments
from .tasks import router as tasks_router

ai_router = APIRouter(prefix="/ai")
for _m in (conversations, runs, prompts, profiles, capabilities, attachments):
    ai_router.include_router(_m.router)

ai_router.include_router(tasks_router)

__all__ = ["ai_router"]
