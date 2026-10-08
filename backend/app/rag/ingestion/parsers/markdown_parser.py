import re
from typing import Any

from app.rag.ingestion.canonical import BlockKind, CanonicalBuilder
from app.rag.ingestion.parsers._text import (
    decode_text, normalize_lang, parse_datetime,
)
from app.rag.ingestion.parsers.base import BaseParser, ParseContext

_ATX = re.compile(r"^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$")
_FENCE = re.compile(r"^\s{0,3}(```|~~~)")
_LIST = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
_SETEXT = re.compile(r"^\s{0,3}(=+|-+)\s*$")
_TABLE_SEP = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
_IMG = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_EMPH = re.compile(r"(\*\*|__|\*|(?<!\w)_|_(?!\w)|`)")


def _inline(text: str) -> str:
    text = _IMG.sub(r"\1", text)
    text = _LINK.sub(r"\1", text)
    return _EMPH.sub("", text)


class MarkdownParser(BaseParser):
    name = "markdown"
    extensions = (".md", ".markdown", ".mdown")
    mime_types = ("text/markdown", "text/x-markdown")

    def _parse(self, data: bytes, ctx: ParseContext, builder: CanonicalBuilder) -> dict[str, Any]:
        text, encoding = decode_text(data)
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        front, text = _front_matter(text)
        lines = text.split("\n")

        para: list[str] = []
        quote: list[str] = []
        table: list[str] = []
        item: list[str] | None = None

        def flush_para() -> None:
            if para:
                builder.add(BlockKind.PARAGRAPH, _inline(" ".join(para)))
                para.clear()

        def flush_quote() -> None:
            if quote:
                builder.add(BlockKind.PARAGRAPH, _inline(" ".join(quote)))
                quote.clear()

        def flush_table() -> None:
            if table:
                builder.add(BlockKind.TABLE, _inline("\n".join(table)))
                table.clear()

        def flush_item() -> None:
            nonlocal item
            if item is not None:
                builder.add(BlockKind.LIST_ITEM, _inline(" ".join(item)))
                item = None

        def flush_all() -> None:
            flush_para(); flush_quote(); flush_table(); flush_item()

        i = 0
        while i < len(lines):
            line = lines[i]
            fence_match = _FENCE.match(line)
            if fence_match:                              # ``` code ```
                flush_all()
                fence = fence_match.group(1)
                code: list[str] = []
                i += 1
                while i < len(lines) and not lines[i].lstrip().startswith(fence):
                    code.append(lines[i]); i += 1
                builder.add(BlockKind.CODE, "\n".join(code))
                i += 1
                continue
            if not line.strip():
                flush_all(); i += 1; continue
            m = _ATX.match(line)
            if m:
                flush_all()
                builder.add(BlockKind.HEADING, _inline(m.group(2)), level=len(m.group(1)))
                i += 1; continue
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if len(para) == 0 and item is None and _SETEXT.match(nxt) and not _LIST.match(line) \
                    and not line.lstrip().startswith(("|", ">")):
                builder.add(BlockKind.HEADING, _inline(line), level=1 if nxt.strip()[0] == "=" else 2)
                i += 2; continue
            if line.lstrip().startswith("|"):
                flush_para(); flush_quote(); flush_item()
                if not _TABLE_SEP.match(line):
                    table.append(line.strip().strip("|"))
                i += 1; continue
            if line.lstrip().startswith(">"):
                flush_para(); flush_table(); flush_item()
                quote.append(line.lstrip()[1:].strip())
                i += 1; continue
            lm = _LIST.match(line)
            if lm:
                flush_para(); flush_quote(); flush_table(); flush_item()
                item = [lm.group(3)]
                i += 1; continue
            if item is not None and line.startswith((" ", "\t")):
                item.append(line.strip())               # продовження пункту списку
                i += 1; continue
            flush_quote(); flush_table(); flush_item()
            para.append(line.strip())
            i += 1
        flush_all()

        return {
            "title": front.get("title") or builder.first_heading(1),
            "author": front.get("author"),
            "published_at": parse_datetime(front.get("date")),
            "language": normalize_lang(front.get("lang") or front.get("language")),
            "metadata": {"encoding": encoding},
        }


def _front_matter(text: str) -> tuple[dict[str, str], str]:
    """Проста YAML-шапка `---\\nkey: value\\n---` (без вкладених структур)."""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    front: dict[str, str] = {}
    for ln in text[4:end].split("\n"):
        if ":" in ln:
            k, v = ln.split(":", 1)
            front[k.strip().lower()] = v.strip().strip("'\"")
    rest = text[end + 4:]
    return front, rest.lstrip("\n")
