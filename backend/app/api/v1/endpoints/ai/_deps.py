"""Залежності, специфічні для AI-модуля.

Авторизація/RBAC береться напряму з `app.api.deps` (get_current_user + PERM_AI_*),
так само як у RAG-роутах.
"""
from fastapi import Depends

from app.ai.container import AiContainer, get_ai_container


def container(c: AiContainer = Depends(get_ai_container)) -> AiContainer:
    return c
