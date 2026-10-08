import io
from typing import Any

from app.rag.ingestion.canonical import BlockKind, CanonicalBuilder
from app.rag.errors import (
    CorruptFileError, EmptyContentError, EncryptedFileError, LimitExceededError,
)
from app.rag.ingestion.parsers._text import parse_datetime, split_paragraphs
from app.rag.ingestion.parsers.base import BaseParser, ParseContext


class PdfParser(BaseParser):
    """PDF із текстовим шаром (pypdf). Скани без тексту → EmptyContentError
    (`no_text_layer`); OCR — окремий майбутній крок. Заголовки в PDF не
    визначаються: усе йде як абзаци з номером сторінки."""

    name = "pdf"
    extensions = (".pdf",)
    mime_types = ("application/pdf", "application/x-pdf")

    def _parse(self, data: bytes, ctx: ParseContext, builder: CanonicalBuilder) -> dict[str, Any]:
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError

        try:
            reader = PdfReader(io.BytesIO(data), strict=False)
        except PdfReadError as exc:
            raise CorruptFileError(f"pdf: cannot read file ({exc})") from exc

        if reader.is_encrypted:
            try:
                ok = bool(reader.decrypt(""))
            except Exception:
                ok = False
            if not ok:
                raise EncryptedFileError("PDF is password-protected")

        total = len(reader.pages)
        if total > ctx.limits.max_pages:
            raise LimitExceededError(f"PDF has {total} pages, limit is {ctx.limits.max_pages}")

        warnings: list[str] = []
        empty_pages: list[int] = []
        for i in range(total):
            page_no = i + 1
            try:
                text = reader.pages[i].extract_text() or ""
            except Exception as exc:   # одна бита сторінка не має валити весь документ
                warnings.append(f"page {page_no}: {type(exc).__name__}")
                continue
            paragraphs = split_paragraphs(text)
            if not paragraphs:
                empty_pages.append(page_no)
                continue
            for para in paragraphs:
                builder.add(BlockKind.PARAGRAPH, para, page=page_no)

        if builder.is_empty:
            raise EmptyContentError(
                "PDF has no text layer (scanned document?). OCR is required.",
                code="no_text_layer", details={"pages": total})

        title = author = created = producer = None
        try:
            meta = reader.metadata
            if meta:
                title, author = meta.title, meta.author
                producer = meta.producer
                created = parse_datetime(meta.creation_date)
        except Exception:
            pass

        return {
            "title": title, "author": author, "published_at": created,
            "metadata": {
                "page_count": total,
                "empty_pages": empty_pages[:50],
                "empty_pages_count": len(empty_pages),
                "warnings": warnings[:20],
                "pdf_producer": producer,
            },
        }
