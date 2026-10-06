"""HTTP adapter для rerank-compatible API.

Працює з API формату:

    POST /rerank

Request:
    {
        "model": "...",
        "query": "...",
        "documents": ["...", "..."],
        "top_n": 5
    }

Response:
    {
        "results": [
            {
                "index": 0,
                "relevance_score": 0.91
            }
        ]
    }

Adapter не реалізує retry/error-policy самостійно.
Це централізовано робить adapters._http.
"""

from __future__ import annotations

from typing import Any, Sequence

from app.rag.errors import ProviderError
from app.rag.settings import RerankerSettings

from ._http import check, make_client, secret


class HTTPReranker:
    """Reranker через OpenAI/Cohere/Jina/Voyage-сумісний HTTP API."""

    def __init__(self, cfg: RerankerSettings) -> None:
        if not cfg.api_base:
            raise ValueError(
                "RAG_RERANKER__API_BASE is required "
                "for reranker backend 'api'"
            )

        self.cfg = cfg

        self._client = make_client(
            base_url=cfg.api_base,
            api_key=secret(cfg.api_key),
            timeout_s=cfg.timeout_s,
            retries=cfg.max_retries,
        )

    def _body(
        self,
        query: str,
        documents: Sequence[str],
        top_k: int,
    ) -> dict[str, Any]:
        return {
            "model": self.cfg.model,
            "query": query,
            "documents": list(documents),
            "top_n": min(top_k, len(documents)),
        }

    @staticmethod
    def _parse_results(data: dict[str, Any]) -> list[tuple[int, float]]:
        results = data.get("results")

        if not isinstance(results, list):
            raise ProviderError(
                "reranker response does not contain a valid 'results' list"
            )

        pairs: list[tuple[int, float]] = []

        for result in results:
            if not isinstance(result, dict):
                raise ProviderError(
                    "reranker response contains invalid result item"
                )

            try:
                index = int(result["index"])
            except (KeyError, TypeError, ValueError) as exc:
                raise ProviderError(
                    "reranker result is missing a valid 'index'"
                ) from exc

            raw_score = result.get(
                "relevance_score",
                result.get("score"),
            )

            if raw_score is None:
                raise ProviderError(
                    "reranker result is missing 'relevance_score'/'score'"
                )

            try:
                score = float(raw_score)
            except (TypeError, ValueError) as exc:
                raise ProviderError(
                    f"invalid reranker score: {raw_score!r}"
                ) from exc

            pairs.append((index, score))

        return sorted(
            pairs,
            key=lambda pair: pair[1],
            reverse=True,
        )

    async def rerank(
        self,
        query: str,
        documents: Sequence[str],
        top_k: int,
    ) -> list[tuple[int, float]]:
        if top_k <= 0 or not documents:
            return []

        top_k = min(top_k, len(documents))

        response = await self._client.post(
            "rerank",
            json=self._body(
                query=query,
                documents=documents,
                top_k=top_k,
            ),
        )

        check(response)

        return self._parse_results(response.json())

    async def aclose(self) -> None:
        await self._client.aclose()