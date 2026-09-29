"""DI-контейнер: єдине місце, де конфіг перетворюється на адаптери.

Компоненти створюються ліниво (cached_property): ingestion не вимагає reranker/LLM,
а чат — blob storage. Нові провайдери додаються через register().
"""
from __future__ import annotations

from functools import cached_property
from importlib import import_module
from typing import Any

from .ports import BlobStorage, Embedder, LLMProvider, Reranker, SparseEmbedder, VectorStore
from .settings import RagSettings, get_rag_settings

_REGISTRY: dict[str, dict[str, str]] = {
    "vector": {
        "qdrant": "app.rag.adapters.qdrant_store:QdrantStore",  # Фаза 4
        "pgvector": "app.rag.adapters.pgvector_store:PgVectorStore",  # Фаза 4
    },
    "embedding": {
        "vllm": "app.rag.adapters.vllm_embedder:VLLMEmbedder",
        "fake": "app.rag.adapters.fakes:FakeEmbedder",
    },
    "sparse": {"bm25": "app.rag.adapters.bm25_sparse:BM25Sparse"},  # Фаза 5
    "llm": {
        "vllm": "app.rag.adapters.vllm_llm:VLLMProvider",
        "fake": "app.rag.adapters.fakes:FakeLLM",
    },
    "reranker": {"bge": "app.rag.adapters.bge_reranker:BGEReranker"},  # Фаза 5
    "storage": {
        "local": "app.rag.adapters.local_blob:LocalBlobStorage",
        "s3": "app.rag.adapters.s3_blob:S3BlobStorage",
    },
}


def register(kind: str, name: str, path: str) -> None:
    _REGISTRY.setdefault(kind, {})[name] = path


def _load(kind: str, name: str, cfg: Any) -> Any:
    try:
        module, cls = _REGISTRY[kind][name].split(":")
    except KeyError as e:
        raise ValueError(f"Unknown {kind} backend: {name!r}") from e
    return getattr(import_module(module), cls)(cfg)


class RagContainer:
    def __init__(self, settings: RagSettings | None = None) -> None:
        self.settings = settings or get_rag_settings()

    @cached_property
    def vector_store(self) -> VectorStore:
        return _load("vector", self.settings.vector.backend, self.settings.vector)

    @cached_property
    def embedder(self) -> Embedder:
        return _load("embedding", self.settings.embedding.backend, self.settings.embedding)

    @cached_property
    def sparse(self) -> SparseEmbedder | None:
        e = self.settings.embedding
        return _load("sparse", e.sparse_backend, e) if e.sparse_enabled else None

    @cached_property
    def llm(self) -> LLMProvider:
        return _load("llm", self.settings.llm.backend, self.settings.llm)

    @cached_property
    def reranker(self) -> Reranker | None:
        r = self.settings.reranker
        return None if r.backend == "none" else _load("reranker", r.backend, r)

    @cached_property
    def blobs(self) -> BlobStorage:
        return _load("storage", self.settings.storage.backend, self.settings.storage)

    async def aclose(self) -> None:
        """Закрити лише ті компоненти, що вже були створені."""
        for name in ("vector_store", "embedder", "sparse", "llm", "reranker", "blobs"):
            comp = self.__dict__.get(name)
            close = getattr(comp, "aclose", None)
            if close is not None:
                await close()


def build_container(settings: RagSettings | None = None) -> RagContainer:
    return RagContainer(settings)


_container: RagContainer | None = None


def get_container() -> RagContainer:
    """FastAPI dependency (API-процес). У Celery використовуйте build_container()."""
    global _container
    if _container is None:
        _container = RagContainer()
    return _container
