"""Доступ до БД для промптів. Без commit (транзакцією керує caller)."""
from __future__ import annotations

import uuid
from typing import Any, Sequence, cast

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import PromptKind
from app.models.ai.prompt_template import AiPromptTemplate
from app.models.ai.prompt_version import AiPromptVersion

_template = cast(Any, AiPromptTemplate)
_version = cast(Any, AiPromptVersion)


class PromptRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---- templates -------------------------------------------------------------

    async def get_template(self, template_id: uuid.UUID | None) -> AiPromptTemplate | None:
        return await self.db.get(AiPromptTemplate, template_id) if template_id else None

    async def find_system(self, slug: str) -> AiPromptTemplate | None:
        return (await self.db.exec(select(AiPromptTemplate).where(
            _template.owner_id.is_(None), _template.slug == slug))).first()

    async def find_by_slug(self, user_id: uuid.UUID, slug: str) -> AiPromptTemplate | None:
        """Власний шаблон із цим slug має пріоритет над системним (override)."""
        own = (await self.db.exec(select(AiPromptTemplate).where(
            _template.owner_id == user_id, _template.slug == slug,
            _template.is_archived.is_(False)))).first()
        return own or await self.find_system(slug)

    def add_template(self, *, owner_id: uuid.UUID | None, slug: str, name: str, kind: PromptKind,
                     description: str | None) -> AiPromptTemplate:
        t = AiPromptTemplate(owner_id=owner_id, slug=slug, name=name, kind=kind, description=description)
        self.db.add(t)
        return t

    async def list_visible(self, user_id: uuid.UUID, *, kind: PromptKind | None = None,
                           include_archived: bool = False) -> list[AiPromptTemplate]:
        stmt = select(AiPromptTemplate).where(
            or_(_template.owner_id.is_(None), _template.owner_id == user_id))
        if kind is not None:
            stmt = stmt.where(_template.kind == kind)
        if not include_archived:
            stmt = stmt.where(_template.is_archived.is_(False))
        return list((await self.db.exec(stmt.order_by(_template.name))).all())

    # ---- versions --------------------------------------------------------------

    async def get_version(self, version_id: uuid.UUID | None) -> AiPromptVersion | None:
        return await self.db.get(AiPromptVersion, version_id) if version_id else None

    async def add_version(self, template: AiPromptTemplate, *, content: str, variables_schema: dict[str, Any],
                          model_params: dict[str, Any], created_by_id: uuid.UUID | None,
                          changelog: str | None) -> AiPromptVersion:
        last = (await self.db.exec(
            select(func.max(_version.version)).where(
                _version.template_id == template.id))).one()
        v = AiPromptVersion(
            template_id=template.id, version=(last or 0) + 1, content=content,
            variables_schema=variables_schema, model_params=model_params,
            created_by_id=created_by_id, changelog=changelog)
        self.db.add(v)
        await self.db.flush()
        return v

    async def count_versions(self, template_id: uuid.UUID) -> int:
        return (await self.db.exec(select(func.count()).select_from(AiPromptVersion).where(
            _version.template_id == template_id))).one()

    async def list_versions(self, template_id: uuid.UUID) -> Sequence[AiPromptVersion]:
        return (await self.db.exec(select(AiPromptVersion).where(
            _version.template_id == template_id).order_by(_version.version.desc()))).all()

    async def has_version_with_changelog(self, template_id: uuid.UUID, changelog: str) -> bool:
        return (await self.db.exec(select(_version.id).where(
            _version.template_id == template_id,
            _version.changelog == changelog))).first() is not None
