from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Awaitable, Callable, Literal, Protocol, Sequence
from uuid import UUID
from .domain import StageKind
from .events import TaskEvent

DataSourceType = Literal["document", "file", "collection", "rag_collection"]
SUPPORTED_DATA_SOURCE_TYPES: tuple[DataSourceType, ...] = (
    "document",
    "file",
    "collection",
    "rag_collection",
)

@dataclass(frozen=True, slots=True)
class DataSourceRef:
    type: DataSourceType
    id: str
    metadata: dict[str, Any] = field(default_factory=dict)

class DatasetReader(Protocol):
    async def count(self) -> int: ...
    def iter_items(self, *, batch_size: int) -> AsyncIterator[dict[str, Any]]: ...

class DataSource(Protocol):
    ref: DataSourceRef
    async def open(self, user: Any) -> DatasetReader: ...

class DataSourceResolver(Protocol):
    async def resolve(self, user: Any, sources: Sequence[DataSourceRef]) -> list[DataSource]: ...

class ArtifactStore(Protocol):
    async def save(self, *, owner_id: UUID, task_id: UUID, name: str, content: bytes,
                   mime_type: str, metadata: dict[str, Any] | None = None) -> str: ...
    async def delete(self, storage_key: str) -> None: ...

class TaskEventBus(Protocol):
    async def publish(self, task_id: UUID, event: TaskEvent) -> str: ...
    def subscribe(self, task_id: UUID, last_id: str | None = None, *, keepalive_s: float = 15.0) -> AsyncIterator[tuple[str, TaskEvent] | None]: ...
    async def finish(self, task_id: UUID) -> None: ...
    async def exists(self, task_id: UUID) -> bool: ...
    async def aclose(self) -> None: ...

@dataclass(slots=True)
class TaskProgressState:
    stage: StageKind | None = None
    processed: int = 0
    total: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    percent: float = 0.0
    current_operation: str | None = None

@dataclass(slots=True)
class TaskContext:
    task_id: UUID
    user: Any
    instruction: str
    config: dict[str, Any]
    sources: tuple[DataSourceRef, ...]
    progress: TaskProgressState
    checkpoint: dict[str, Any]
    cancellation_requested: Callable[[], Awaitable[bool]]
    emit: Callable[[TaskEvent], Awaitable[None]]

class TaskHandler(Protocol):
    task_type: str
    async def execute(self, ctx: TaskContext) -> list[dict[str, Any]]: ...

class TaskExecutionAdapter(Protocol):
    async def dispatch(self, task_id: UUID) -> str | None: ...


class TaskCancelStore(Protocol):
    async def request(self, task_id: UUID) -> None: ...
    async def requested(self, task_id: UUID) -> bool: ...
    async def clear(self, task_id: UUID) -> None: ...
