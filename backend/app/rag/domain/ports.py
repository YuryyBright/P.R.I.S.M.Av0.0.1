"""Порти (Protocol-и) RAG-підсистеми. Адаптери реалізують їх, stage-и залежать лише від них.

Домовленість про помилки адаптерів:
  * постійні (4xx від провайдера, невірна модель/розмірність) → app.rag.errors.ProviderError
    (job стає FAILED без retry);
  * тимчасові (мережа, 429/5xx, таймаут) → будь-яке інше виключення (httpx.HTTPError тощо):
    Celery зробить retry з backoff.
"""
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Protocol, Sequence



# ---- embeddings --------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class SparseVector:
    indices: list[int]
    values: list[float]


class Embedder(Protocol):
    model: str
    dim: int

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        """Рівно len(texts) векторів довжини `dim`, у тому ж порядку."""
        ...


class SparseEmbedder(Protocol):
    async def embed(self, texts: Sequence[str]) -> list[SparseVector]: ...


# ---- vector store ------------------------------------------------------------

@dataclass(slots=True)
class VectorPoint:
    id: str                              # = DocumentChunk.id (uuid str)
    dense: list[float]
    sparse: SparseVector | None = None
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ScoredPoint:
    id: str
    score: float
    payload: dict[str, Any]


@dataclass(slots=True)
class SearchFilter:
    """Обмеження пошуку. ACL (які колекції доступні) обчислює retrieval-шар."""
    collection_ids: list[str] | None = None
    document_ids: list[str] | None = None


class VectorStore(Protocol):
    async def ensure(self, dim: int, *, sparse: bool) -> None:
        """Ідемпотентно створити колекцію/індекс (dense `dim`, опційно sparse)."""
        ...

    async def upsert(self, points: Sequence[VectorPoint]) -> None: ...

    async def delete_stale(self, document_id: str, keep_ids: Sequence[str]) -> int:
        """Видалити точки документа, яких немає в keep_ids (після перечанкінгу)."""
        ...

    async def delete_document(self, document_id: str) -> int: ...

    async def search_dense(self, vector: Sequence[float], limit: int,
                           flt: SearchFilter | None = None) -> list[ScoredPoint]: ...

    async def search_sparse(self, vector: SparseVector, limit: int,
                            flt: SearchFilter | None = None) -> list[ScoredPoint]: ...


# ---- blob storage ------------------------------------------------------------

class BlobStorage(Protocol):
    def size(self, path: str) -> int: ...

    def read_bytes(self, path: str) -> bytes: ...

    def write_bytes(self, path: str, data: bytes) -> None: ...


# ---- LLM / reranker (заготовки до фази Chat; контракт уточнюється там) ------------

class LLMProvider(Protocol):
    async def generate(self, messages: list[dict[str, str]]) -> str: ...
    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...


class Reranker(Protocol):
    async def rerank(self, query: str, documents: Sequence[str], top_k: int) -> list[tuple[int, float]]:
        """[(індекс у documents, score)] за спаданням score."""
        ...