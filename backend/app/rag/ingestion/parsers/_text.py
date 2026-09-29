"""Спільні текстові утиліти парсерів."""
import codecs
import re
import statistics
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

_TERMINAL = (".", "!", "?", "…", ":", ";", "»", "”", '"', ")")


def decode_text(data: bytes) -> tuple[str, str]:
    """bytes → (text, encoding). utf-8 → utf-16 (BOM) → детектор → cp1251."""
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return data.decode("utf-16", "replace"), "utf-16"
    for enc in ("utf-8-sig",):
        try:
            return data.decode(enc), "utf-8"
        except UnicodeDecodeError:
            pass
    try:
        from charset_normalizer import from_bytes
        best = from_bytes(data).best()
        if best is not None:
            return str(best), best.encoding
    except Exception:  # детектор — лише покращення, не залежність
        pass
    return data.decode("cp1251", "replace"), "cp1251"


def normalize_lang(value: Any) -> str | None:
    """'uk-UA' / 'UK' / 'uk_UA' → 'uk'."""
    if not isinstance(value, str):
        return None
    m = re.match(r"\s*([A-Za-z]{2,3})(?:[-_]|$)", value)
    return m.group(1).lower() if m else None


def parse_datetime(value: Any) -> datetime | None:
    """ISO-8601 / RFC-2822 / epoch → aware datetime (UTC). Невдача → None."""
    try:
        if isinstance(value, datetime):
            dt = value
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            ts = float(value) / 1000 if value > 1e11 else float(value)
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        elif isinstance(value, str) and value.strip():
            v = value.strip()
            try:
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                dt = parsedate_to_datetime(v)
        else:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def _join(cur: str, nxt: str) -> str:
    # перенос слова: "інформа-" + "ція" → "інформація"
    if cur.endswith("-") and len(cur) > 1 and cur[-2].isalpha() and nxt[:1].islower():
        return cur[:-1] + nxt
    return cur + " " + nxt


def _group_lines(lines: list[str]) -> list[str]:
    lens = [len(ln) for ln in lines]
    if statistics.median(lens) < 30:            # короткі рядки: вірші, списки, чат
        return lines
    width = sorted(lens)[int(len(lens) * 0.9) - 1 if len(lens) > 1 else 0]
    out, cur = [], lines[0]
    for prev, ln in zip(lines, lines[1:]):
        # короткий рядок із крапкою в кінці = кінець абзацу (hard wrap)
        if len(prev) < 0.6 * width and prev.endswith(_TERMINAL):
            out.append(cur)
            cur = ln
        else:
            cur = _join(cur, ln)
    out.append(cur)
    return out


def split_paragraphs(text: str) -> list[str]:
    """Текст із жорсткими переносами (PDF, .txt) → список абзаців."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x0c", "\n\n")
    out: list[str] = []
    for raw in re.split(r"\n\s*\n", text):
        lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
        if len(lines) == 1:
            out.append(lines[0])
        elif lines:
            out.extend(_group_lines(lines))
    return out
