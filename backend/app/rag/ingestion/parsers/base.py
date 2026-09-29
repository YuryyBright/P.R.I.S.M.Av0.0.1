"""Базовий контракт парсера."""
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
from pathlib import PurePath
from typing import Any, ClassVar

from app.rag.ingestion.canonical import CanonicalBuilder, CanonicalDocument
from app.rag.errors import (
    CorruptFileError, EmptyContentError, LimitExceededError, ParseError,
)


@dataclass(frozen=True, slots=True)
class ParseLimits:
    """Захист від завеликих/шкідливих файлів. Значення — розумні дефолти;
    за потреби прокидайте з settings при створенні ParseContext."""
    max_bytes: int = 100 * 1024 * 1024
    max_pages: int = 2_000
    max_uncompressed_bytes: int = 500 * 1024 * 1024   # zip-bomb (docx)
    max_blocks: int = 200_000
    max_chars: int = 20_000_000


@dataclass(frozen=True, slots=True)
class ParseContext:
    filename: str | None = None
    mime_type: str | None = None
    source_id: str | None = None
    external_id: str | None = None
    url: str | None = None
    limits: ParseLimits = ParseLimits()


class BaseParser(ABC):
    name: ClassVar[str]
    extensions: ClassVar[tuple[str, ...]] = ()
    mime_types: ClassVar[tuple[str, ...]] = ()

    def parse(self, data: bytes, ctx: ParseContext | None = None) -> CanonicalDocument:
        ctx = ctx or ParseContext()
        if not data:
            raise EmptyContentError("File is empty", code="empty_file")
        if len(data) > ctx.limits.max_bytes:
            raise LimitExceededError(
                f"File is {len(data)} bytes, limit is {ctx.limits.max_bytes}")

        builder = CanonicalBuilder(max_blocks=ctx.limits.max_blocks,
                                   max_chars=ctx.limits.max_chars)
        try:
            fields = self._parse(data, ctx, builder) or {}
        except ParseError:
            raise
        except Exception as exc:  # бібліотеки кидають що завгодно на битих файлах
            raise CorruptFileError(
                f"{self.name}: cannot parse file ({type(exc).__name__}: {str(exc)[:300]})",
                details={"exception": type(exc).__name__},
            ) from exc

        if builder.is_empty:
            raise EmptyContentError(f"{self.name}: no extractable text")

        title = fields.get("title") or _stem(ctx.filename)
        metadata: dict[str, Any] = {
            **(fields.get("metadata") or {}),
            "parser": self.name,
            "source_filename": ctx.filename,
            "declared_mime_type": ctx.mime_type,
        }
        doc = builder.build(
            title=title.strip() if title else None,
            author=fields.get("author"),
            published_at=fields.get("published_at"),
            url=fields.get("url") or ctx.url,
            language=fields.get("language"),
            source_id=ctx.source_id,
            external_id=ctx.external_id,
            metadata=metadata,
        )
        return replace(doc)

    @abstractmethod
    def _parse(self, data: bytes, ctx: ParseContext, builder: CanonicalBuilder) -> dict[str, Any] | None:
        """Додає блоки в builder; повертає title/author/published_at/language/url/metadata."""


def _stem(filename: str | None) -> str | None:
    if not filename:
        return None
    stem = PurePath(filename).stem
    return re.sub(r"[_]+", " ", stem).strip() or None
