"""Contracts for large-volume, evidence-first analysis.

The key distinction from ordinary RAG is that a bulk analysis has an explicit
coverage contract: selected documents are enumerated first, then processed in
bounded batches. A semantic search alone is never presented as exhaustive.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID


@dataclass(frozen=True, slots=True)
class DocumentRef:
    id: UUID
    collection_id: UUID
    title: str
    version: str | None = None


@dataclass(frozen=True, slots=True)
class AnalysisRequest:
    instruction: str
    analysis_id: UUID | None = None
    collection_ids: tuple[UUID, ...] | None = None
    document_ids: tuple[UUID, ...] | None = None
    focus: tuple[str, ...] = ()
    report_template: str = "executive_markdown"
    exhaustive: bool = True
    web_enabled: bool = False
    max_documents: int = 5000
    batch_size: int = 8
    item_retries: int = 2


@dataclass(frozen=True, slots=True)
class Finding:
    title: str
    severity: Literal["info", "low", "medium", "high", "critical"] = "info"
    summary: str = ""
    evidence: tuple[str, ...] = ()
    document_ids: tuple[UUID, ...] = ()
    confidence: float | None = None
    tags: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class BatchResult:
    batch_id: str
    document_ids: tuple[UUID, ...]
    findings: tuple[Finding, ...] = ()
    notes: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()


@dataclass(slots=True)
class AnalysisProgress:
    total_documents: int = 0
    completed_documents: int = 0
    total_batches: int = 0
    completed_batches: int = 0
    findings: int = 0
    errors: int = 0

    @property
    def coverage(self) -> float:
        if self.total_documents == 0:
            return 1.0
        return self.completed_documents / self.total_documents


@dataclass(frozen=True, slots=True)
class AnalysisResult:
    request: AnalysisRequest
    findings: tuple[Finding, ...]
    report: str
    analyzed_documents: tuple[DocumentRef, ...]
    failed_documents: tuple[UUID, ...] = ()
    web_sources: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)
