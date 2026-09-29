"""Вибір парсера за вмістом/розширенням/mime та єдина точка входу."""
from pathlib import PurePath

from app.rag.ingestion.canonical import CanonicalDocument
from app.rag.errors import UnsupportedFormatError
from app.rag.ingestion.parsers.base import BaseParser, ParseContext, ParseLimits
from app.rag.ingestion.parsers.docx_parser import DocxParser
from app.rag.ingestion.parsers.html_parser import HtmlParser
from app.rag.ingestion.parsers.json_parser import JsonParser
from app.rag.ingestion.parsers.markdown_parser import MarkdownParser
from app.rag.ingestion.parsers.pdf_parser import PdfParser
from app.rag.ingestion.parsers.txt_parser import TextParser

_PARSERS: tuple[BaseParser, ...] = (
    PdfParser(), DocxParser(), HtmlParser(), MarkdownParser(), JsonParser(), TextParser(),
)
_BY_EXT = {ext: p for p in _PARSERS for ext in p.extensions}
_BY_MIME = {m: p for p in _PARSERS for m in p.mime_types}
_UNSUPPORTED_EXT = {
    ".doc": "legacy .doc is not supported, save as .docx",
    ".rtf": "RTF is not supported", ".odt": "ODT is not supported",
    ".xls": "spreadsheets are not supported", ".xlsx": "spreadsheets are not supported",
    ".ppt": "presentations are not supported", ".pptx": "presentations are not supported",
}


def detect_parser(data: bytes, filename: str | None = None,
                  mime_type: str | None = None) -> BaseParser:
    """Пріоритет: сигнатура (PDF/ZIP) → розширення → mime → «схоже на текст»."""
    ext = PurePath(filename).suffix.lower() if filename else ""
    head = data[:1024]

    if b"%PDF-" in head:
        return _BY_EXT[".pdf"]
    if head.startswith(b"PK\x03\x04"):
        if ext == ".docx" or (mime_type or "").startswith(
                "application/vnd.openxmlformats-officedocument.wordprocessingml"):
            return _BY_EXT[".docx"]
        raise UnsupportedFormatError(f"ZIP-based file is not a supported format ({ext or 'no extension'})")

    if ext in _UNSUPPORTED_EXT:
        raise UnsupportedFormatError(_UNSUPPORTED_EXT[ext], details={"extension": ext})
    if ext in _BY_EXT:
        return _BY_EXT[ext]
    mime = (mime_type or "").split(";")[0].strip().lower()
    if mime in _BY_MIME:
        return _BY_MIME[mime]

    if b"\x00" not in data[:4096]:
        stripped = head.lstrip().lower()
        if stripped.startswith((b"<!doctype html", b"<html")):
            return _BY_EXT[".html"]
        return _BY_EXT[".txt"]
    raise UnsupportedFormatError(
        f"Unsupported file type (ext={ext or '-'}, mime={mime or '-'})",
        details={"extension": ext, "mime_type": mime})


def parse_document_bytes(
    data: bytes,
    *,
    filename: str | None = None,
    mime_type: str | None = None,
    source_id: str | None = None,
    external_id: str | None = None,
    url: str | None = None,
    limits: ParseLimits | None = None,
) -> CanonicalDocument:
    """bytes → CanonicalDocument. Кидає підкласи ParseError."""
    parser = detect_parser(data, filename, mime_type)
    ctx = ParseContext(filename=filename, mime_type=mime_type, source_id=source_id,
                       external_id=external_id, url=url, limits=limits or ParseLimits())
    return parser.parse(data, ctx)
