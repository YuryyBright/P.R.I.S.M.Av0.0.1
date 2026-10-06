"""RAG settings. Ізольовані від settings RBAC: префікс RAG_, вкладені групи через "__".

Приклад: RAG_VECTOR__BACKEND=qdrant, RAG_LLM__MODEL=Qwen/Qwen2.5-7B-Instruct

ІНВАРІАНТ: значення Literal у полях `backend` == ключі container._REGISTRY[kind]
(перевіряє tests/rag/test_registry_consistency.py). Додаєте бекенд — додайте в обидва місця.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class VectorSettings(BaseModel):
    backend: Literal["qdrant"] = "qdrant"
    collection_prefix: str = "rag"
    distance: Literal["cosine", "dot", "euclid"] = "cosine"

    # Qdrant
    # Default for FastAPI running directly on the host.
    # Docker deployment can override this with:
    # RAG_VECTOR__QDRANT_URL=http://prisma_qdrant_dev:6333
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: SecretStr | None = None
    qdrant_prefer_grpc: bool = False

    # Qdrant HNSW index configuration
    hnsw_m: int = 16
    hnsw_ef_construct: int = 128

    # pgvector
    pgvector_schema: str = "rag"


class EmbeddingSettings(BaseModel):
    backend: Literal["vllm"] = "vllm"
    model: str = "BAAI/bge-m3"
    dim: int = Field(1024, gt=0)                      # МАЄ збігатися з моделлю
    batch_size: int = Field(64, gt=0)
    api_base: str | None = "http://vllm-embed:8000/v1"
    api_key: SecretStr | None = None
    timeout_s: float = 30.0
    # sparse (для hybrid)
    sparse_enabled: bool = False
    sparse_backend: Literal["none"] = "none"
    sparse_model: str = "Qdrant/bm25"


class LLMSettings(BaseModel):
    backend: Literal["vllm"] = "vllm"
    model: str = "Qwen/Qwen2.5-7B-Instruct"           # назва, з якою запущено vLLM
    api_base: str | None = "http://vllm:8000/v1"
    api_key: SecretStr | None = None
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    max_output_tokens: int = Field(1024, gt=0)
    timeout_s: float = 60.0
    max_retries: int = 2


class RerankerSettings(BaseModel):
    """
    Configuration for RAG reranking.

    Supported backends:
    - none — reranking disabled;
    - api — HTTP rerank-compatible API;
    - bge — local BGE reranker;
    - fake — test/development backend.
    """

    backend: Literal["none", "api", "bge", "fake"] = "none"
    model: str = "BAAI/bge-reranker-v2-m3"
    api_base: str | None = None
    api_key: SecretStr | None = None
    top_k: int = Field(8, gt=0)
    timeout_s: float = Field(
        30.0,
        gt=0,
    )
    max_retries: int = Field(
        2,
        ge=0,
    )


class RetrievalSettings(BaseModel):
    dense_top_k: int = Field(40, gt=0)
    sparse_top_k: int = Field(40, gt=0)
    fused_top_n: int = Field(30, gt=0)
    rrf_k: int = Field(60, gt=0)
    min_score: float | None = None
    max_context_tokens: int = Field(6000, gt=0)


class ChunkingSettings(BaseModel):
    strategy: Literal["heading_aware", "token_window"] = "heading_aware"
    target_tokens: int = Field(400, gt=0)
    max_tokens: int = Field(600, gt=0)
    overlap_tokens: int = Field(60, ge=0)
    # змінюється при зміні логіки чанкінгу -> потрапляє в chunk_id
    version: str = "v1"

    @model_validator(mode="after")
    def _check(self) -> "ChunkingSettings":
        if self.overlap_tokens >= self.target_tokens:
            raise ValueError("overlap_tokens must be < target_tokens")
        if self.target_tokens > self.max_tokens:
            raise ValueError("target_tokens must be <= max_tokens")
        return self


class StorageSettings(BaseModel):
    backend: Literal["local"] = "local"
    local_root: Path = Path("/data/rag_blobs")
    s3_endpoint: str | None = None
    s3_bucket: str = "rag-documents"
    s3_region: str | None = None
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None


class IngestionSettings(BaseModel):
    """Єдине джерело для черги, retry і перепостановки (tasks.py/dispatch.py читають звідси).
    Time-limit-и етапів задані в декораторах задач."""
    queue: str = "rag_ingestion"
    max_file_mb: int = Field(50, gt=0)
    allowed_mime: list[str] = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/html",
        "application/xhtml+xml",
        "application/json",
        "application/x-ndjson",
    ]
    task_max_retries: int = Field(3, ge=0)
    retry_backoff_s: int = Field(30, gt=0)
    # перепостановка job-ів, чий dispatch впав (QUEUED без celery_task_id)
    redispatch_interval_s: int = Field(60, gt=0)
    redispatch_min_age_s: int = Field(60, ge=0)       # не чіпати щойно створені
    cleanup_sweep_interval_s: int = Field(300, gt=0)
    cleanup_min_age_s: int = Field(300, ge=0)


class ChatSettings(BaseModel):
    max_history_turns: int = Field(6, ge=0)
    citation_retry: int = Field(1, ge=0, le=3)
    refusal_message: str = "Недостатньо даних у доступних джерелах для відповіді."


class RagSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RAG_",
        env_nested_delimiter="__",
        env_file=".env",
        extra="ignore",
    )

    enabled: bool = True
    vector: VectorSettings = VectorSettings()
    embedding: EmbeddingSettings = EmbeddingSettings()
    llm: LLMSettings = LLMSettings()
    reranker: RerankerSettings = RerankerSettings()
    retrieval: RetrievalSettings = RetrievalSettings()
    chunking: ChunkingSettings = ChunkingSettings()
    storage: StorageSettings = StorageSettings()
    ingestion: IngestionSettings = IngestionSettings()
    chat: ChatSettings = ChatSettings()

    @model_validator(mode="after")
    def _cross_checks(self) -> "RagSettings":
        if not self.enabled:
            return self
        if self.retrieval.fused_top_n < self.reranker.top_k:
            raise ValueError("retrieval.fused_top_n must be >= reranker.top_k")
        for name, cfg in (("EMBEDDING", self.embedding), ("LLM", self.llm)):
            if cfg.backend == "vllm" and not cfg.api_base:
                raise ValueError(f"RAG_{name}__API_BASE is required for backend 'vllm'")
        return self


@lru_cache
def get_rag_settings() -> RagSettings:
    return RagSettings()