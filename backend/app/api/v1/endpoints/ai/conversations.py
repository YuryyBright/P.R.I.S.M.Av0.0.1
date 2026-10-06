import uuid

from fastapi import APIRouter, Depends, Query, Response, status

from app.ai.container import AiContainer
from app.ai.schemas import (
    ConversationCreate, ConversationOut, ConversationUpdate, MessageOut, Page,
)
from app.api.deps import (
    PERM_AI_CONVERSATIONS_CREATE, PERM_AI_CONVERSATIONS_MANAGE, PERM_AI_CONVERSATIONS_READ,
    get_current_user,
)
from app.models.users.user_model import User

from ._deps import container

router = APIRouter(prefix="/conversations", tags=["ai: conversations"])

_conv_read = get_current_user([PERM_AI_CONVERSATIONS_READ])
_conv_create = get_current_user([PERM_AI_CONVERSATIONS_CREATE])
_conv_manage = get_current_user([PERM_AI_CONVERSATIONS_MANAGE])


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(body: ConversationCreate, user: User = Depends(_conv_create),
                              c: AiContainer = Depends(container)):
    return await c.conversation_service.create(user, body)


@router.get("", response_model=Page)
async def list_conversations(
    archived: bool = False,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(_conv_read),
    c: AiContainer = Depends(container),
):
    items, total = await c.conversation_service.list(user, archived=archived, limit=limit, offset=offset)
    return Page[ConversationOut](
        items=[ConversationOut.model_validate(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: uuid.UUID, user: User = Depends(_conv_read),
                           c: AiContainer = Depends(container)):
    return await c.conversation_service.get(user, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(conversation_id: uuid.UUID, body: ConversationUpdate,
                              user: User = Depends(_conv_manage), c: AiContainer = Depends(container)):
    return await c.conversation_service.update(user, conversation_id, body)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: uuid.UUID, user: User = Depends(_conv_manage),
                              c: AiContainer = Depends(container)):
    await c.conversation_service.delete(user, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(conversation_id: uuid.UUID, limit: int = Query(50, ge=1, le=200),
                        before: uuid.UUID | None = None, user: User = Depends(_conv_read),
                        c: AiContainer = Depends(container)):
    return await c.conversation_service.messages(user, conversation_id, limit=limit, before=before)
