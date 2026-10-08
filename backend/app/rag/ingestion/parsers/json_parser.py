import json
from typing import Any

from app.rag.ingestion.canonical import BlockKind, CanonicalBuilder
from app.rag.errors import CorruptFileError
from app.rag.ingestion.parsers._text import (
    decode_text, parse_datetime, split_paragraphs,
)
from app.rag.ingestion.parsers.base import BaseParser, ParseContext

_TITLE = ("title", "name", "subject", "headline")
_BODY = ("content", "text", "body", "message", "description", "summary")
_AUTHOR = ("author", "from", "creator", "sender", "user")
_DATE = ("published_at", "published", "date", "created_at", "timestamp", "time")
_URL = ("url", "link", "permalink")
_MAX_DEPTH = 20


class JsonParser(BaseParser):
    """Універсальний JSON/JSONL. Об'єкти з полями типу title/text/author/date
    розбираються як записи; решта — розгортається в рядки `шлях: значення`.
    Специфічні формати (Telegram export тощо) — у sources/*/normalizer."""

    name = "json"
    extensions = (".json", ".jsonl", ".ndjson")
    mime_types = ("application/json", "application/x-ndjson", "text/json")

    def _parse(self, data: bytes, ctx: ParseContext, builder: CanonicalBuilder) -> dict[str, Any]:
        text, encoding = decode_text(data)
        try:
            obj = json.loads(text)
        except json.JSONDecodeError as exc:
            obj = _try_jsonl(text)
            if obj is None:
                raise CorruptFileError(f"json: invalid JSON ({exc.msg}, line {exc.lineno})") from exc

        top = _record_fields(obj) if isinstance(obj, dict) else {}
        _emit(obj, builder, path="", depth=0, in_list=False)
        return {
            "title": top.get("title"),
            "author": top.get("author"),
            "published_at": top.get("date"),
            "url": top.get("url"),
            "metadata": {"encoding": encoding, "json_root": type(obj).__name__},
        }


def _try_jsonl(text: str) -> list[Any] | None:
    items = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            items.append(json.loads(ln))
        except json.JSONDecodeError:
            return None
    return items or None


def _scalar(v: Any) -> bool:
    return isinstance(v, (str, int, float, bool)) or v is None


def _text_of(v: Any) -> str | None:
    """str | список фрагментів (як у Telegram) | {'text': ...} → рядок."""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        parts = [p if isinstance(p, str) else _text_of(p) or "" for p in v]
        joined = "".join(parts)
        return joined or None
    if isinstance(v, dict) and "text" in v:
        return _text_of(v["text"])
    return None


def _first(d: dict, keys: tuple[str, ...]) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, "", []):
            return d[k]
    return None


def _record_fields(d: dict) -> dict[str, Any]:
    body_key = next((k for k in _BODY if _text_of(d.get(k))), None)
    author = _first(d, _AUTHOR)
    return {
        "body": _text_of(d[body_key]) if body_key else None,
        "body_key": body_key,
        "title": _first(d, _TITLE) if isinstance(_first(d, _TITLE), str) else None,
        "author": _text_of(author) if author is not None and _text_of(author) else (
            str(author) if _scalar(author) and author is not None else None),
        "date": parse_datetime(_first(d, _DATE)),
        "url": _first(d, _URL) if isinstance(_first(d, _URL), str) else None,
    }


def _emit(value: Any, b: CanonicalBuilder, *, path: str, depth: int, in_list: bool) -> None:
    if depth > _MAX_DEPTH:
        b.add(BlockKind.PARAGRAPH, f"{path}: {json.dumps(value, ensure_ascii=False)[:500]}")
        return
    if isinstance(value, dict):
        rec = _record_fields(value)
        if rec["body"]:
            if rec["title"]:
                b.add(BlockKind.HEADING, rec["title"], level=min(depth + 1, 6))
            prefix = ""
            if in_list:                         # запис серед багатьох: зберігаємо автора/дату
                who = ", ".join(x for x in (rec["author"], rec["date"].date().isoformat()
                                            if rec["date"] else None) if x)
                prefix = f"{who}: " if who else ""
            paras = split_paragraphs(rec["body"]) or [rec["body"]]
            paras[0] = prefix + paras[0]
            for p in paras:
                b.add(BlockKind.PARAGRAPH, p)
            return
        for k, v in value.items():
            _emit(v, b, path=f"{path}.{k}" if path else str(k), depth=depth + 1, in_list=False)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _emit(v, b, path=f"{path}[{i}]", depth=depth + 1, in_list=True)
    elif value is not None:
        text = str(value)
        b.add(BlockKind.PARAGRAPH, f"{path}: {text}" if path else text)
