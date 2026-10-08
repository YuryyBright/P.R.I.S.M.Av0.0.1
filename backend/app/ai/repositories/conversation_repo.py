"""Діалоги й повідомлення (rag_conversations / rag_messages / rag_citations) для UI."""
from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.rag_citation import RagCitation
from app.models.rag.rag_conversation import RagConversation
from app.models.rag.rag_message import RagMessage

class ConversationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, conv: RagConversation) -> None:
        self.db.add(conv)

    async def get_owned(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> RagConversation | None:
        conv = await self.db.get(RagConversation, conversation_id)
        return conv if conv is not None and conv.user_id == user_id else None

    async def list_page(self, user_id: uuid.UUID, *, archived: bool, limit: int, offset: int
                        ) -> tuple[list[RagConversation], int]:
        cond = (RagConversation.user_id == user_id, RagConversation.is_archived.is_(archived))
        total = (await self.db.exec(select(func.count()).select_from(RagConversation).where(*cond))).one()
        rows = await self.db.exec(select(RagConversation).where(*cond)
                                  .order_by(RagConversation.updated_at.desc()).limit(limit).offset(offset))
        return list(rows.all()), total

    async def delete(self, conv: RagConversation) -> None:
        await self.db.delete(conv)

    def add_message(self, msg: RagMessage) -> None:
        self.db.add(msg)

    async def messages_page(self, conversation_id: uuid.UUID, *, limit: int, before: uuid.UUID | None = None
                            ) -> tuple[list[RagMessage], dict[uuid.UUID, list[RagCitation]]]:
        """Останні `limit` повідомлень (за зростанням created_at) + їхні цитати."""
        stmt = select(RagMessage).where(RagMessage.conversation_id == conversation_id)
        if before is not None:
            anchor = await self.db.get(RagMessage, before)
            if anchor is not None:
                stmt = stmt.where(RagMessage.created_at < anchor.created_at)
        rows = list((await self.db.exec(stmt.order_by(RagMessage.created_at.desc()).limit(limit))).all())
        rows.reverse()
        cites: dict[uuid.UUID, list[RagCitation]] = defaultdict(list)
        if rows:
            res = await self.db.exec(select(RagCitation).where(
                RagCitation.message_id.in_([m.id for m in rows])).order_by(RagCitation.rank))
            for c in res.all():
                cites[c.message_id].append(c)
        return rows, cites

    async def recent_messages(self, conversation_id: uuid.UUID, *, limit: int,
                              exclude_id: uuid.UUID | None = None) -> list[RagMessage]:
        stmt = select(RagMessage).where(RagMessage.conversation_id == conversation_id)
        if exclude_id is not None:
            stmt = stmt.where(RagMessage.id != exclude_id)
        rows = list((await self.db.exec(stmt.order_by(RagMessage.created_at.desc()).limit(limit))).all())
        rows.reverse()
        return rows
