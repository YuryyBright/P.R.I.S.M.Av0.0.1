"""Heading-aware chunker: CanonicalDocument -> list[ChunkDraft].

Чиста логіка: без БД, Celery і storage. Текст чанка — це зріз
`doc.content[char_start:char_end]`, тому позиції для цитат точні за побудовою.

Правила:
- секція = від заголовка до наступного заголовка; чанк не перетинає межу секції;
- заголовок «приклеюється» до тексту після нього (не залишається сам);
- накопичуємо блоки до target_tokens, жорсткий ліміт — max_tokens;
- завеликий блок ріжемо: абзац/пункт — за реченнями, таблиця/код — за рядками,
  а якщо й це завелике — за словами (крайній випадок — за символами);
- overlap_tokens — лише всередині секції.
"""
import re
from dataclasses import dataclass
from functools import lru_cache
from hashlib import sha256
from typing import Callable

from app.rag.ingestion.canonical import BlockKind, CanonicalDocument
from app.rag.settings import ChunkingSettings

TokenCounter = Callable[[str], int]

_SENT = re.compile(r"(?<=[.!?…])\s+")
_WORD = re.compile(r"\S+")
_HEADING_MAX_CHARS = 200


@lru_cache
def default_token_counter() -> TokenCounter:
    """tiktoken (cl100k_base), якщо доступний; інакше груба оцінка chars/3.

    УВАГА: tiktoken при першому виклику качає словник з мережі. У закритому
    середовищі спрацює fallback. Для продакшену підставте токенайзер вашої
    embedding-моделі — головне, щоб він був єдиним у всьому pipeline.
    """
    try:
        import tiktoken

        enc = tiktoken.get_encoding("cl100k_base")
        return lambda t: len(enc.encode(t, disallowed_special=()))
    except Exception:  # noqa: BLE001
        return lambda t: (len(t) + 2) // 3 if t else 0


@dataclass(slots=True)
class ChunkDraft:
    index: int
    content: str
    content_hash: str
    token_count: int
    char_start: int
    char_end: int
    page_start: int | None
    page_end: int | None
    heading_path: list[str]


@dataclass(slots=True)
class _Piece:
    start: int              # позиції в doc.content
    end: int
    tokens: int
    page: int | None
    heading: bool
    path: tuple[str, ...]


# ---- нарізка одного блоку ----------------------------------------------------

def _sentence_spans(text: str) -> list[tuple[int, int]]:
    spans, pos = [], 0
    for m in _SENT.finditer(text):
        spans.append((pos, m.start()))
        pos = m.end()
    spans.append((pos, len(text)))
    return [(s, e) for s, e in spans if e > s]


def _line_spans(text: str) -> list[tuple[int, int]]:
    spans, pos = [], 0
    for line in text.split("\n"):
        end = pos + len(line)
        if line.strip():
            spans.append((pos, end))
        pos = end + 1
    return spans


def _split_oversize(text: str, s: int, e: int, limit: int, count: TokenCounter) -> list[tuple[int, int]]:
    """Ріже [s:e) на вікна ≤ limit токенів за словами."""
    spans: list[tuple[int, int]] = []
    cur_s: int | None = None
    cur_e: int | None = None
    cur_t = 0
    for m in _WORD.finditer(text, s, e):
        w_t = count(m.group()) + 1
        if w_t > limit:                       # «слово» завелике саме по собі
            if cur_s is not None:
                assert cur_e is not None
                spans.append((cur_s, cur_e))
                cur_s, cur_t = None, 0
            step = max(1, limit // 2)
            for i in range(m.start(), m.end(), step):
                spans.append((i, min(i + step, m.end())))
            continue
        if cur_s is not None and cur_t + w_t > limit:
            assert cur_e is not None
            spans.append((cur_s, cur_e))
            cur_s, cur_t = None, 0
        if cur_s is None:
            cur_s = m.start()
        cur_e = m.end()
        cur_t += w_t
    if cur_s is not None:
        assert cur_e is not None
        spans.append((cur_s, cur_e))
    return spans


def _block_pieces(kind: BlockKind, start: int, end: int, page: int | None, text: str,
                  path: tuple[str, ...], cfg: ChunkingSettings, count: TokenCounter) -> list[_Piece]:
    heading = kind is BlockKind.HEADING
    total = count(text)
    if total <= cfg.max_tokens:
        return [_Piece(start, end, total, page, heading, path)]
    atomic = _line_spans(text) if kind in (BlockKind.TABLE, BlockKind.CODE) else _sentence_spans(text)
    out: list[_Piece] = []
    for s, e in atomic:
        t = count(text[s:e])
        if t <= cfg.max_tokens:
            out.append(_Piece(start + s, start + e, t, page, heading, path))
            continue
        for ss, ee in _split_oversize(text, s, e, cfg.target_tokens, count):
            out.append(_Piece(start + ss, start + ee, count(text[ss:ee]), page, heading, path))
    return out


# ---- основний алгоритм -------------------------------------------------------

def chunk_document(doc: CanonicalDocument, cfg: ChunkingSettings,
                   count: TokenCounter | None = None) -> list[ChunkDraft]:
    counter: TokenCounter = count or default_token_counter()
    content = doc.content
    drafts: list[ChunkDraft] = []
    cur: list[_Piece] = []
    n_overlap = 0                                   # скільки перших pieces — overlap
    stack: list[tuple[int, str]] = []               # (level, heading text)

    def fresh() -> bool:
        return len(cur) > n_overlap

    def has_body() -> bool:
        return any(not p.heading for p in cur[n_overlap:])

    def emit() -> None:
        first, last = cur[0], cur[-1]
        text = content[first.start:last.end]
        pages = [p.page for p in cur if p.page is not None]
        drafts.append(ChunkDraft(
            index=len(drafts), content=text,
            content_hash=sha256(text.encode("utf-8")).hexdigest(),
            token_count=counter(text), char_start=first.start, char_end=last.end,
            page_start=pages[0] if pages else None, page_end=pages[-1] if pages else None,
            heading_path=list(last.path)))

    def flush(carry_overlap: bool) -> None:
        nonlocal cur, n_overlap
        tail: list[_Piece] = []
        if fresh():
            emit()
            if carry_overlap and cfg.overlap_tokens > 0:
                total = 0
                for p in reversed(cur):
                    if p.heading or total + p.tokens > cfg.overlap_tokens:
                        break
                    tail.append(p)
                    total += p.tokens
                tail.reverse()
        cur, n_overlap = tail, len(tail)

    def add(p: _Piece) -> None:
        nonlocal cur, n_overlap
        if cur:
            t = counter(content[cur[0].start:p.end])
            if t > cfg.max_tokens or (t > cfg.target_tokens and has_body()):
                if fresh():
                    flush(True)
                else:
                    cur, n_overlap = [], 0
                # overlap не має «з'їдати» місце під новий piece
                if cur and counter(content[cur[0].start:p.end]) > cfg.max_tokens:
                    cur, n_overlap = [], 0
        cur.append(p)

    for block, text in doc.iter_blocks():
        if block.kind is BlockKind.HEADING:
            if has_body():
                flush(False)                        # нова секція: без overlap
            elif n_overlap:
                cur, n_overlap = [], 0
            level = block.level or 1
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, text[:_HEADING_MAX_CHARS]))
        path = tuple(t for _, t in stack)
        for piece in _block_pieces(block.kind, block.start, block.end, block.page,
                                   text, path, cfg, counter):
            add(piece)

    if fresh():
        emit()
    return drafts
