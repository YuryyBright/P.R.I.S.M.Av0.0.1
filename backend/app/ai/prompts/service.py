"""PromptService: версії промптів, resolve → ResolvedPrompt(version_id, …), рендер.

Версії незмінні; version_id потрапляє в ai_runs.config, тому відповідь відтворювана.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Mapping

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import PromptKind
from app.ai.domain.exceptions import ForbiddenError, InvalidInputError, PromptNotFoundError
from app.ai.repositories.prompt_repo import PromptRepository
from app.models.ai.prompt_template import AiPromptTemplate
from app.models.ai.prompt_version import AiPromptVersion
from app.ai.settings import PromptSettings

from . import renderer

SessionFactory = Callable[[], AsyncSession]

DEFAULT_SLUG: dict[PromptKind, str] = {
    PromptKind.CHAT_SYSTEM: "chat_system",
    PromptKind.AGENT_SYSTEM: "agent_system",
    PromptKind.QUERY_REWRITE: "query_rewrite",
}


@dataclass(frozen=True, slots=True)
class ResolvedPrompt:
    version_id: uuid.UUID
    template_id: uuid.UUID
    slug: str
    kind: PromptKind
    version: int
    content: str
    variables_schema: dict[str, Any] = field(default_factory=dict)
    model_params: dict[str, Any] = field(default_factory=dict)


def builtin_variables(user: Any, collection_names: list[str]) -> dict[str, Any]:
    name = (getattr(user, "first_name", None) or getattr(user, "username", None)
            or getattr(user, "email", None) or "user")
    return {"user_name": str(name), "today": date.today().isoformat(), "collections": collection_names}


class PromptService:
    def __init__(self, session_factory: SessionFactory, cfg: PromptSettings | None = None) -> None:
        self._sf = session_factory
        self._cfg = cfg or PromptSettings()

    # ---- resolve ---------------------------------------------------------------

    async def resolve(self, user: Any, kind: PromptKind, *,
                      version_id: uuid.UUID | None = None,
                      template_id: uuid.UUID | None = None) -> ResolvedPrompt:
        """Пріоритет: явна версія → активна версія шаблону → дефолтний системний за slug."""
        async with self._sf() as db:
            repo = PromptRepository(db)
            if version_id is not None:
                version = await repo.get_version(version_id)
                if version is None:
                    raise PromptNotFoundError("Prompt version not found")
                template = await repo.get_template(version.template_id)
            elif template_id is not None:
                template = await repo.get_template(template_id)
                version = await repo.get_version(template.active_version_id) \
                    if template and template.active_version_id else None
            else:
                template = await repo.find_by_slug(user.id, DEFAULT_SLUG[kind])
                version = await repo.get_version(template.active_version_id) \
                    if template and template.active_version_id else None
            if template is None or version is None:
                raise PromptNotFoundError("Prompt not found")
            if template.owner_id not in (None, user.id) and not getattr(user, "is_superuser", False):
                raise ForbiddenError("Prompt is not accessible")
            if template.kind != kind:
                raise InvalidInputError(
                    f"Prompt kind mismatch: expected {kind.value}, got {template.kind.value}")
            return self._to_resolved(template, version)

    async def get_version(self, version_id: uuid.UUID) -> ResolvedPrompt:
        """Без перевірки доступу: версію вже зафіксовано в snapshot-і run-а при старті."""
        async with self._sf() as db:
            repo = PromptRepository(db)
            version = await repo.get_version(version_id)
            if version is None:
                raise PromptNotFoundError("Prompt version not found")
            template = await repo.get_template(version.template_id)
            if template is None:
                raise PromptNotFoundError("Prompt template not found")
            return self._to_resolved(template, version)

    @staticmethod
    def _to_resolved(template: Any, version: Any) -> ResolvedPrompt:
        return ResolvedPrompt(
            version_id=version.id, template_id=template.id, slug=template.slug, kind=template.kind,
            version=version.version, content=version.content,
            variables_schema=version.variables_schema or {}, model_params=version.model_params or {})

    # ---- render ----------------------------------------------------------------

    @staticmethod
    def render(prompt: ResolvedPrompt, variables: Mapping[str, Any]) -> str:
        return renderer.render(prompt.content, variables)

    @staticmethod
    def user_variable_names(prompt: ResolvedPrompt) -> list[str]:
        return list((prompt.variables_schema.get("properties") or {}).keys())

    # ---- авторство (для API) -----------------------------------------------------

    async def create_template(self, user: Any, *, slug: str, name: str, kind: PromptKind,
                              content: str, description: str | None = None,
                              variables_schema: dict[str, Any] | None = None,
                              model_params: dict[str, Any] | None = None,
                              system: bool = False) -> tuple[AiPromptTemplate, AiPromptVersion]:
        self._check_content(content, variables_schema)
        if system and not getattr(user, "is_superuser", False):
            raise ForbiddenError("Only admins can create system prompts")
        async with self._sf() as db:
            repo = PromptRepository(db)
            template = repo.add_template(
                owner_id=None if system else user.id, slug=slug, name=name, kind=kind,
                description=description)
            await db.flush()
            version = await repo.add_version(
                template, content=content, variables_schema=variables_schema or {},
                model_params=model_params or {}, created_by_id=user.id, changelog="initial")
            template.active_version_id = version.id
            await db.commit()
            return template, version

    async def add_version(self, user: Any, template_id: uuid.UUID, *, content: str,
                          variables_schema: dict[str, Any] | None = None,
                          model_params: dict[str, Any] | None = None,
                          changelog: str | None = None,
                          activate: bool = True) -> tuple[AiPromptTemplate, AiPromptVersion]:
        self._check_content(content, variables_schema)
        async with self._sf() as db:
            repo = PromptRepository(db)
            template = await self._owned_template(repo, user, template_id)
            if await repo.count_versions(template.id) >= self._cfg.max_versions_per_template:
                raise InvalidInputError("Too many versions; archive the template or fork it")
            version = await repo.add_version(
                template, content=content, variables_schema=variables_schema or {},
                model_params=model_params or {}, created_by_id=user.id, changelog=changelog)
            if activate:
                template.active_version_id = version.id
            await db.commit()
            return template, version

    async def activate(
        self, user: Any, template_id: uuid.UUID, version_id: uuid.UUID
    ) -> AiPromptTemplate:
        async with self._sf() as db:
            repo = PromptRepository(db)
            template = await self._owned_template(repo, user, template_id)
            version = await repo.get_version(version_id)
            if version is None or version.template_id != template.id:
                raise PromptNotFoundError("Version does not belong to this template")
            template.active_version_id = version.id            # відкат = зміна вказівника
            await db.commit()
            return template

    async def fork(
        self,
        user: Any,
        template_id: uuid.UUID,
        *,
        slug: str,
        name: str | None = None,
    ) -> tuple[AiPromptTemplate, AiPromptVersion]:
        """Копія (системного чи чужого доступного) промпту у власні."""
        async with self._sf() as db:
            repo = PromptRepository(db)
            src = await repo.get_template(template_id)
            if src is None or src.owner_id not in (None, user.id):
                raise PromptNotFoundError("Prompt not found")
            src_version = await repo.get_version(src.active_version_id) if src.active_version_id else None
            if src_version is None:
                raise PromptNotFoundError("Prompt has no active version")
            template = repo.add_template(owner_id=user.id, slug=slug, name=name or src.name,
                                         kind=src.kind, description=src.description)
            await db.flush()
            version = await repo.add_version(
                template, content=src_version.content, variables_schema=src_version.variables_schema,
                model_params=src_version.model_params, created_by_id=user.id,
                changelog=f"fork of {src.slug} v{src_version.version}")
            template.active_version_id = version.id
            await db.commit()
            return template, version

    def _check_content(
        self, content: str, variables_schema: dict[str, Any] | None
    ) -> None:
        if len(content) > self._cfg.max_content_chars:
            raise InvalidInputError(f"Prompt is too long (max {self._cfg.max_content_chars} chars)")
        extra = list(((variables_schema or {}).get("properties") or {}).keys())
        renderer.validate_template(content, extra)

    @staticmethod
    async def _owned_template(
        repo: PromptRepository, user: Any, template_id: uuid.UUID
    ) -> AiPromptTemplate:
        template = await repo.get_template(template_id)
        if template is None:
            raise PromptNotFoundError("Prompt not found")
        if template.owner_id is None:
            if not getattr(user, "is_superuser", False):
                raise ForbiddenError("System prompts are managed by admins (fork it instead)")
        elif template.owner_id != user.id and not getattr(user, "is_superuser", False):
            raise PromptNotFoundError("Prompt not found")
        return template
