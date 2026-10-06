"""RetrievalService — єдина точка retrieval для chat і agent.

Пайплайн: scope(ACL) → embed → dense(+sparse) → RRF → hydrate(Postgres, відкинути
видалені/не-READY) → rerank → top_k → пакування в max_context_tokens → trace.

DB-сесії короткі й НЕ тримаються під час викликів embedder/Qdrant/reranker.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Callable

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.document_chunk import DocumentChunk
from app.rag.domain.enums import DocumentStatus
from app.rag.domain.exceptions import NotFoundError
from app.rag.domain.ports import Embedder, Reranker, ScoredPoint, SearchFilter, SparseEmbedder, VectorStore
from app.rag.settings import RagSettings

from .context import pack_chunks
from .fusion import rrf
from .hydrate import hydrate_chunks
from .scope import list_accessible, resolve_scope
from .types import (
    CollectionBrief, RetrievalRequest, RetrievalResult, RetrievalTrace, RetrievedChunk,
)

SessionFactory = Callable[[], AsyncSession]


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


class RetrievalService:
    def __init__(self, *, session_factory: SessionFactory, vector_store: VectorStore,
                 embedder: Embedder, sparse: SparseEmbedder | None,
                 reranker: Reranker | None, settings: RagSettings) -> None:
        self._sf = session_factory
        self._store = vector_store
        self._embedder = embedder
        self._sparse = sparse
        self._reranker = reranker
        self._cfg = settings

    # ---- capabilities ----------------------------------------------------------

    @property
    def reranker_available(self) -> bool:
        return self._reranker is not None

    # ---- main ------------------------------------------------------------------

    async def retrieve(self, user: Any, req: RetrievalRequest) -> RetrievalResult:
        t_all = time.perf_counter()
        r = self._cfg.retrieval
        trace = RetrievalTrace(
            embedding_model=getattr(self._embedder, "model", None),
            dense_top_k=r.dense_top_k,
            sparse_top_k=r.sparse_top_k if self._sparse else None,
            fused_top_n=r.fused_top_n,
        )

        # 1) scope (коротка сесія)
        async with self._sf() as db:
            scope = await resolve_scope(db, user, req.collection_ids)
        trace.access_scope = {
            "collection_ids": [str(c) for c in scope.collection_ids],
            "requested": [str(c) for c in scope.requested] if scope.requested is not None else None,
            "denied": [str(c) for c in scope.denied],
        }
        trace.filters = {
            "document_ids": [str(d) for d in req.document_ids] if req.document_ids else None,
            "rerank": req.rerank, "top_k": req.top_k,
        }
        if scope.denied:
            trace.warnings.append(f"collections_unavailable:{len(scope.denied)}")
        query = req.query.strip()
        if scope.empty or not query:
            trace.latency_ms = _ms(t_all)
            return RetrievalResult([], trace)
        if req.document_ids is not None and not req.document_ids:
            trace.latency_ms = _ms(t_all)
            return RetrievalResult([], trace)

        # 2) embed + search
        t = time.perf_counter()
        dense_vec = (await self._embedder.embed([query]))[0]
        sparse_vec = (await self._sparse.embed([query]))[0] if self._sparse else None
        trace.timings["embed_ms"] = _ms(t)

        flt = SearchFilter(
            collection_ids=scope.collection_ids,
            document_ids=req.document_ids if req.document_ids else None,
        )
        t = time.perf_counter()
        dense_task = self._store.search_dense(dense_vec, r.dense_top_k, flt)
        if sparse_vec is not None:
            dense, sparse = await asyncio.gather(
                dense_task, self._store.search_sparse(sparse_vec, r.sparse_top_k, flt))
        else:
            dense, sparse = await dense_task, []
        trace.timings["search_ms"] = _ms(t)

        if r.min_score is not None:
            dense = [p for p in dense if p.score >= r.min_score]

        # 3) fusion
        fused = rrf([dense, sparse], k=r.rrf_k)[: r.fused_top_n]
        if not fused:
            trace.latency_ms = _ms(t_all)
            return RetrievalResult([], trace)

        # 4) hydrate (коротка сесія; відкидає видалені/не-READY/поза scope)
        payloads = {uuid.UUID(h.id): h.payload for h in fused}
        t = time.perf_counter()
        async with self._sf() as db:
            hydrated = await hydrate_chunks(
                db, payloads.keys(), allowed_collections=set(scope.collection_ids), payloads=payloads)
        trace.timings["hydrate_ms"] = _ms(t)

        chunks: list[RetrievedChunk] = []
        for h in fused:
            c = hydrated.get(uuid.UUID(h.id))
            if c is not None:
                c.score = h.score
                chunks.append(c)
        dropped = len(fused) - len(chunks)
        if dropped:
            trace.warnings.append(f"dropped_stale:{dropped}")

        # 5) rerank
        want_rerank = (self._reranker is not None) if req.rerank is None else req.rerank
        top_k = req.top_k or self._cfg.reranker.top_k
        if want_rerank and chunks:
            if self._reranker is None:
                trace.warnings.append("reranker_unavailable")
            else:
                t = time.perf_counter()
                ranked = await self._reranker.rerank(query, [c.text for c in chunks], top_k)
                trace.timings["rerank_ms"] = _ms(t)
                reordered: list[RetrievedChunk] = []
                for idx, score in ranked:
                    chunks[idx].rerank_score = score
                    reordered.append(chunks[idx])
                chunks = reordered
                trace.reranked = True
                trace.reranker_model = self._cfg.reranker.model
                trace.reranker_top_k = top_k
        chunks = chunks[:top_k]

        # 6) пакування в бюджет контексту
        chunks = pack_chunks(chunks, r.max_context_tokens)
        trace.results_count = len(chunks)
        trace.latency_ms = _ms(t_all)
        return RetrievalResult(chunks, trace)

    # ---- допоміжні операції для інструментів агента ---------------------------

    async def list_collections(self, user: Any) -> list[CollectionBrief]:
        async with self._sf() as db:
            return await list_accessible(db, user)

    async def read_chunks(self, user: Any, document_id: uuid.UUID, *,
                          start: int = 0, count: int = 5) -> list[RetrievedChunk]:
        """Послідовні чанки документа (для read_document). ACL — як у retrieve()."""
        async with self._sf() as db:
            doc = (await db.exec(select(Document).where(
                Document.id == document_id, Document.deleted_at.is_(None),
                Document.status == DocumentStatus.READY))).first()
            if doc is None:
                raise NotFoundError("Document not found")
            scope = await resolve_scope(db, user, [doc.collection_id])
            if scope.empty:
                raise NotFoundError("Document not found")      # не розкриваємо існування
            rows = (await db.exec(
                select(DocumentChunk).where(
                    DocumentChunk.document_id == document_id,
                    DocumentChunk.chunk_index >= start,
                    DocumentChunk.chunk_index < start + count)
                .order_by(DocumentChunk.chunk_index))).all()
            return [RetrievedChunk(
                chunk_id=c.id, document_id=doc.id, collection_id=doc.collection_id,
                document_title=doc.title, text=c.content, page=c.page_number,
                heading_path=[str(h) for h in (c.meta or {}).get("heading_path", [])],
                score=0.0, token_count=c.token_count, document_url=doc.url,
                chunk_index=c.chunk_index) for c in rows]
