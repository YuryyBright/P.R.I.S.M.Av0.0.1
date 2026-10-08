"""Shared environment-file selection for every Pydantic Settings class."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings
from pydantic_settings.sources import DotEnvSettingsSource, PydanticBaseSettingsSource


def get_project_root() -> str:
    if os.getenv("FASTAPI_ENV") == "production":
        return "/app"
    return str(Path(__file__).resolve().parents[2])


def get_env_file_paths(mode: str | None = None) -> tuple[str, ...] | None:
    """Return local, mode-specific, then legacy env files in precedence order."""
    mode = mode or os.getenv("MODE", "development")
    root = get_project_root()
    candidates = [
        Path(root) / ".env.local",
        Path(root) / f".env.{mode}",
        Path(root) / "backend.env",
    ]
    existing = tuple(str(path) for path in candidates if path.is_file())
    return existing or None


def settings_customise_sources(
    settings_cls: type[BaseSettings],
    init_settings: PydanticBaseSettingsSource,
    env_settings: PydanticBaseSettingsSource,
    dotenv_settings: PydanticBaseSettingsSource,
    file_secret_settings: PydanticBaseSettingsSource,
) -> tuple[PydanticBaseSettingsSource, ...]:
    env_file_encoding = settings_cls.model_config.get("env_file_encoding", "utf-8")
    case_sensitive = settings_cls.model_config.get("case_sensitive", True)
    return (
        init_settings,
        env_settings,
        DotEnvSettingsSource(
            settings_cls=settings_cls,
            env_file=get_env_file_paths(),
            env_file_encoding=env_file_encoding,
            case_sensitive=case_sensitive,
        ),
        file_secret_settings,
    )
