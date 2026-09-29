"""Чисті enum-и RAG-підсистеми.

Без залежностей від SQLAlchemy/FastAPI/Qdrant — їх імпортують і domain,
і models, і schemas. У БД зберігаються як VARCHAR (не native ENUM), щоб
додавання нових значень не вимагало складних Alembic-міграцій.
"""
from enum import Enum


class CollectionVisibility(str, Enum):
    PRIVATE = "private"    # тільки owner + members
    SHARED = "shared"      # owner + members (явно запрошені)
    PUBLIC = "public"      # усі автентифіковані користувачі з rag.collections.read


class CollectionRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class DocumentSourceType(str, Enum):
    UPLOAD = "upload"
    TELEGRAM = "telegram"
    RSS = "rss"
    WEB = "web"
    API = "api"
    GENERATED = "generated"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"


class SourceType(str, Enum):
    TELEGRAM = "telegram"
    RSS = "rss"
    WEB = "web"
    FILE = "file"
    API = "api"


class JobType(str, Enum):
    DOCUMENT_INGEST = "document_ingest"
    SOURCE_SYNC = "source_sync"
    REINDEX = "reindex"
    CLEANUP = "cleanup"


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class IngestionStageName(str, Enum):
    PARSE = "parse"
    CLEAN = "clean"
    CHUNK = "chunk"
    EMBED = "embed"
    INDEX = "index"
    FINALIZE = "finalize"


class StageStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
