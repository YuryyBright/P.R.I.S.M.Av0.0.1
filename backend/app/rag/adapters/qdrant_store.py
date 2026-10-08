"""Qdrant: одна колекція `{prefix}_chunks`, named vectors "dense" + (опційно) "sparse" (BM25, IDF).

Payload точки МАЄ містити рядкові `collection_id` і `document_id` (за ними фільтрація/ACL).
Семантика SearchFilter: None → без обмеження; [] → нічого не доступно → порожній результат.
`ensure()` викликайте при старті ingestion-воркера (і API, якщо є пошук).
"""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from app.rag.domain.ports import ScoredPoint, SearchFilter, SparseVector, VectorPoint
from app.rag.errors import DimensionMismatchError, ProviderError
from app.rag.settings import VectorSettings

from ._http import secret

DENSE, SPARSE = "dense", "sparse"
_DISTANCE = {"cosine": models.Distance.COSINE, "dot": models.Distance.DOT, "euclid": models.Distance.EUCLID}
_UPSERT_BATCH = 256


@contextmanager
def _guard() -> Iterator[None]:
    """Постійні 4xx → ProviderError; 429/5xx/мережа проходять як є (тимчасові → retry)."""
    try:
        yield
    except UnexpectedResponse as e:
        status_code = e.status_code
        if status_code is not None and 400 <= status_code < 500 and status_code != 429:
            raise ProviderError(f"qdrant {status_code}: {str(e.content)[:300]}") from e
        raise


class QdrantStore:
    def __init__(self, cfg: VectorSettings) -> None:
        self.cfg = cfg
        self.name = f"{cfg.collection_prefix}_chunks"
        self._c = AsyncQdrantClient(url=cfg.qdrant_url, api_key=secret(cfg.qdrant_api_key),
                                    prefer_grpc=cfg.qdrant_prefer_grpc)
        self._lock = asyncio.Lock()
        self._ready: tuple[int, bool] | None = None

    # ---- schema ----------------------------------------------------------------

    async def ensure(self, dim: int, *, sparse: bool) -> None:
        async with self._lock:
            if self._ready == (dim, sparse):
                return
            with _guard():
                if not await self._c.collection_exists(self.name):
                    try:
                        await self._c.create_collection(
                            self.name,
                            vectors_config={DENSE: models.VectorParams(
                                size=dim, distance=_DISTANCE[self.cfg.distance])},
                            sparse_vectors_config=(
                                {SPARSE: models.SparseVectorParams(modifier=models.Modifier.IDF)}
                                if sparse else None),
                            hnsw_config=models.HnswConfigDiff(
                                m=self.cfg.hnsw_m, ef_construct=self.cfg.hnsw_ef_construct))
                    except UnexpectedResponse as e:
                        if e.status_code != 409:          # гонка: створив інший процес
                            raise
                await self._verify(dim, sparse)
                for field in ("collection_id", "document_id"):
                    await self._c.create_payload_index(
                        self.name, field, models.PayloadSchemaType.KEYWORD)
            self._ready = (dim, sparse)

    async def _verify(self, dim: int, sparse: bool) -> None:
        params = (await self._c.get_collection(self.name)).config.params
        vectors = params.vectors if isinstance(params.vectors, dict) else {}
        if DENSE not in vectors:
            raise ProviderError(f"collection {self.name!r} has no named vector {DENSE!r}")
        if vectors[DENSE].size != dim:
            raise DimensionMismatchError(
                f"collection {self.name!r} has dim={vectors[DENSE].size}, embedding.dim={dim}; "
                "змініть модель/dim або створіть нову колекцію (collection_prefix)")
        if sparse and SPARSE not in (params.sparse_vectors or {}):
            raise ProviderError(f"collection {self.name!r} was created without sparse vectors")

    # ---- write -----------------------------------------------------------------

    async def upsert(self, points: Sequence[VectorPoint]) -> None:
        for i in range(0, len(points), _UPSERT_BATCH):
            batch = []
            for p in points[i:i + _UPSERT_BATCH]:
                vec: dict = {DENSE: p.dense}
                if p.sparse is not None:
                    vec[SPARSE] = models.SparseVector(indices=p.sparse.indices, values=p.sparse.values)
                batch.append(models.PointStruct(id=p.id, vector=vec, payload=p.payload))
            with _guard():
                await self._c.upsert(self.name, points=batch, wait=True)

    async def _delete(self, flt: models.Filter) -> int:
        with _guard():
            n = (await self._c.count(self.name, count_filter=flt, exact=True)).count
            if n:
                await self._c.delete(self.name, points_selector=models.FilterSelector(filter=flt), wait=True)
        return n

    async def delete_stale(self, document_id: str, keep_ids: Sequence[str]) -> int:
        return await self._delete(models.Filter(
            must=[models.FieldCondition(key="document_id", match=models.MatchValue(value=document_id))],
            must_not=[models.HasIdCondition(has_id=list(keep_ids))] if keep_ids else None))

    async def delete_document(self, document_id: str) -> int:
        return await self.delete_stale(document_id, [])

    # ---- search ----------------------------------------------------------------

    @staticmethod
    def _filter(flt: SearchFilter | None) -> models.Filter | None:
        if flt is None:
            return None

        must: list[models.Condition] = []

        for key, values in (
            ("collection_id", flt.collection_ids),
            ("document_id", flt.document_ids),
        ):
            if values:
                must.append(
                    models.FieldCondition(
                        key=key,
                        match=models.MatchAny(
                            any=[str(value) for value in values],
                        ),
                    )
                )

        return models.Filter(must=must) if must else None

    @staticmethod
    def _denied(flt: SearchFilter | None) -> bool:
        return flt is not None and (flt.collection_ids == [] or flt.document_ids == [])

    async def _search(
        self,
        query: Any,
        using: str,
        limit: int,
        flt: SearchFilter | None,
    ) -> list[ScoredPoint]:
        if self._denied(flt):
            return []
        with _guard():
            res = await self._c.query_points(self.name, query=query, using=using, limit=limit,
                                             query_filter=self._filter(flt), with_payload=True)
        return [ScoredPoint(id=str(p.id), score=p.score, payload=p.payload or {}) for p in res.points]

    async def search_dense(self, vector: Sequence[float], limit: int,
                           flt: SearchFilter | None = None) -> list[ScoredPoint]:
        return await self._search(list(vector), DENSE, limit, flt)

    async def search_sparse(self, vector: SparseVector, limit: int,
                            flt: SearchFilter | None = None) -> list[ScoredPoint]:
        return await self._search(models.SparseVector(indices=vector.indices, values=vector.values),
                                  SPARSE, limit, flt)

    async def aclose(self) -> None:
        await self._c.close()
