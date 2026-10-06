"""Ліміти run-а: кроки, tool-виклики, токени, wall-clock."""
from __future__ import annotations

import time
from typing import Callable


class RunBudget:
    def __init__(self, *, max_steps: int, max_tool_calls: int, token_budget: int,
                 wall_clock_s: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.max_steps, self.max_tool_calls = max_steps, max_tool_calls
        self.token_budget, self.wall_clock_s = token_budget, wall_clock_s
        self._clock = clock
        self._t0 = clock()
        self.steps = self.tool_calls = self.tokens = 0

    def add_tokens(self, prompt: int, completion: int) -> None:
        self.tokens += prompt + completion

    def exceeded(self) -> str | None:
        """Причина вичерпання або None. Перевіряється ПЕРЕД кожним LLM-викликом."""
        if self.steps >= self.max_steps:
            return "max_steps"
        if self.tool_calls >= self.max_tool_calls:
            return "max_tool_calls"
        if self.tokens >= self.token_budget:
            return "token_budget"
        if self._clock() - self._t0 >= self.wall_clock_s:
            return "wall_clock"
        return None

    @property
    def elapsed_s(self) -> float:
        return self._clock() - self._t0
