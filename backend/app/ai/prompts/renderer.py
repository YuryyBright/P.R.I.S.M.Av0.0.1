"""Jinja2 SandboxedEnvironment: користувацькі промпти не повинні виконувати довільний код."""
from __future__ import annotations

from typing import Any, Mapping

from jinja2 import StrictUndefined, TemplateError
from jinja2.sandbox import SandboxedEnvironment

from app.ai.domain.exceptions import InvalidInputError

_env = SandboxedEnvironment(
    autoescape=False, undefined=StrictUndefined,
    trim_blocks=True, lstrip_blocks=True, keep_trailing_newline=False,
)

BUILTIN_VARIABLES = ("user_name", "today", "collections")


def render(content: str, variables: Mapping[str, Any]) -> str:
    try:
        return _env.from_string(content).render(**variables).strip()
    except TemplateError as e:                       # синтаксис / невизначена змінна / sandbox
        raise InvalidInputError(f"Prompt template error: {e}") from e


def validate_template(content: str, extra_vars: list[str] | None = None) -> None:
    """Пробний рендер зі «заглушками» — перевіряє синтаксис і використання лише відомих змінних."""
    probe = {"user_name": "x", "today": "2000-01-01", "collections": ["x"]}
    probe.update({k: "x" for k in (extra_vars or [])})
    render(content, probe)
