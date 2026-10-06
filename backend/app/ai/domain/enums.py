"""Чисті enum-и AI-підсистеми (без SQLAlchemy/FastAPI). У БД — VARCHAR(32), як і в rag."""
from enum import Enum


class RunMode(str, Enum):
    CHAT = "chat"
    AGENT = "agent"


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"   # v2: write-інструменти
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


ACTIVE_RUN_STATUSES = (RunStatus.QUEUED, RunStatus.RUNNING, RunStatus.WAITING_APPROVAL)
TERMINAL_RUN_STATUSES = (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED)


class StepType(str, Enum):
    LLM_CALL = "llm_call"
    TOOL_CALL = "tool_call"
    RETRIEVAL = "retrieval"


class StepStatus(str, Enum):
    OK = "ok"
    ERROR = "error"


class PromptKind(str, Enum):
    CHAT_SYSTEM = "chat_system"
    AGENT_SYSTEM = "agent_system"
    QUERY_REWRITE = "query_rewrite"
    RERANK = "rerank"


class ToolRisk(str, Enum):
    READ = "read"
    WRITE = "write"
