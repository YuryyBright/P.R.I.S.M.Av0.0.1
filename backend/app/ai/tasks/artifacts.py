from __future__ import annotations
from typing import Any, Callable
from uuid import UUID
from app.ai.tasks.ports import ArtifactStore
from app.models.ai.ai_artifact import AiArtifact

class ArtifactService:
    def __init__(self, session_factory: Callable, store: ArtifactStore): self.sf,self.store=session_factory,store
    async def save_text(self, *, owner_id: UUID, task_id: UUID, name: str, content: str, mime_type: str) -> dict[str,Any]:
        raw=content.encode("utf-8"); key=await self.store.save(owner_id=owner_id,task_id=task_id,name=name,content=raw,mime_type=mime_type,metadata={})
        async with self.sf() as db:
            artifact=AiArtifact(task_id=task_id,owner_id=owner_id,type=name.rsplit(".",1)[-1] if "." in name else "text",name=name,mime_type=mime_type,storage_key=key,size=len(raw),meta={})
            db.add(artifact); await db.commit(); await db.refresh(artifact)
            return {"id":str(artifact.id),"name":artifact.name,"storage_key":key,"mime_type":mime_type,"size":len(raw)}
