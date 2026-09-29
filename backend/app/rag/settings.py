"""RAG settings. Ізольовані від settings RBAC: префікс RAG_, вкладені групи через "__".

Приклад: RAG_VECTOR__BACKEND=qdrant, RAG_LLM__MODEL=gpt-4o-mini
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class VectorSettings(BaseModel):
    backend: Literal["qdrant", "pgvector"] = "qdrant"
    collection_prefix: str = "rag"
    distance: Literal["cosine", "dot", "euclid"] = "cosine"
    # qdrant
    qdrant_url: str = "http://qdrant:6333"
    qdrant_api_key: SecretStr | None = None
    qdrant_prefer_grpc: bool = False
    hnsw_m: int = 16
    hnsw_ef_construct: int = 128
    # pgvector
    pgvector_schema: str = "rag"


class EmbeddingSettings(BaseModel):
    backend: Literal["litellm", "sentence_transformers", "fake"] = "litellm"
    model: str = "text-embedding-3-small"
    dim: int = Field(1536, gt=0)
    batch_size: int = Field(64, gt=0)
    api_base: str | None = None
    api_key: SecretStr | None = None
    timeout_s: float = 30.0
    # sparse (для hybrid)
    sparse_enabled: bool = True
    sparse_backend: Literal["bm25", "splade", "fake"] = "bm25"
    sparse_model: str = "Qdrant/bm25"


class LLMSettings(BaseModel):
    backend: Literal["litellm", "vllm", "fake"] = "litellm"
    model: str = "gpt-4o-mini"
    api_base: str | None = None  # напр. http://vllm:8000/v1
    api_key: SecretStr | None = None
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    max_output_tokens: int = Field(1024, gt=0)
    timeout_s: float = 60.0
    max_retries: int = 2


class RerankerSettings(BaseModel):
    # Додано "api" як один з варіантів бекенду
    backend: Literal["none", "bge", "cohere", "api", "fake"] = "none"
    model: str = "BAAI/bge-reranker-v2-m3"
    api_base: str | None = None  # Додано для підтримки зовнішніх API або локальних endpoint-ів
    api_key: SecretStr | None = None
    top_k: int = Field(8, gt=0)


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
    backend: Literal["local", "s3"] = "local"
    local_root: Path = Path("/data/rag_blobs")
    s3_endpoint: str | None = None
    s3_bucket: str = "rag-documents"
    s3_region: str | None = None
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None


class IngestionSettings(BaseModel):
    queue: str = "ingestion"
    max_file_mb: int = Field(50, gt=0)
    allowed_mime: list[str] = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    task_max_retries: int = 3
    retry_backoff_s: int = 30
    task_time_limit_s: int = 900


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
        if self.storage.backend == "s3" and not (
            self.storage.s3_access_key and self.storage.s3_secret_key
        ):
            raise ValueError("S3 storage requires access/secret keys")
        if self.retrieval.fused_top_n < self.reranker.top_k:
            raise ValueError("retrieval.fused_top_n must be >= reranker.top_k")
        return self


@lru_cache
def get_rag_settings() -> RagSettings:
    return RagSettings()