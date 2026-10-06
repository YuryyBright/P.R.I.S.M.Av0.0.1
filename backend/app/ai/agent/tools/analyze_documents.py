from __future__ import annotations
from typing import Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.ai.agent.tools.base import BaseTool, ToolOutput
from app.ai.analysis.contracts import AnalysisRequest
from app.ai.analysis.report_store import ReportStore
from app.ai.runtime.context import RunContext

class AnalyzeDocumentsArgs(BaseModel):
    instruction: str = Field(min_length=5, max_length=4000)
    collection_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    focus: list[str] = Field(default_factory=list, max_length=30)
    report_template: str = Field(default="executive_markdown", max_length=64)
    exhaustive: bool = True
    web_enabled: bool = False
    max_documents: int = Field(default=5000, ge=1, le=5000)
    batch_size: int = Field(default=8, ge=1, le=32)
    item_retries: int = Field(default=2, ge=0, le=5)

class AnalyzeDocuments(BaseTool):
    name = "analyze_documents"
    description = ("Exhaustively analyze an explicitly selected set of accessible documents. "
                   "Enumerates documents first, processes them in bounded batches, tracks coverage, "
                   "and returns a structured report. Prefer this over repeated semantic search when "
                   "the user asks to analyze all/most files.")
    args_model = AnalyzeDocumentsArgs
    requires_rag = True
    def __init__(self, orchestrator: Any, report_store: ReportStore | None = None) -> None:
        self._orchestrator = orchestrator
        self._report_store = report_store
    async def run(self, ctx: RunContext, args: AnalyzeDocumentsArgs) -> ToolOutput:
        allowed = ctx.config.collection_ids
        collection_ids = args.collection_ids
        if collection_ids is None and allowed is not None: collection_ids = list(allowed)
        elif collection_ids is not None and allowed is not None: collection_ids = [x for x in collection_ids if x in set(allowed)]
        result = await self._orchestrator.analyze(ctx.user, AnalysisRequest(
            instruction=args.instruction,
            collection_ids=tuple(collection_ids) if collection_ids is not None else None,
            document_ids=tuple(args.document_ids) if args.document_ids else None,
            focus=tuple(args.focus), report_template=args.report_template,
            exhaustive=args.exhaustive, web_enabled=args.web_enabled,
            max_documents=args.max_documents, batch_size=args.batch_size, item_retries=args.item_retries))
        summary = (f"Analyzed {len(result.analyzed_documents)} documents; failed {len(result.failed_documents)}; "
                   f"findings {len(result.findings)}. Coverage is {len(result.analyzed_documents)}/"
                   f"{len(result.analyzed_documents) + len(result.failed_documents)}.")
        artifacts: list[dict[str, Any]] = []
        if self._report_store is not None:
            report_id = await self._report_store.save(
                owner_id=ctx.user_id, filename="analysis-report.md",
                content=result.report, content_type="text/markdown")
            artifacts.append({"type": "report", "id": report_id, "filename": "analysis-report.md"})
        top = "\n".join(f"- [{f.severity}] {f.title}: {f.summary}" for f in result.findings[:20])
        return ToolOutput(for_llm=summary + ("\nTop findings:\n" + top if top else ""),
                          ui_summary=summary, artifacts=artifacts)
