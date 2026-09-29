"""Чисті helper-и завантаження файлів."""
import re
from pathlib import PurePosixPath

MIME_BY_EXT: dict[str, str] = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".html": "text/html",
    ".htm": "text/html",
    ".xhtml": "application/xhtml+xml",
    ".json": "application/json",
    ".jsonl": "application/x-ndjson",
    ".ndjson": "application/x-ndjson",
}

_BAD_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def clean_filename(filename: str | None) -> str:
    """Лише basename (без шляхів ../ і C:\\), без керуючих символів, ≤ 255."""
    name = PurePosixPath((filename or "").replace("\\", "/")).name
    name = _BAD_CHARS.sub("", name).strip()
    return name[:255] or "document"


def resolve_mime(filename: str) -> str | None:
    """MIME за розширенням. Заголовку Content-Type клієнта не довіряємо;
    вміст усе одно перевіряє парсер."""
    return MIME_BY_EXT.get(PurePosixPath(filename).suffix.lower())


def title_from_filename(filename: str) -> str:
    stem = PurePosixPath(filename).stem or filename
    return stem[:512]