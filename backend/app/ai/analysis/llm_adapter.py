from __future__ import annotations
import json
from typing import Any
from app.ai.llm.router import LLMRouter
from app.ai.llm.types import ChatMessage, ChatRequest

class RouterAnalysisLLM:
    """JSON-only adapter used by bulk analysis, separate from the tool-calling loop."""
    def __init__(self, router: LLMRouter, model: str, *, max_tokens: int = 2048) -> None:
        self._router, self._model, self._max_tokens = router, model, max_tokens
    async def complete_json(self, prompt: str) -> dict[str, Any]:
        result = await self._router.complete(ChatRequest(
            messages=[ChatMessage("system", "Return valid JSON only."), ChatMessage("user", prompt)],
            model=self._model, tool_choice="none", max_tokens=self._max_tokens))
        text = result.text.strip()
        if text.startswith("```"):
            text = text.strip("`").removeprefix("json").strip()
        value = json.loads(text)
        if not isinstance(value, dict):
            raise ValueError("analysis model returned non-object JSON")
        return value
