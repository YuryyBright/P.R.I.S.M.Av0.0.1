"""Винятки AI-підсистеми. Нащадки rag DomainError → той самий HTTP-handler."""
from app.rag.domain.exceptions import (  # noqa: F401  (re-export для зручності)
    ConflictError, DomainError, ForbiddenError, InvalidInputError, NotFoundError,
)


class AiError(DomainError):
    code = "ai_error"


class RunNotFoundError(NotFoundError):
    code = "run_not_found"


class ConversationBusyError(ConflictError):
    """У діалозі вже є активний run."""
    code = "conversation_busy"


class ModelNotAvailableError(InvalidInputError):
    code = "model_not_available"


class PromptNotFoundError(NotFoundError):
    code = "prompt_not_found"


class RunCancelled(Exception):
    """Сигнал виконавцю/раннеру: run скасовано користувачем (не помилка)."""


class BudgetExceeded(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class ToolError(Exception):
    """Очікувана помилка інструмента: текст піде моделі як tool-result (ok=False)."""
