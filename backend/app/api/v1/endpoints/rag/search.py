"""Semantic vector search without generation or reranking."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.ai.container import AiContainer, get_ai_container
from app.api.deps import PERM_DOCUMENTS_READ, get_current_user
from app.models.users.user_model import User
from app.rag.retrieval.types import RetrievalRequest

router = APIRouter(prefix="/rag/search", tags=["rag: search"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    collection_ids: list[uuid.UUID] | None = Field(default=None, max_length=100)
    top_k: int = Field(default=10, ge=1, le=50)


class SearchChunk(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    collection_id: uuid.UUID
    document_title: str
    text: str
    page: int | None
    heading_path: list[str]
    score: float
    token_count: int
    document_url: str | None
    chunk_index: int
    match_type: str | None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchChunk]
    total: int
    latency_ms: int
    embedding_model: str | None


@router.post("", response_model=SearchResponse)
async def search_vectors(
    data: SearchRequest,
    user: User = Depends(get_current_user([PERM_DOCUMENTS_READ])),
    ai: AiContainer = Depends(get_ai_container),
) -> SearchResponse:
    result = await ai.retrieval.retrieve(
        user,
        RetrievalRequest(
            query=data.query,
            collection_ids=data.collection_ids,
            rerank=False,
            top_k=data.top_k,
            exact_match=True,
        ),
    )
    return SearchResponse(
        query=data.query,
        results=[
            SearchChunk(
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                collection_id=chunk.collection_id,
                document_title=chunk.document_title,
                text=chunk.text,
                page=chunk.page,
                heading_path=chunk.heading_path,
                score=chunk.score,
                token_count=chunk.token_count,
                document_url=chunk.document_url,
                chunk_index=chunk.chunk_index,
                match_type=chunk.match_type,
            )
            for chunk in result.chunks
        ],
        total=len(result.chunks),
        latency_ms=result.trace.latency_ms,
        embedding_model=result.trace.embedding_model,
    )
