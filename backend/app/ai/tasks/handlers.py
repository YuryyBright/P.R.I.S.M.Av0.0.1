from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from app.ai.analysis.contracts import AnalysisProgress, AnalysisRequest, AnalysisResult
from app.ai.tasks.domain import StageKind
from app.ai.tasks.engine import TaskCancelled
from app.ai.tasks.events import (
    TaskItemFailed,
    TaskProgress,
    TaskStageCompleted,
    TaskStageStarted,
)
from app.ai.tasks.ports import TaskContext


class Analyzer(Protocol):
    async def analyze(
        self,
        user: Any,
        request: AnalysisRequest,
        *,
        progress: AnalysisProgress | None = None,
        on_progress: Any | None = None,
        on_item_failed: Any | None = None,
    ) -> AnalysisResult: ...


class TextArtifactService(Protocol):
    async def save_text(
        self,
        *,
        owner_id: UUID,
        task_id: UUID,
        name: str,
        content: str,
        mime_type: str,
    ) -> dict[str, Any]: ...


class TaskAnalysisHandler:
    task_type = "analysis"

    def __init__(
        self,
        analyzer: Analyzer,
        *,
        artifact_service: TextArtifactService | None = None,
    ) -> None:
        self.analyzer = analyzer
        self.artifact_service = artifact_service

    async def execute(self, ctx: TaskContext) -> list[dict[str, Any]]:
        stages = [
            StageKind.INGEST,
            StageKind.PREPROCESS,
            StageKind.FILTER,
            StageKind.ANALYZE,
            StageKind.DEDUPLICATE,
            StageKind.SYNTHESIZE,
            StageKind.EXPORT,
        ]
        result: AnalysisResult | None = None
        for stage_index, stage in enumerate(stages, 1):
            await ctx.emit(
                TaskStageStarted(
                    task_id=ctx.task_id,
                    stage=stage,
                    stage_index=stage_index,
                    total_stages=len(stages),
                )
            )
            if stage != StageKind.ANALYZE:
                await ctx.emit(
                    TaskStageCompleted(
                        task_id=ctx.task_id,
                        stage=stage,
                        stage_index=stage_index,
                        total_stages=len(stages),
                    )
                )
                continue

            collections = tuple(
                UUID(source.id)
                for source in ctx.sources
                if source.type in {"collection", "rag_collection"}
            )
            documents = tuple(
                UUID(source.id)
                for source in ctx.sources
                if source.type in {"file", "document"}
            )
            config = ctx.config
            request = AnalysisRequest(
                instruction=ctx.instruction,
                analysis_id=ctx.task_id,
                collection_ids=collections or None,
                document_ids=documents or None,
                focus=tuple(config.get("focus", [])),
                report_template=config.get(
                    "report_template", "executive_markdown"
                ),
                exhaustive=bool(config.get("exhaustive", True)),
                web_enabled=bool(config.get("web_enabled", False)),
                max_documents=int(config.get("max_documents", 5000)),
                batch_size=int(config.get("batch_size", 8)),
            )
            progress = AnalysisProgress()

            async def on_item_failed(
                item_id: UUID, error: str, attempt: int
            ) -> None:
                await ctx.emit(
                    TaskItemFailed(
                        task_id=ctx.task_id,
                        item_key=str(item_id),
                        error=error[:2000],
                        attempt=attempt,
                    )
                )

            async def on_progress(current: AnalysisProgress) -> None:
                if await ctx.cancellation_requested():
                    raise TaskCancelled()
                ctx.progress.total = current.total_documents
                ctx.progress.processed = current.completed_documents
                ctx.progress.successful = max(
                    0, current.completed_documents - current.errors
                )
                ctx.progress.failed = current.errors
                percent = (
                    ctx.progress.processed / current.total_documents * 100
                    if current.total_documents
                    else 100
                )
                await ctx.emit(
                    TaskProgress(
                        task_id=ctx.task_id,
                        stage=StageKind.ANALYZE,
                        processed=ctx.progress.processed,
                        total=ctx.progress.total,
                        percent=percent,
                        successful=ctx.progress.successful,
                        failed=ctx.progress.failed,
                        skipped=0,
                    )
                )

            result = await self.analyzer.analyze(
                ctx.user,
                request,
                progress=progress,
                on_progress=on_progress,
                on_item_failed=on_item_failed,
            )
            await ctx.emit(
                TaskStageCompleted(
                    task_id=ctx.task_id,
                    stage=stage,
                    stage_index=stage_index,
                    total_stages=len(stages),
                )
            )

        if result is None:
            raise RuntimeError("Analysis stage did not produce a result")
        artifacts: list[dict[str, Any]] = []
        if self.artifact_service is not None:
            artifact = await self.artifact_service.save_text(
                owner_id=ctx.user.id,
                task_id=ctx.task_id,
                name="report.md",
                content=result.report,
                mime_type="text/markdown",
            )
            artifacts.append(artifact)

        ctx.progress.processed = ctx.progress.total
        ctx.progress.percent = 100.0
        await ctx.emit(
            TaskStageStarted(
                task_id=ctx.task_id,
                stage=StageKind.EXPORT,
                stage_index=len(stages),
                total_stages=len(stages),
            )
        )
        await ctx.emit(
            TaskProgress(
                task_id=ctx.task_id,
                stage=StageKind.EXPORT,
                processed=ctx.progress.processed,
                total=ctx.progress.total,
                percent=100.0,
                successful=ctx.progress.successful,
                failed=ctx.progress.failed,
                skipped=ctx.progress.skipped,
            )
        )
        await ctx.emit(
            TaskStageCompleted(
                task_id=ctx.task_id,
                stage=StageKind.EXPORT,
                stage_index=len(stages),
                total_stages=len(stages),
            )
        )
        return artifacts
