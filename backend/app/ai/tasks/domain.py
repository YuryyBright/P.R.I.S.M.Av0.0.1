from __future__ import annotations
from enum import Enum

class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"
    FAILED = "failed"
    COMPLETED = "completed"
    WAITING_FOR_INPUT = "waiting_for_input"
    WAITING_FOR_TOOL = "waiting_for_tool"

ACTIVE_TASK_STATUSES = (TaskStatus.QUEUED, TaskStatus.RUNNING, TaskStatus.PAUSED, TaskStatus.CANCELLING,
                        TaskStatus.WAITING_FOR_INPUT, TaskStatus.WAITING_FOR_TOOL)
TERMINAL_TASK_STATUSES = (TaskStatus.CANCELLED, TaskStatus.FAILED, TaskStatus.COMPLETED)

class TaskType(str, Enum):
    ANALYSIS = "analysis"
    RESEARCH = "research"
    DOCUMENT_PROCESSING = "document_processing"
    DATASET_PROCESSING = "dataset_processing"
    REPORT_GENERATION = "report_generation"
    AGENT_TASK = "agent_task"

class StageKind(str, Enum):
    INGEST = "ingest"
    PREPROCESS = "preprocess"
    FILTER = "filter"
    RETRIEVE = "retrieve"
    RERANK = "rerank"
    ANALYZE = "analyze"
    DEDUPLICATE = "deduplicate"
    SYNTHESIZE = "synthesize"
    EXPORT = "export"

class ItemStatus(str, Enum):
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
