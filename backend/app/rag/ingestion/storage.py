"""Єдині helper-и для original/canonical blob storage."""
from __future__ import annotations

import json

from app.rag.domain.ports import BlobStorage
from app.rag.errors import CorruptFileError, LimitExceededError
from app.rag.ingestion.canonical import CanonicalDocument

_CANONICAL_ROOT = "canonical"


def get_blob_storage() -> BlobStorage:
    from app.rag.container import get_container
    return get_container().blobs


def read_original(storage: BlobStorage, path: str, max_bytes: int) -> bytes:
    size = storage.size(path)
    if size > max_bytes:
        raise LimitExceededError(f"Original file is too large (>{max_bytes} bytes)")
    return storage.read_bytes(path)


def _canonical_path(document_id: str) -> str:
    return f"{_CANONICAL_ROOT}/{document_id}.json"


def save_canonical(storage: BlobStorage, document_id: str, document: CanonicalDocument) -> None:
    payload = json.dumps(
        document.to_dict(),
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    storage.write_bytes(_canonical_path(document_id), payload)


def load_canonical(storage: BlobStorage, document_id: str) -> CanonicalDocument:
    data = storage.read_bytes(_canonical_path(document_id))
    try:
        payload = json.loads(data.decode("utf-8"))
        return CanonicalDocument.from_dict(payload)
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, KeyError, ValueError) as exc:
        raise CorruptFileError(f"Invalid canonical document: {document_id}") from exc


def delete_canonical(storage: BlobStorage, document_id: str) -> None:
    """Ідемпотентно: відсутній файл — не помилка."""
    storage.delete(_canonical_path(document_id))


def delete_original(storage: BlobStorage, path: str) -> None:
    """Ідемпотентно: відсутній файл — не помилка."""
    storage.delete(path)