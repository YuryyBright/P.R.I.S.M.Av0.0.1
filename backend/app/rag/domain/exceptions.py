"""Доменні винятки RAG: сервіси кидають їх, HTTP-коди призначає лише handler у API-шарі."""
from typing import Any


class DomainError(Exception):
    status_code: int = 400
    code: str = "error"

    def __init__(self, detail: str, *, extra: dict[str, Any] | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.extra = extra or {}


class NotFoundError(DomainError):
    status_code, code = 404, "not_found"


class ForbiddenError(DomainError):
    status_code, code = 403, "forbidden"


class ConflictError(DomainError):
    status_code, code = 409, "conflict"


class PayloadTooLargeError(DomainError):
    status_code, code = 413, "file_too_large"


class UnsupportedMediaError(DomainError):
    status_code, code = 415, "unsupported_media_type"


class InvalidInputError(DomainError):
    status_code, code = 422, "invalid_input"