"""Реєстр моделей: alias → ModelSpec. З нього працюють пікер у UI і перевірки сумісності."""
from __future__ import annotations

from dataclasses import dataclass

from app.ai.domain.exceptions import ModelNotAvailableError
from app.ai.settings import AiSettings


@dataclass(frozen=True, slots=True)
class ModelSpec:
    alias: str
    provider: str
    name: str
    label: str
    vision: bool
    tools: bool
    context_len: int
    max_output_tokens: int
    temperature: float


class ModelRegistry:
    def __init__(self, settings: AiSettings) -> None:
        self.default_alias = settings.default_model
        self._specs = {
            alias: ModelSpec(alias, m.provider, m.name, m.label or alias, m.vision, m.tools,
                             m.context_len, m.max_output_tokens, m.temperature)
            for alias, m in settings.models.items()
        }

    def get(self, alias: str | None = None) -> ModelSpec:
        key = alias or self.default_alias
        try:
            return self._specs[key]
        except KeyError:
            raise ModelNotAvailableError(f"Unknown model: {key!r}") from None

    def require(self, alias: str | None, *, tools: bool = False, vision: bool = False) -> ModelSpec:
        spec = self.get(alias)
        if tools and not spec.tools:
            raise ModelNotAvailableError(f"Model {spec.alias!r} does not support tool calling")
        if vision and not spec.vision:
            raise ModelNotAvailableError(f"Model {spec.alias!r} does not support images")
        return spec

    def list(self) -> list[ModelSpec]:
        return list(self._specs.values())
