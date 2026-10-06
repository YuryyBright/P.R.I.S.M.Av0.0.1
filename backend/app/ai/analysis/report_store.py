"""Artifact storage boundary for generated reports."""
from __future__ import annotations
from typing import Protocol
from uuid import UUID

class ReportStore(Protocol):
    async def save(self, *, owner_id: UUID, filename: str, content: str, content_type: str) -> str: ...
