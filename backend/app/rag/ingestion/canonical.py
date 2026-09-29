"""CanonicalDocument — єдиний формат, до якого зводяться ВСІ джерела.

Далі pipeline однаковий: cleaning → chunking → embedding → index.
Модуль не залежить від SQLAlchemy/Celery/Qdrant.

Текст блоків не дублюється: `content` — повний текст, а Block зберігає лише
позиції [start:end) у ньому. Звідси char_start/char_end для DocumentChunk.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Iterator

SCHEMA_VERSION = 1


class BlockKind(str, Enum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST_ITEM = "list_item"
    TABLE = "table"
    CODE = "code"


@dataclass(frozen=True, slots=True)
class Block:
    kind: BlockKind
    start: int
    end: int
    page: int | None = None     # номер сторінки (PDF), 1-based
    level: int | None = None    # рівень заголовка 1..6

    def to_dict(self) -> dict[str, Any]:
        return {"kind": self.kind.value, "start": self.start, "end": self.end,
                "page": self.page, "level": self.level}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Block":
        return cls(BlockKind(d["kind"]), d["start"], d["end"], d.get("page"), d.get("level"))


@dataclass(slots=True)
class CanonicalDocument:
    content: str
    blocks: list[Block]
    title: str | None = None
    source_id: str | None = None
    external_id: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    url: str | None = None
    language: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def block_text(self, block: Block) -> str:
        return self.content[block.start:block.end]

    def iter_blocks(self) -> Iterator[tuple[Block, str]]:
        for b in self.blocks:
            yield b, self.content[b.start:b.end]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": SCHEMA_VERSION,
            "title": self.title,
            "content": self.content,
            "blocks": [b.to_dict() for b in self.blocks],
            "source_id": self.source_id,
            "external_id": self.external_id,
            "author": self.author,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "url": self.url,
            "language": self.language,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "CanonicalDocument":
        if d.get("schema_version") != SCHEMA_VERSION:
            raise ValueError(f"Unsupported canonical schema_version: {d.get('schema_version')}")
        pub = d.get("published_at")
        return cls(
            content=d["content"],
            blocks=[Block.from_dict(b) for b in d["blocks"]],
            title=d.get("title"),
            source_id=d.get("source_id"),
            external_id=d.get("external_id"),
            author=d.get("author"),
            published_at=datetime.fromisoformat(pub) if pub else None,
            url=d.get("url"),
            language=d.get("language"),
            metadata=d.get("metadata") or {},
        )


# ---- нормалізація тексту -----------------------------------------------------

_INVISIBLE = dict.fromkeys(map(ord, "\u200b\u2060\ufeff\u00ad"), None)  # ZWSP, WJ, BOM, soft hyphen
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0e-\x1f\x7f]")
_SPACES = re.compile(r"[ \t]+")
_ANY_WS = re.compile(r"\s+")


def clean_block_text(text: str, mode: str = "inline") -> str:
    """mode: inline — усі пробіли/переноси → один пробіл (абзац, заголовок, пункт);
    table — переноси рядків зберігаються; code — зберігаються й відступи."""
    text = unicodedata.normalize("NFC", text).translate(_INVISIBLE)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x0c", "\n\n")
    text = text.replace("\u00a0", " ")
    text = _CONTROL.sub("", text)
    if mode == "inline":
        return _ANY_WS.sub(" ", text).strip()
    if mode == "table":
        lines = (_SPACES.sub(" ", ln).strip() for ln in text.split("\n"))
        return "\n".join(ln for ln in lines if ln)
    return "\n".join(ln.rstrip() for ln in text.split("\n")).strip("\n")


class CanonicalBuilder:
    """Збирає content + blocks з правильними зсувами."""

    def __init__(self, *, max_blocks: int, max_chars: int) -> None:
        from app.rag.errors import LimitExceededError  # уникаємо циклів
        self._limit_error = LimitExceededError
        self._max_blocks = max_blocks
        self._max_chars = max_chars
        self._parts: list[str] = []
        self._blocks: list[Block] = []
        self._len = 0
        self._prev: BlockKind | None = None

    @property
    def is_empty(self) -> bool:
        return not self._blocks

    @property
    def blocks_count(self) -> int:
        return len(self._blocks)

    def first_heading(self, level: int | None = None) -> str | None:
        text = "".join(self._parts)
        for b in self._blocks:
            if b.kind is BlockKind.HEADING and (level is None or b.level == level):
                return text[b.start:b.end]
        return None

    def add(self, kind: BlockKind, text: str, *, page: int | None = None,
            level: int | None = None) -> bool:
        mode = "code" if kind is BlockKind.CODE else "table" if kind is BlockKind.TABLE else "inline"
        text = clean_block_text(text, mode)
        if not text:
            return False
        if not self._parts:
            sep = ""
        elif self._prev is BlockKind.LIST_ITEM and kind is BlockKind.LIST_ITEM:
            sep = "\n"
        else:
            sep = "\n\n"
        if len(self._blocks) >= self._max_blocks:
            raise self._limit_error(f"Too many blocks (>{self._max_blocks})")
        if self._len + len(sep) + len(text) > self._max_chars:
            raise self._limit_error(f"Document text too large (>{self._max_chars} chars)")
        start = self._len + len(sep)
        self._parts.append(sep + text)
        self._len = start + len(text)
        self._blocks.append(Block(kind, start, self._len, page, level))
        self._prev = kind
        return True

    def build(self, **fields: Any) -> CanonicalDocument:
        return CanonicalDocument(content="".join(self._parts), blocks=list(self._blocks), **fields)
