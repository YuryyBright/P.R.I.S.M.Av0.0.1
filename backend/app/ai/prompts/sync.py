"""Синхронізація seeds/*.j2 → БД (системні промпти). Викликати на старті API/воркера або з міграції.

Правила (щоб не затирати ручні зміни адміна):
  * шаблон відсутній → створюється разом з v1;
  * зміст seed змінився → нова версія з changelog "seed:<hash12>";
  * активною вона стає ЛИШЕ якщо поточна активна версія теж seed-версія (або активної нема).
    Якщо адмін вручну активував власну версію — seed не перебиває її.
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import PromptKind
from app.ai.repositories.prompt_repo import PromptRepository

logger = logging.getLogger(__name__)

SEEDS_DIR = Path(__file__).parent / "seeds"

SEEDS: dict[str, tuple[PromptKind, str, dict]] = {
    # slug: (kind, назва, model_params)
    "chat_system": (PromptKind.CHAT_SYSTEM, "Chat: system", {"temperature": 0.2}),
    "agent_system": (PromptKind.AGENT_SYSTEM, "Agent: system", {"temperature": 0.1}),
    "query_rewrite": (PromptKind.QUERY_REWRITE, "Query rewrite", {"temperature": 0.0}),
}


def _tag(content: str) -> str:
    return "seed:" + hashlib.sha256(content.encode()).hexdigest()[:12]


async def sync_system_prompts(session_factory: Callable[[], AsyncSession]) -> dict[str, str]:
    """Повертає {slug: created|updated|unchanged|kept_manual_active}."""
    result: dict[str, str] = {}

    async with session_factory() as db:
        repo = PromptRepository(db)

        for slug, (kind, name, params) in SEEDS.items():
            content = (SEEDS_DIR / f"{slug}.j2").read_text(encoding="utf-8").strip()
            tag = _tag(content)

            template = await repo.find_system(slug)

            if template is None:
                template = repo.add_template(
                    owner_id=None,
                    slug=slug,
                    name=name,
                    kind=kind,
                    description="System prompt (seed)",
                )

                await db.flush()

                v = await repo.add_version(
                    template,
                    content=content,
                    variables_schema={},
                    model_params=params,
                    created_by_id=None,
                    changelog=tag,
                )

                template.active_version_id = v.id
                result[slug] = "created"
                continue

            if await repo.has_version_with_changelog(template.id, tag):
                result[slug] = "unchanged"
                continue

            active = (
                await repo.get_version(template.active_version_id)
                if template.active_version_id
                else None
            )

            was_seed_active = (
                active is None
                or (active.changelog or "").startswith("seed:")
            )

            v = await repo.add_version(
                template,
                content=content,
                variables_schema={},
                model_params=params,
                created_by_id=None,
                changelog=tag,
            )

            if was_seed_active:
                template.active_version_id = v.id
                result[slug] = "updated"
            else:
                result[slug] = "kept_manual_active"

        await db.commit()

    logger.info("system prompts synced: %s", result)
    return result
