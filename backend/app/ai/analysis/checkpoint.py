"""Checkpoint port for resumable long-running analysis."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class AnalysisCheckpoint:
    analysis_id: UUID
    completed_document_ids: tuple[UUID, ...]
    completed_batch_ids: tuple[str, ...]


class CheckpointStore(Protocol):
    async def load(self, analysis_id: UUID) -> AnalysisCheckpoint | None: ...
    async def save(self, checkpoint: AnalysisCheckpoint) -> None: ...
