from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field
from app.ai.agent.tools.base import BaseTool, ToolOutput
from app.ai.runtime.context import RunContext

class WebSearchArgs(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=5, ge=1, le=10)

class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Read-only internet search through an injected provider. Never performs arbitrary HTTP requests."
    args_model = WebSearchArgs
    requires_rag = False
    def __init__(self, search: Any) -> None: self._search = search
    async def run(self, ctx: RunContext, args: WebSearchArgs) -> ToolOutput:
        if not ctx.config.web_enabled:
            return ToolOutput("Web search is disabled for this run.", "web disabled")
        results = await self._search.search(args.query, limit=args.limit)
        if not results:
            return ToolOutput("No web results.", "0 web results")
        text = "\n".join(f"[{i}] {r.title}\nURL: {r.url}\n{r.snippet}" for i, r in enumerate(results, 1))
        return ToolOutput(text, f"{len(results)} web results")
