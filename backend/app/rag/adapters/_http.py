"""Спільні HTTP-хелпери адаптерів. Реалізує домовленість з domain/ports.py:
постійні 4xx → ProviderError (без retry), решта (429/5xx/мережа) → httpx-виключення (retry)."""
from __future__ import annotations

import httpx
from pydantic import SecretStr

from app.rag.errors import ProviderError

_TRANSIENT_4XX = {408, 409, 425, 429}


def secret(v: SecretStr | None) -> str | None:
    return v.get_secret_value() if v else None


def make_client(base_url: str, api_key: str | None, timeout_s: float, retries: int = 0) -> httpx.AsyncClient:
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    return httpx.AsyncClient(
        base_url=base_url.rstrip("/") + "/",          # відносні шляхи: "embeddings", "chat/completions"
        headers=headers,
        timeout=timeout_s,
        transport=httpx.AsyncHTTPTransport(retries=retries),   # лише помилки з'єднання
    )


def check(resp: httpx.Response) -> None:
    if 400 <= resp.status_code < 500 and resp.status_code not in _TRANSIENT_4XX:
        raise ProviderError(f"provider returned {resp.status_code}: {resp.text[:300]}")
    resp.raise_for_status()