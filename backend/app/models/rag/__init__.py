"""Імпорт усіх RAG-моделей реєструє їх у SQLModel.metadata (потрібно для Alembic).

У fastapi_rbac ДОДАЙТЕ ці імпорти до існуючого app/models/__init__.py
(або туди, звідки alembic/env.py збирає моделі), не замінюючи наявні.
"""
from app.models.rag.collection import Collection
from app.models.rag.collection_member import CollectionMember
from app.models.rag.document import Document
from app.models.rag.document_acl import DocumentACL
from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.ingestion_stage import IngestionStage
from app.models.rag.rag_citation import RagCitation
from app.models.rag.rag_conversation import RagConversation
from app.models.rag.rag_message import RagMessage
from app.models.rag.rag_query import RagQuery
from app.models.rag.source import Source
from app.models.rag.source_credential import SourceCredential

__all__ = [
    "Collection", "CollectionMember", "Document", "DocumentACL", "DocumentChunk",
    "IngestionJob", "IngestionStage", "RagCitation", "RagConversation",
    "RagMessage", "RagQuery", "Source", "SourceCredential",
]
