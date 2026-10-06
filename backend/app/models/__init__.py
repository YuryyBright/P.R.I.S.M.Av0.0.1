"""
Application SQLModel registry.

Import all table models here so that:

- SQLModel.metadata contains every table;
- Alembic can discover all models;
- relationship targets are registered before mapper configuration;
- application startup uses one consistent model registry.

Do not remove model imports from this file unless the model is
intentionally excluded from database metadata.
"""

# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

from .audit.audit_log_model import AuditLog


# ---------------------------------------------------------------------------
# Users / RBAC
# ---------------------------------------------------------------------------

from .users.password_history_model import UserPasswordHistory
from .users.permission_group_model import PermissionGroup
from .users.permission_model import Permission
from .users.role_group_map_model import RoleGroupMap
from .users.role_group_model import RoleGroup
from .users.role_model import Role
from .users.role_permission_model import RolePermission
from .users.user_model import User
from .users.user_role_model import UserRole


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------

from .rag.collection import Collection
from .rag.collection_member import CollectionMember
from .rag.document import Document
from .rag.document_acl import DocumentACL
from .rag.document_chunk import DocumentChunk
from .rag.ingestion_job import IngestionJob
from .rag.ingestion_stage import IngestionStage
from .rag.rag_citation import RagCitation
from .rag.rag_conversation import RagConversation
from .rag.rag_message import RagMessage
from .rag.rag_query import RagQuery
from .rag.source import Source
from .rag.source_credential import SourceCredential


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

from .ai.agent_profile import AiAgentProfile
from .ai.ai_artifact import AiArtifact
from .ai.ai_run import AiRun
from .ai.ai_run_step import AiRunStep
from .ai.ai_task import AiTask
from .ai.ai_task_item import AiTaskItem
from .ai.prompt_template import AiPromptTemplate
from .ai.prompt_version import AiPromptVersion


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

__all__ = [
    # Audit
    "AuditLog",

    # Users / RBAC
    "UserPasswordHistory",
    "PermissionGroup",
    "Permission",
    "RoleGroupMap",
    "RoleGroup",
    "Role",
    "RolePermission",
    "User",
    "UserRole",

    # RAG
    "Collection",
    "CollectionMember",
    "Document",
    "DocumentACL",
    "DocumentChunk",
    "IngestionJob",
    "IngestionStage",
    "RagCitation",
    "RagConversation",
    "RagMessage",
    "RagQuery",
    "Source",
    "SourceCredential",

    # AI
    "AiAgentProfile",
    "AiArtifact",
    "AiRun",
    "AiRunStep",
    "AiTask",
    "AiTaskItem",
    "AiPromptTemplate",
    "AiPromptVersion",
]