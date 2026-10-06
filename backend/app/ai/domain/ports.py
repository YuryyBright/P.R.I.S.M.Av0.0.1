"""Порти AI-підсистеми. domain не імпортує нічого, крім stdlib/pydantic (типи LLM/retrieval —
лише під TYPE_CHECKING)."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, AsyncIterator, Protocol
from uuid import UUID

from .records import AnyEvent, ExecutorOutput
from uuid import UUID

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Protocol
if TYPE_CHECKING:
    from app.ai.llm.types import ChatRequest, LLMEvent, LLMResult
    from app.ai.runtime.context import RunContext


class LLMClient(Protocol):
    async def complete(self, req: "ChatRequest") -> "LLMResult": ...

    def stream(self, req: "ChatRequest") -> AsyncIterator["LLMEvent"]: ...


class EventBus(Protocol):
    """Лог подій run-а з можливістю дочитування (Last-Event-ID)."""

    async def publish(self, run_id: UUID, event: AnyEvent) -> str: ...

    def subscribe(self, run_id: UUID, last_id: str | None = None, *,
                  keepalive_s: float = 15.0) -> AsyncIterator["tuple[str, AnyEvent] | None"]:
        """Віддає (id, event); None — keepalive-тік. Завершується після run.finished."""
        ...

    async def finish(self, run_id: UUID) -> None:
        """Run завершено: виставити TTL на стрім."""
        ...

    async def exists(self, run_id: UUID) -> bool: ...

    async def aclose(self) -> None: ...


class CancelStore(Protocol):
    async def request(self, run_id: UUID) -> None: ...

    async def is_requested(self, run_id: UUID) -> bool: ...


class RunLauncher(Protocol):
    async def dispatch(self, run_id: UUID) -> None: ...


class Executor(Protocol):
    def run(self, ctx: "RunContext") -> AsyncIterator[ExecutorOutput]: ...


class Tool(Protocol):
    name: str
    description: str
    args_model: type
    risk: Any   # ToolRisk

    async def run(self, ctx: "RunContext", args: Any) -> Any: ...   # -> ToolOutput


@dataclass(slots=True)
class SearchFilter:
    """Обмеження пошуку. ACL обчислює retrieval-шар."""
    collection_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None