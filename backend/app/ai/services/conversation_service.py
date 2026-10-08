from __future__ import annotations

import uuid
from typing import Any, Callable, List

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.exceptions import ConflictError, NotFoundError
from app.ai.repositories.conversation_repo import ConversationRepository
from app.ai.repositories.run_repo import RunRepository
from app.models.rag.rag_conversation import RagConversation
from app.ai.schemas import (
    AttachmentOut, CitationOut, ConversationCreate, ConversationSettings, ConversationUpdate, MessageOut,
)


class ConversationService:
    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self._sf = session_factory

    async def create(self, user: Any, body: ConversationCreate) -> RagConversation:
        base = ConversationSettings()
        if body.settings is not None:
            base = ConversationSettings.model_validate(
                {**base.model_dump(), **body.settings.model_dump(exclude_unset=True)})
        async with self._sf() as db:
            conv = RagConversation(
                user_id=user.id, title=body.title, mode=base.mode.value,
                settings=base.model_dump(mode="json"))
            ConversationRepository(db).add(conv)
            await db.commit()
            await db.refresh(conv)
            return conv

    async def list(
        self, user: Any, *, archived: bool, limit: int, offset: int
    ) -> tuple[List[RagConversation], int]:
        async with self._sf() as db:
            return await ConversationRepository(db).list_page(
                user.id, archived=archived, limit=limit, offset=offset)

    async def get(self, user: Any, conversation_id: uuid.UUID) -> RagConversation:
        async with self._sf() as db:
            conv = await ConversationRepository(db).get_owned(conversation_id, user.id)
        if conv is None:
            raise NotFoundError("Conversation not found")
        return conv

    async def update(
        self, user: Any, conversation_id: uuid.UUID, body: ConversationUpdate
    ) -> RagConversation:
        async with self._sf() as db:
            conv = await ConversationRepository(db).get_owned(conversation_id, user.id)
            if conv is None:
                raise NotFoundError("Conversation not found")
            if body.title is not None:
                conv.title = body.title
            if body.is_archived is not None:
                conv.is_archived = body.is_archived
            if body.settings is not None:
                cur = ConversationSettings.model_validate(conv.settings or {})
                merged = ConversationSettings.model_validate(
                    {**cur.model_dump(), **body.settings.model_dump(exclude_unset=True)})
                conv.settings = merged.model_dump(mode="json")
            await db.commit()
            await db.refresh(conv)
            return conv

    async def delete(self, user: Any, conversation_id: uuid.UUID) -> None:
        async with self._sf() as db:
            repo = ConversationRepository(db)
            conv = await repo.get_owned(conversation_id, user.id)
            if conv is None:
                raise NotFoundError("Conversation not found")
            if await RunRepository(db).active_for_conversation(conversation_id) is not None:
                raise ConflictError("Stop the active run before deleting the conversation")
            await repo.delete(conv)
            await db.commit()

    async def messages(self, user: Any, conversation_id: uuid.UUID, *, limit: int,
                       before: uuid.UUID | None) -> List[MessageOut]:
        async with self._sf() as db:
            repo = ConversationRepository(db)
            if await repo.get_owned(conversation_id, user.id) is None:
                raise NotFoundError("Conversation not found")
            rows, cites = await repo.messages_page(conversation_id, limit=limit, before=before)

        out: list[MessageOut] = []
        for m in rows:
            meta = m.meta or {}
            rid = meta.get("run_id")
            raw_attachments = meta.get("attachments") or []
            attachments = [
                AttachmentOut(
                    id=a["id"],
                    filename=a["filename"],
                    mime_type=a["mime_type"],
                    size=a["size"],
                )
                for a in raw_attachments
                if isinstance(a, dict)
                and {"id", "filename", "mime_type", "size"} <= a.keys()
            ]
            out.append(MessageOut(
                id=m.id, role=m.role.value, content=m.content, model=m.model,
                finish_reason=m.finish_reason, created_at=m.created_at,
                run_id=uuid.UUID(rid) if rid else None,
                citations=[CitationOut.model_validate(c) for c in cites.get(m.id, [])],
                attachments=attachments,
            ))
        return out
