import io
import re
import zipfile
from typing import Any

from app.rag.ingestion.canonical import BlockKind, CanonicalBuilder
from app.rag.errors import CorruptFileError, LimitExceededError
from app.rag.ingestion.parsers._text import normalize_lang, parse_datetime
from app.rag.ingestion.parsers.base import BaseParser, ParseContext

_HEADING_RE = re.compile(r"^heading\s*(\d)", re.IGNORECASE)


class DocxParser(BaseParser):
    """.docx через python-docx: заголовки за стилями, списки, таблиці — у порядку
    документа. Старий .doc не підтримується."""

    name = "docx"
    extensions = (".docx",)
    mime_types = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    def _parse(self, data: bytes, ctx: ParseContext, builder: CanonicalBuilder) -> dict[str, Any]:
        import docx
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                if sum(i.file_size for i in zf.infolist()) > ctx.limits.max_uncompressed_bytes:
                    raise LimitExceededError("docx: uncompressed size exceeds limit")
                if "word/document.xml" not in zf.namelist():
                    raise CorruptFileError("docx: word/document.xml not found")
        except zipfile.BadZipFile as exc:
            raise CorruptFileError("docx: not a valid zip/docx file") from exc

        document = docx.Document(io.BytesIO(data))
        title_from_style: str | None = None

        for child in document.element.body.iterchildren():
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "p":
                p = Paragraph(child, document)
                text = p.text
                if not text.strip():
                    continue
                style = (p.style.name if p.style is not None else "") or ""
                m = _HEADING_RE.match(style)
                if m:
                    builder.add(BlockKind.HEADING, text, level=min(max(int(m.group(1)), 1), 6))
                elif style.lower() == "title":
                    title_from_style = title_from_style or text.strip()
                    builder.add(BlockKind.HEADING, text, level=1)
                elif style.lower().startswith("list") or _is_numbered(p):
                    builder.add(BlockKind.LIST_ITEM, text)
                else:
                    builder.add(BlockKind.PARAGRAPH, text)
            elif tag == "tbl":
                builder.add(BlockKind.TABLE, _table_text(Table(child, document)))

        cp = document.core_properties
        return {
            "title": (cp.title or "").strip() or title_from_style or builder.first_heading(1),
            "author": (cp.author or "").strip() or None,
            "published_at": parse_datetime(cp.created),
            "language": normalize_lang(cp.language),
            "metadata": {"last_modified_by": cp.last_modified_by or None,
                         "modified_at": cp.modified.isoformat() if cp.modified else None},
        }


def _is_numbered(p: Any) -> bool:
    ppr = p._p.pPr
    return ppr is not None and ppr.numPr is not None


def _table_text(table: Any) -> str:
    rows = []
    for row in table.rows:
        cells, seen = [], None
        for cell in row.cells:
            if cell._tc is seen:          # об'єднані комірки повторюються
                continue
            seen = cell._tc
            cells.append(cell.text.replace("\n", " ").strip())
        if any(cells):
            rows.append(" | ".join(cells))
    return "\n".join(rows)
