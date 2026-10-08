"""Orchestrator for exhaustive analysis over 100+ documents.

This is deliberately separate from AgentLoop. The agent decides *what* analysis
to run; this service guarantees bounded enumeration, batching, checkpoints and
coverage accounting. It never claims that semantic retrieval was exhaustive.
"""
from __future__ import annotations

import json
import logging
import asyncio
from collections.abc import Sequence
from dataclasses import replace
from typing import Any, Literal, Protocol, cast
from uuid import UUID

from app.ai.analysis.contracts import (
    AnalysisProgress, AnalysisRequest, AnalysisResult, BatchResult, DocumentRef, Finding,
)
from app.ai.analysis.prompts import build_map_prompt, build_reduce_prompt
from app.ai.analysis.reporter import render_executive_markdown
from app.ai.analysis.checkpoint import AnalysisCheckpoint, CheckpointStore

logger = logging.getLogger(__name__)


class DocumentCatalog(Protocol):
    async def list_documents(self, user: Any, *, collection_ids: Sequence[UUID] | None,
                             document_ids: Sequence[UUID] | None, limit: int) -> list[DocumentRef]: ...
    async def read_document_segments(self, user: Any, document_id: UUID, *,
                                     segment_chars: int = 16000) -> list[str]: ...


class AnalysisLLM(Protocol):
    async def complete_json(self, prompt: str) -> dict[str, Any]: ...


class AnalysisOrchestrator:
    def __init__(self, catalog: DocumentCatalog, llm: AnalysisLLM, checkpoint_store: CheckpointStore | None = None) -> None:
        self._catalog = catalog
        self._llm = llm
        self._checkpoints = checkpoint_store

    async def analyze(self, user: Any, request: AnalysisRequest,
                      *, progress: AnalysisProgress | None = None, on_progress: Any | None = None, on_item_failed: Any | None = None) -> AnalysisResult:
        docs = await self._catalog.list_documents(
            user, collection_ids=request.collection_ids, document_ids=request.document_ids,
            limit=request.max_documents)
        if progress is None:
            progress = AnalysisProgress()
        progress.total_documents = len(docs)
        progress.total_batches = (len(docs) + request.batch_size - 1) // request.batch_size

        findings: list[Finding] = []
        failed: list[UUID] = []
        completed: set[UUID] = set()
        if request.analysis_id is not None and self._checkpoints is not None:
            checkpoint = await self._checkpoints.load(request.analysis_id)
            if checkpoint:
                completed.update(checkpoint.completed_document_ids)
        for start in range(0, len(docs), request.batch_size):
            batch = docs[start:start + request.batch_size]
            for doc in batch:
                if doc.id in completed:
                    progress.completed_documents += 1
                    continue
                last_error: Exception | None = None
                for attempt in range(max(1, request.item_retries + 1)):
                    try:
                        segments = await self._catalog.read_document_segments(user, doc.id, segment_chars=16000)
                        for segment_no, text in enumerate(segments):
                            payload = await self._llm.complete_json(
                                build_map_prompt(request, doc, f"[segment {segment_no + 1}/{len(segments)}]\n{text}"))
                            for raw in payload.get("findings", []):
                                findings.append(self._finding(raw, doc.id))
                        last_error = None
                        break
                    except Exception as exc:
                        last_error = exc
                        if attempt < request.item_retries:
                            await asyncio.sleep(min(2 ** attempt, 8))
                if last_error is not None:  # one bad document must not kill 100 others
                    failed.append(doc.id)
                    progress.errors += 1
                    if on_item_failed is not None:
                        await on_item_failed(doc.id, str(last_error), request.item_retries + 1)
                    logger.warning("analysis document failed id=%s: %s", doc.id, last_error)
                progress.completed_documents += 1
                completed.add(doc.id)
                if request.analysis_id is not None and self._checkpoints is not None:
                    await self._checkpoints.save(AnalysisCheckpoint(request.analysis_id, tuple(completed), tuple()))
                if on_progress is not None:
                    await on_progress(progress)
            progress.completed_batches += 1

        # Deterministic deduplication before optional synthesis keeps token use bounded.
        findings = self._dedupe(findings)
        reduce_input = json.dumps([self._finding_dict(f) for f in findings], ensure_ascii=False)
        if findings:
            try:
                reduced = await self._llm.complete_json(build_reduce_prompt(request, reduce_input))
                findings = [self._finding(x) for x in reduced.get("findings", [])]
                findings = self._dedupe(findings)
            except Exception as exc:
                logger.warning("analysis reduce stage failed: %s", exc)

        result = AnalysisResult(
            request=request, findings=tuple(findings), report="", analyzed_documents=tuple(docs),
            failed_documents=tuple(failed),
        )
        return replace(result, report=render_executive_markdown(result))

    @staticmethod
    def _finding(raw: dict[str, Any], document_id: UUID | None = None) -> Finding:
        ids = tuple(UUID(str(x)) for x in raw.get("document_ids", []) if x)
        if document_id and document_id not in ids:
            ids = (*ids, document_id)
        severity = str(raw.get("severity", "info")).lower()
        if severity not in {"info", "low", "medium", "high", "critical"}:
            severity = "info"
        confidence = raw.get("confidence")
        if confidence is not None:
            confidence = max(0.0, min(1.0, float(confidence)))
        severity_value = cast(
            Literal["info", "low", "medium", "high", "critical"], severity
        )
        return Finding(
            title=str(raw.get("title", "Untitled finding"))[:500], severity=severity_value,
            summary=str(raw.get("summary", ""))[:4000],
            evidence=tuple(str(x)[:2000] for x in raw.get("evidence", [])[:10]),
            document_ids=ids, confidence=confidence,
            tags=tuple(str(x)[:100] for x in raw.get("tags", [])[:20]),
        )

    @staticmethod
    def _ids_from_finding(raw: dict[str, Any]) -> tuple[UUID, ...]:
        return tuple(UUID(str(x)) for x in raw.get("document_ids", []) if x)

    @staticmethod
    def _finding_dict(f: Finding) -> dict[str, Any]:
        return {"title": f.title, "severity": f.severity, "summary": f.summary,
                "evidence": list(f.evidence), "document_ids": [str(x) for x in f.document_ids],
                "confidence": f.confidence, "tags": list(f.tags)}

    @staticmethod
    def _dedupe(findings: list[Finding]) -> list[Finding]:
        seen: set[tuple[str, tuple[UUID, ...]]] = set()
        out: list[Finding] = []
        for f in findings:
            key = (f.title.casefold().strip(), tuple(sorted(f.document_ids, key=str)))
            if key in seen:
                continue
            seen.add(key)
            out.append(f)
        return out
