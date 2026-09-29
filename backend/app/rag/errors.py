"""Помилки ingestion-парсингу.

ParseError і нащадки — ПОСТІЙНІ: файл зіпсований/непідтримуваний/завеликий,
повтор нічого не змінить, тому Celery-задача їх НЕ ретраїть, а позначає job
як failed із `error_code`. Усе інше (I/O, БД) вважається тимчасовим.

(Назва ParseError історична: базовий клас усіх постійних помилок pipeline,
у тому числі етапів embed/index.)
"""

from typing import Any


class ParseError(Exception):
    code: str = "parse_failed"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details or {}


class UnsupportedFormatError(ParseError):
    code = "unsupported_format"


class CorruptFileError(ParseError):
    code = "corrupt_file"


class EncryptedFileError(ParseError):
    code = "encrypted_file"


class EmptyContentError(ParseError):
    code = "empty_content"


class LimitExceededError(ParseError):
    code = "limit_exceeded"


class MissingFileError(ParseError):
    code = "missing_file"


# ---- embed / index -----------------------------------------------------------


class ProviderError(ParseError):
    """4xx від embedding-провайдера / vector store: невірна модель, схема, запит."""

    code = "provider_error"


class DimensionMismatchError(ProviderError):
    """Розмірність вектора не збігається з embedding.dim / схемою колекції."""

    code = "embedding_dim_mismatch"