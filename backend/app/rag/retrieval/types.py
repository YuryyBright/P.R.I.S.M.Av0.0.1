"""Типи retrieval. Живуть у rag; ai їх лише імпортує."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class RetrievalRequest:
    query: str
    collection_ids: list[uuid.UUID] | None = None   # запит користувача; None = усі доступні
    document_ids: list[uuid.UUID] | None = None
    rerank: bool | None = None                       # None = дефолт із settings (є reranker → так)
    top_k: int | None = None
    exact_match: bool = False


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    collection_id: uuid.UUID
    document_title: str
    text: str
    page: int | None
    heading_path: list[str]
    score: float
    rerank_score: float | None = None
    token_count: int = 0
    document_url: str | None = None
    chunk_index: int = 0
    match_type: str | None = None


@dataclass(slots=True)
class AccessScope:
    collection_ids: list[uuid.UUID]                  # доступні (ACL ∩ запитані ∩ активні)
    requested: list[uuid.UUID] | None
    denied: list[uuid.UUID] = field(default_factory=list)   # запитані, але недоступні

    @property
    def empty(self) -> bool:
        return not self.collection_ids


@dataclass(slots=True)
class RetrievalTrace:
    embedding_model: str | None = None
    reranker_model: str | None = None
    dense_top_k: int | None = None
    sparse_top_k: int | None = None
    fused_top_n: int | None = None
    reranker_top_k: int | None = None
    results_count: int = 0
    latency_ms: int = 0
    filters: dict[str, Any] = field(default_factory=dict)
    access_scope: dict[str, Any] = field(default_factory=dict)
    timings: dict[str, int] = field(default_factory=dict)
    reranked: bool = False
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "embedding_model": self.embedding_model,
            "reranker_model": self.reranker_model,
            "dense_top_k": self.dense_top_k,
            "sparse_top_k": self.sparse_top_k,
            "fused_top_n": self.fused_top_n,
            "reranker_top_k": self.reranker_top_k,
            "results_count": self.results_count,
            "latency_ms": self.latency_ms,
            "filters": self.filters,
            "access_scope": self.access_scope,
            "timings": self.timings,
            "reranked": self.reranked,
            "warnings": self.warnings,
        }

    def to_persistence_dict(self) -> dict[str, Any]:
        return {
            "embedding_model": self.embedding_model,
            "reranker_model": self.reranker_model,
            "dense_top_k": self.dense_top_k,
            "sparse_top_k": self.sparse_top_k,
            "fused_top_n": self.fused_top_n,
            "reranker_top_k": self.reranker_top_k,
            "results_count": self.results_count,
            "latency_ms": self.latency_ms,
            "filters": self.filters,
            "access_scope": self.access_scope,
            "timings": self.timings,
        }


@dataclass(slots=True)
class RetrievalResult:
    chunks: list[RetrievedChunk]
    trace: RetrievalTrace


@dataclass(slots=True)
class CollectionBrief:
    id: uuid.UUID
    name: str
    description: str | None
