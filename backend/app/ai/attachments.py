"""Temporary chat-attachment storage.

Attachments are stored in the existing RAG BlobStorage and are owned by the
authenticated user through the storage key prefix. Metadata is stored as a
small JSON sidecar, so no new database table/migration is required for the
first upload implementation.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import PurePosixPath
from typing import Any

from fastapi import UploadFile

from app.models.users.user_model import User
from app.rag.domain.exceptions import InvalidInputError, NotFoundError, PayloadTooLargeError
from app.rag.domain.ports import BlobStorage

MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
_READ_CHUNK = 1024 * 1024


def _blob_path(user_id: uuid.UUID, attachment_id: uuid.UUID) -> str:
    return f"ai/attachments/{user_id}/{attachment_id}.bin"


def _meta_path(user_id: uuid.UUID, attachment_id: uuid.UUID) -> str:
    return f"ai/attachments/{user_id}/{attachment_id}.json"


def _clean_filename(filename: str | None) -> str:
    name = PurePosixPath((filename or "").replace("\\", "/")).name.strip()
    if not name:
        raise InvalidInputError("File name is required")
    return name[:512]


class AttachmentService:
    def __init__(self, storage: BlobStorage) -> None:
        self.storage = storage

    async def upload(self, user: User, file: UploadFile) -> dict[str, Any]:
        attachment_id = uuid.uuid4()
        filename = _clean_filename(file.filename)
        mime_type = (file.content_type or "application/octet-stream").strip()[:255]

        chunks: list[bytes] = []
        total = 0
        while chunk := await file.read(_READ_CHUNK):
            total += len(chunk)
            if total > MAX_ATTACHMENT_BYTES:
                raise PayloadTooLargeError(
                    f"File is larger than {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB"
                )
            chunks.append(chunk)

        if total == 0:
            raise InvalidInputError("File is empty")

        data = b"".join(chunks)
        storage_path = _blob_path(user.id, attachment_id)
        meta_path = _meta_path(user.id, attachment_id)
        meta = {
            "id": str(attachment_id),
            "owner_id": str(user.id),
            "filename": filename,
            "mime_type": mime_type,
            "size": total,
            "storage_path": storage_path,
        }

        try:
            await asyncio.to_thread(self.storage.write_bytes, storage_path, data)
            await asyncio.to_thread(
                self.storage.write_bytes,
                meta_path,
                json.dumps(meta, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            )
        except Exception:
            try:
                await asyncio.to_thread(self.storage.delete, storage_path)
            except Exception:
                pass
            raise

        return {k: meta[k] for k in ("id", "filename", "mime_type", "size")}

    async def get(self, user: User, attachment_id: uuid.UUID) -> dict[str, Any]:
        meta_path = _meta_path(user.id, attachment_id)
        try:
            raw = await asyncio.to_thread(self.storage.read_bytes, meta_path)
        except Exception as exc:
            raise NotFoundError("Attachment not found") from exc

        try:
            meta = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise NotFoundError("Attachment not found") from exc

        if meta.get("owner_id") != str(user.id) or meta.get("id") != str(attachment_id):
            raise NotFoundError("Attachment not found")

        return meta

    async def delete(self, user: User, attachment_id: uuid.UUID) -> None:
        """Delete an attachment owned by the current user."""
        meta = await self.get(user, attachment_id)
        blob_path = str(meta.get("storage_path") or _blob_path(user.id, attachment_id))
        meta_path = _meta_path(user.id, attachment_id)

        # Validate ownership via get() before touching either storage object.
        await asyncio.to_thread(self.storage.delete, blob_path)
        await asyncio.to_thread(self.storage.delete, meta_path)

    async def validate_many(
        self, user: User, attachment_ids: list[uuid.UUID]
    ) -> list[dict[str, Any]]:
        unique_ids = list(dict.fromkeys(attachment_ids))
        if len(unique_ids) > 5:
            raise InvalidInputError("A message may contain at most 5 attachments")
        return [await self.get(user, attachment_id) for attachment_id in unique_ids]
