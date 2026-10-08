"""AI settings. Ізольовані від RagSettings: префікс AI_, вкладені групи через "__".

Приклад:
  AI_DEFAULT_MODEL=qwen
  AI_PROVIDERS__default__API_BASE=http://vllm:8000/v1
  AI_MODELS__qwen__NAME=Qwen/Qwen2.5-7B-Instruct
  AI_MODELS__qwen__TOOLS=true
  AI_BUS__REDIS_URL overrides the shared REDIS_HOST/PORT/PASSWORD/DB settings

ІНВАРІАНТ (як у rag): значення Literal у `backend` == ключі container._REGISTRY[kind]
(перевіряє tests/ai/test_registry_consistency.py).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import PydanticBaseSettingsSource

from app.core.env_settings import settings_customise_sources
from app.core.service_config import service_settings


class ProviderSettings(BaseModel):
    backend: Literal["vllm"] = "vllm"
    api_base: str | None = "http://vllm:8000/v1"
    api_key: SecretStr | None = None
    timeout_s: float = 120.0
    max_retries: int = 2


class ModelSettings(BaseModel):
    """Запис реєстру моделей: alias → що це за модель і що вона вміє."""
    provider: str = "default"
    name: str = "Qwen/Qwen2.5-7B-Instruct"        # назва, з якою запущено сервер
    label: str | None = None                       # для UI
    vision: bool = False
    tools: bool = False                            # tool calling (потрібно для agent)
    context_len: int = Field(8192, gt=0)
    max_output_tokens: int = Field(2048, gt=0)
    temperature: float = Field(0.2, ge=0.0, le=2.0)


class ChatSettings(BaseModel):
    history_token_budget: int = Field(3000, gt=0)
    max_history_messages: int = Field(12, ge=0)
    chars_per_token: float = Field(3.0, gt=0)      # груба оцінка (укр. ≈ 3 символи/токен)
    query_rewrite: bool = True
    citation_retry: int = Field(1, ge=0, le=3)
    require_citations: bool = True                 # лише коли RAG увімкнено і є чанки
    refuse_when_empty: bool = True                 # RAG увімкнено, але нічого не знайдено
    refusal_message: str = "Недостатньо даних у доступних джерелах для відповіді."
    rewrite_max_chars: int = 500


class AgentSettings(BaseModel):
    queue: str = "ai_agent"
    max_steps: int = Field(8, gt=0)
    max_tool_calls: int = Field(12, gt=0)
    token_budget: int = Field(60000, gt=0)
    wall_clock_s: int = Field(300, gt=0)
    tool_result_max_chars: int = Field(8000, gt=0)
    allow_write_tools: bool = False                # v1: лише read-only інструменти
    allow_web_search: bool = False
    # надійність
    heartbeat_s: float = 10.0
    stale_after_s: int = Field(60, gt=0)           # RUNNING без heartbeat → failed(worker_lost)
    sweep_interval_s: int = Field(30, gt=0)
    undispatched_after_s: int = Field(60, ge=0)    # QUEUED без celery_task_id → redispatch
    soft_time_limit_grace_s: int = 30
    hard_time_limit_grace_s: int = Field(30, gt=0)


class BusSettings(BaseModel):
    backend: Literal["redis", "memory"] = "redis"
    redis_url: str = Field(default_factory=lambda: service_settings.redis_url)
    stream_maxlen: int = Field(20000, gt=0)
    ttl_after_finish_s: int = Field(900, gt=0)     # скільки після завершення можна дочитати події
    flush_interval_ms: int = Field(40, ge=0)       # коалесинг token.delta
    flush_max_chars: int = Field(96, gt=0)
    cancel_ttl_s: int = 3600


class PromptSettings(BaseModel):
    max_content_chars: int = 20000
    max_versions_per_template: int = 500


class TaskSettings(BaseModel):
    queue: str = "ai_tasks"
    max_retries: int = Field(3, ge=0)
    retry_backoff_s: int = Field(30, gt=0)
    stale_after_s: int = Field(90, gt=0)
    undispatched_after_s: int = Field(30, ge=0)
    sweep_interval_s: int = Field(30, gt=0)


class AiSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AI_", env_nested_delimiter="__", env_file=None, extra="ignore",
        env_file_encoding="utf-8",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return settings_customise_sources(
            settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings
        )

    enabled: bool = True
    default_model: str = "default"
    providers: dict[str, ProviderSettings] = Field(
        default_factory=lambda: {"default": ProviderSettings()}
    )
    models: dict[str, ModelSettings] = Field(
        default_factory=lambda: {
            "default": ModelSettings(
                tools=True,
                label="Default",
                context_len=8192,
                max_output_tokens=2048,
                temperature=0.2,
            )
        }
    )
    chat: ChatSettings = Field(default_factory=lambda: ChatSettings())  # type: ignore[call-arg]
    agent: AgentSettings = Field(default_factory=lambda: AgentSettings())  # type: ignore[call-arg]
    bus: BusSettings = Field(default_factory=lambda: BusSettings())  # type: ignore[call-arg]
    prompts: PromptSettings = Field(default_factory=lambda: PromptSettings())
    tasks: TaskSettings = Field(default_factory=lambda: TaskSettings())  # type: ignore[call-arg]

    @model_validator(mode="after")
    def _cross_checks(self) -> "AiSettings":
        if not self.enabled:
            return self
        if self.default_model not in self.models:
            raise ValueError(f"AI_DEFAULT_MODEL={self.default_model!r} is not in AI_MODELS")
        for alias, m in self.models.items():
            if m.provider not in self.providers:
                raise ValueError(f"model {alias!r}: unknown provider {m.provider!r}")
            if m.max_output_tokens >= m.context_len:
                raise ValueError(f"model {alias!r}: max_output_tokens must be < context_len")
        for name, p in self.providers.items():
            if p.backend == "vllm" and not p.api_base:
                raise ValueError(f"AI_PROVIDERS__{name}__API_BASE is required for backend 'vllm'")
        return self


@lru_cache
def get_ai_settings() -> AiSettings:
    return AiSettings()
