"""Dense-ембединги через OpenAI-сумісний /v1/embeddings (vLLM або будь-який сумісний API)."""
from __future__ import annotations

from typing import Sequence

from app.rag.errors import DimensionMismatchError, ProviderError
from app.rag.settings import EmbeddingSettings

from ._http import check, make_client, secret


class VLLMEmbedder:
    def __init__(self, cfg: EmbeddingSettings) -> None:
        if not cfg.api_base:
            raise ValueError("RAG_EMBEDDING__API_BASE is required for embedding backend 'vllm'")
        self.model, self.dim, self._batch = cfg.model, cfg.dim, cfg.batch_size
        self._client = make_client(cfg.api_base, secret(cfg.api_key), cfg.timeout_s, retries=2)

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), self._batch):
            out.extend(await self._embed_batch(list(texts[i:i + self._batch])))
        return out

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        resp = await self._client.post("embeddings", json={"model": self.model, "input": batch})
        check(resp)
        data = sorted(resp.json()["data"], key=lambda d: d["index"])
        vectors = [d["embedding"] for d in data]
        if len(vectors) != len(batch):
            raise ProviderError(f"expected {len(batch)} embeddings, got {len(vectors)}")
        for v in vectors:
            if len(v) != self.dim:
                raise DimensionMismatchError(
                    f"model {self.model!r} returned dim={len(v)}, RAG_EMBEDDING__DIM={self.dim}")
        return vectors

    async def aclose(self) -> None:
        await self._client.aclose()