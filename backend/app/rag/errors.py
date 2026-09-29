"""Класифікація помилок. Celery-таска ретраїть лише TransientError."""


class RagError(Exception):
    pass


class TransientError(RagError):
    """Тимчасова: мережа, 429/5xx від vLLM, таймаут. -> retry з backoff."""


class PermanentError(RagError):
    """Ретрай не допоможе. -> статус failed."""


class UnsupportedMimeError(PermanentError):
    pass


class CorruptDocumentError(PermanentError):
    pass


class EncryptedDocumentError(PermanentError):
    pass


class ScannedPdfError(PermanentError):
    """PDF без текстового шару (потрібен OCR — окрема фаза)."""


class EmptyDocumentError(PermanentError):
    pass


class ProviderError(PermanentError):
    """4xx від LLM/embedding провайдера (невірна модель, схема, запит)."""
