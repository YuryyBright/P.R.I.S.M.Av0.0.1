"""Optional integration boundary to PRISMA RAG.

The extension never implements RAG ACL itself. The supplied catalog MUST enforce the
same user/collection/document policy as normal RAG access before returning anything.
"""
from __future__ import annotations
from typing import Any, AsyncIterator, Sequence
from uuid import UUID
from app.ai.analysis.contracts import AnalysisResult, DocumentRef
from app.ai.tasks.ports import DataSource, DataSourceRef, DataSourceResolver, DatasetReader

class CatalogDatasetReader:
    def __init__(self, catalog: Any, user: Any, document_id: UUID) -> None:
        self.catalog, self.user, self.document_id = catalog, user, document_id

    async def count(self) -> int:
        return len(
            await self.catalog.read_document_segments(self.user, self.document_id)
        )

    async def iter_items(
        self, *, batch_size: int
    ) -> AsyncIterator[dict[str, Any]]:
        segments=await self.catalog.read_document_segments(self.user,self.document_id)
        for i in range(0,len(segments),batch_size):
            for j,content in enumerate(segments[i:i+batch_size],i): yield {"key":f"{self.document_id}:{j}","document_id":str(self.document_id),"content":content}

class CatalogDataSource:
    def __init__(self, catalog: Any, user: Any, ref: DataSourceRef) -> None:
        self.catalog, self.user, self.ref = catalog, user, ref

    async def open(self, user: Any) -> DatasetReader:
        return CatalogDatasetReader(self.catalog, user, UUID(self.ref.id))

class RagDataSourceResolver:
    def __init__(self, catalog: Any) -> None:
        self.catalog = catalog

    async def resolve(
        self, user: Any, sources: Sequence[DataSourceRef]
    ) -> list[DataSource]:
        # ACL is delegated to DocumentCatalog; no raw ORM/vector access is exposed here.
        out: list[DataSource] = []
        for source in sources:
            if source.type in {"document","file"}:
                docs=await self.catalog.list_documents(user,collection_ids=None,document_ids=[UUID(source.id)],limit=1)
            elif source.type in {"collection","rag_collection"}:
                docs=await self.catalog.list_documents(user,collection_ids=[UUID(source.id)],document_ids=None,limit=1)
            else:
                continue
            if not docs: raise PermissionError(f"DataSource is unavailable: {source.type}:{source.id}")
            out.append(CatalogDataSource(self.catalog,user,source))
        return out
