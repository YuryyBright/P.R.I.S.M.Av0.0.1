"""Локальне blob-сховище. Запис атомарний; вихід за межі root заборонено."""
from __future__ import annotations
import os
import tempfile
from pathlib import Path

from app.rag.errors import MissingFileError
from app.rag.settings import StorageSettings


class LocalBlobStorage:
    def __init__(self, cfg: StorageSettings) -> None:
        self.root = Path(cfg.local_root).resolve()

    def _resolve(self, path: str) -> Path:
        p = (self.root / path).resolve()
        if not p.is_relative_to(self.root):
            raise ValueError(f"path escapes storage root: {path!r}")
        return p

    def size(self, path: str) -> int:
        try:
            return self._resolve(path).stat().st_size
        except FileNotFoundError as e:
            raise MissingFileError(f"blob not found: {path}") from e

    def read_bytes(self, path: str) -> bytes:
        try:
            return self._resolve(path).read_bytes()
        except FileNotFoundError as e:
            raise MissingFileError(f"blob not found: {path}") from e

    def write_bytes(self, path: str, data: bytes) -> None:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=target.parent, prefix=".tmp-")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            os.replace(tmp, target)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
    def delete(self, path: str) -> None:
        target = self._resolve(path)
        try:
            target.unlink()
        except FileNotFoundError as e:
            raise MissingFileError(f"blob not found: {path}") from e