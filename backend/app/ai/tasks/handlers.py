from __future__ import annotations
from typing import Any
from uuid import UUID
from app.ai.analysis.contracts import AnalysisRequest, AnalysisProgress
from app.ai.tasks.domain import StageKind
from app.ai.tasks.events import TaskStageStarted, TaskStageCompleted, TaskProgress, TaskItemFailed
from app.ai.tasks.ports import TaskContext
from app.ai.tasks.engine import TaskCancelled

class TaskAnalysisHandler:
    task_type="analysis"
    def __init__(self, analyzer, *, artifact_service=None): self.analyzer,self.artifact_service=analyzer,artifact_service
    async def execute(self, ctx: TaskContext) -> list[dict[str,Any]]:
        stages=[StageKind.INGEST,StageKind.PREPROCESS,StageKind.FILTER,StageKind.ANALYZE,StageKind.DEDUPLICATE,StageKind.SYNTHESIZE,StageKind.EXPORT]
        result=None
        for stage_index, stage in enumerate(stages,1):
            await ctx.emit(TaskStageStarted(task_id=ctx.task_id,stage=stage,stage_index=stage_index,total_stages=len(stages)))
            if stage != StageKind.ANALYZE:
                await ctx.emit(TaskStageCompleted(task_id=ctx.task_id,stage=stage,stage_index=stage_index,total_stages=len(stages)))
                continue
            collections=tuple(UUID(s.id) for s in ctx.sources if s.type in {"collection","rag_collection"})
            documents=tuple(UUID(s.id) for s in ctx.sources if s.type in {"file","document"})
            cfg=ctx.config
            req=AnalysisRequest(instruction=ctx.instruction,analysis_id=ctx.task_id,collection_ids=collections or None,document_ids=documents or None,focus=tuple(cfg.get("focus",[])),report_template=cfg.get("report_template","executive_markdown"),exhaustive=bool(cfg.get("exhaustive",True)),web_enabled=bool(cfg.get("web_enabled",False)),max_documents=int(cfg.get("max_documents",5000)),batch_size=int(cfg.get("batch_size",8)))
            progress=AnalysisProgress()
            async def on_item_failed(item_id,error,attempt):
                await ctx.emit(TaskItemFailed(task_id=ctx.task_id,item_key=str(item_id),error=error[:2000],attempt=attempt))
            async def on_progress(p):
                if await ctx.cancellation_requested(): raise TaskCancelled()
                ctx.progress.total=p.total_documents; ctx.progress.processed=p.completed_documents; ctx.progress.successful=max(0,p.completed_documents-p.errors); ctx.progress.failed=p.errors
                await ctx.emit(TaskProgress(task_id=ctx.task_id,stage=StageKind.ANALYZE,processed=ctx.progress.processed,total=ctx.progress.total,percent=(ctx.progress.processed/p.total_documents*100 if p.total_documents else 100),successful=ctx.progress.successful,failed=ctx.progress.failed,skipped=0))
            result=await self.analyzer.analyze(ctx.user,req,progress=progress,on_progress=on_progress,on_item_failed=on_item_failed)
            await ctx.emit(TaskStageCompleted(task_id=ctx.task_id,stage=stage,stage_index=stage_index,total_stages=len(stages)))
        artifacts=[]
        if result is None:
            raise RuntimeError("Analysis stage did not produce a result")
        if self.artifact_service is not None:
            artifact=await self.artifact_service.save_text(owner_id=ctx.user.id,task_id=ctx.task_id,name="report.md",content=result.report,mime_type="text/markdown")
            artifacts.append(artifact)
        ctx.progress.processed=ctx.progress.total; ctx.progress.percent=100.0
        await ctx.emit(TaskStageStarted(task_id=ctx.task_id,stage=StageKind.EXPORT,stage_index=len(stages),total_stages=len(stages)))
        await ctx.emit(TaskProgress(task_id=ctx.task_id,stage=StageKind.EXPORT,processed=ctx.progress.processed,total=ctx.progress.total,percent=100.0,successful=ctx.progress.successful,failed=ctx.progress.failed,skipped=ctx.progress.skipped))
        await ctx.emit(TaskStageCompleted(task_id=ctx.task_id,stage=StageKind.EXPORT,stage_index=len(stages),total_stages=len(stages)))
        return artifacts
