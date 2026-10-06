"""Імпорт усіх AI-моделей для реєстрації в metadata (Alembic autogenerate)."""
from .agent_profile import AiAgentProfile
from .ai_run import AiRun
from .ai_run_step import AiRunStep
from .prompt_template import AiPromptTemplate
from .prompt_version import AiPromptVersion
from .ai_task import AiTask
from .ai_task_item import AiTaskItem
from .ai_artifact import AiArtifact

__all__ = ["AiAgentProfile", "AiRun", "AiRunStep", "AiPromptTemplate", "AiPromptVersion", "AiTask", "AiTaskItem", "AiArtifact"]
