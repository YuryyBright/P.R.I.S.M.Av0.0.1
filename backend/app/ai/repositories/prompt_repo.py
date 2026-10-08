"""Доступ до БД для промптів. Без commit (транзакцією керує caller)."""
from __future__ import annotations

import uuid
from typing import Any, Sequence

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import PromptKind
from app.models.ai.prompt_template import AiPromptTemplate
from app.models.ai.prompt_version import AiPromptVersion

class PromptRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---- templates -------------------------------------------------------------

    async def get_template(self, template_id: uuid.UUID | None) -> AiPromptTemplate | None:
        return await self.db.get(AiPromptTemplate, template_id) if template_id else None

    async def find_system(self, slug: str) -> AiPromptTemplate | None:
        return (await self.db.exec(select(AiPromptTemplate).where(
            AiPromptTemplate.owner_id.is_(None), AiPromptTemplate.slug == slug))).first()

    async def find_by_slug(self, user_id: uuid.UUID, slug: str) -> AiPromptTemplate | None:
        """Власний шаблон із цим slug має пріоритет над системним (override)."""
        own = (await self.db.exec(select(AiPromptTemplate).where(
            AiPromptTemplate.owner_id == user_id, AiPromptTemplate.slug == slug,
            AiPromptTemplate.is_archived.is_(False)))).first()
        return own or await self.find_system(slug)

    def add_template(self, *, owner_id: uuid.UUID | None, slug: str, name: str, kind: PromptKind,
                     description: str | None) -> AiPromptTemplate:
        t = AiPromptTemplate(owner_id=owner_id, slug=slug, name=name, kind=kind, description=description)
        self.db.add(t)
        return t

    async def list_visible(self, user_id: uuid.UUID, *, kind: PromptKind | None = None,
                           include_archived: bool = False) -> list[AiPromptTemplate]:
        stmt = select(AiPromptTemplate).where(
            or_(AiPromptTemplate.owner_id.is_(None), AiPromptTemplate.owner_id == user_id))
        if kind is not None:
            stmt = stmt.where(AiPromptTemplate.kind == kind)
        if not include_archived:
            stmt = stmt.where(AiPromptTemplate.is_archived.is_(False))
        return list((await self.db.exec(stmt.order_by(AiPromptTemplate.name))).all())

    # ---- versions --------------------------------------------------------------

    async def get_version(self, version_id: uuid.UUID | None) -> AiPromptVersion | None:
        return await self.db.get(AiPromptVersion, version_id) if version_id else None

    async def add_version(self, template: AiPromptTemplate, *, content: str, variables_schema: dict[str, Any],
                          model_params: dict[str, Any], created_by_id: uuid.UUID | None,
                          changelog: str | None) -> AiPromptVersion:
        last = (await self.db.exec(
            select(func.max(AiPromptVersion.version)).where(
                AiPromptVersion.template_id == template.id))).one()
        v = AiPromptVersion(
            template_id=template.id, version=(last or 0) + 1, content=content,
            variables_schema=variables_schema, model_params=model_params,
            created_by_id=created_by_id, changelog=changelog)
        self.db.add(v)
        await self.db.flush()
        return v

    async def count_versions(self, template_id: uuid.UUID) -> int:
        return (await self.db.exec(select(func.count()).select_from(AiPromptVersion).where(
            AiPromptVersion.template_id == template_id))).one()

    async def list_versions(self, template_id: uuid.UUID) -> Sequence[AiPromptVersion]:
        return (await self.db.exec(select(AiPromptVersion).where(
            AiPromptVersion.template_id == template_id).order_by(AiPromptVersion.version.desc()))).all()

    async def has_version_with_changelog(self, template_id: uuid.UUID, changelog: str) -> bool:
        return (await self.db.exec(select(AiPromptVersion.id).where(
            AiPromptVersion.template_id == template_id,
            AiPromptVersion.changelog == changelog))).first() is not None
