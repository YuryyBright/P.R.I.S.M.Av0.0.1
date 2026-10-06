import uuid

from fastapi import APIRouter, Depends, status

from app.ai.container import AiContainer
from app.ai.domain.enums import PromptKind
from app.ai.repositories.prompt_repo import PromptRepository
from app.ai.schemas import (
    PromptActivateRequest, PromptForkRequest, PromptTemplateCreate, PromptTemplateOut,
    PromptVersionCreate, PromptVersionOut,
)
from app.api.deps import (
    PERM_AI_PROMPTS_CREATE, PERM_AI_PROMPTS_MANAGE, PERM_AI_PROMPTS_READ,
    get_current_user,
)
from app.models.users.user_model import User

from ._deps import container

router = APIRouter(prefix="/prompts", tags=["ai: prompts"])

_prompt_read = get_current_user([PERM_AI_PROMPTS_READ])
_prompt_create = get_current_user([PERM_AI_PROMPTS_CREATE])
_prompt_manage = get_current_user([PERM_AI_PROMPTS_MANAGE])


@router.get("", response_model=list[PromptTemplateOut])
async def list_prompts(kind: PromptKind | None = None, user: User = Depends(_prompt_read),
                       c: AiContainer = Depends(container)):
    async with c.session_factory() as db:
        return await PromptRepository(db).list_visible(user.id, kind=kind)


@router.post("", response_model=PromptTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_prompt(body: PromptTemplateCreate, user: User = Depends(_prompt_create),
                        c: AiContainer = Depends(container)):
    template, _ = await c.prompts.create_template(
        user, slug=body.slug, name=body.name, kind=body.kind, content=body.content,
        description=body.description, variables_schema=body.variables_schema,
        model_params=body.model_params, system=body.system)
    return template


@router.get("/{template_id}/versions", response_model=list[PromptVersionOut])
async def list_versions(template_id: uuid.UUID, user: User = Depends(_prompt_read),
                        c: AiContainer = Depends(container)):
    async with c.session_factory() as db:
        repo = PromptRepository(db)
        t = await repo.get_template(template_id)
        if t is None or t.owner_id not in (None, user.id):
            from app.ai.domain.exceptions import PromptNotFoundError
            raise PromptNotFoundError("Prompt not found")
        return list(await repo.list_versions(template_id))


@router.post("/{template_id}/versions", response_model=PromptVersionOut,
             status_code=status.HTTP_201_CREATED)
async def add_version(template_id: uuid.UUID, body: PromptVersionCreate, user: User = Depends(_prompt_manage),
                      c: AiContainer = Depends(container)):
    _, version = await c.prompts.add_version(
        user, template_id, content=body.content, variables_schema=body.variables_schema,
        model_params=body.model_params, changelog=body.changelog, activate=body.activate)
    return version


@router.post("/{template_id}/activate", response_model=PromptTemplateOut)
async def activate_version(template_id: uuid.UUID, body: PromptActivateRequest,
                           user: User = Depends(_prompt_manage), c: AiContainer = Depends(container)):
    """Відкат = переставити active_version_id на стару версію."""
    return await c.prompts.activate(user, template_id, body.version_id)


@router.post("/{template_id}/fork", response_model=PromptTemplateOut, status_code=status.HTTP_201_CREATED)
async def fork_prompt(template_id: uuid.UUID, body: PromptForkRequest, user: User = Depends(_prompt_create),
                      c: AiContainer = Depends(container)):
    template, _ = await c.prompts.fork(user, template_id, slug=body.slug, name=body.name)
    return template
