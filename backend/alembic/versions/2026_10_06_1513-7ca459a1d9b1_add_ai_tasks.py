"""add ai tasks

Revision ID: 7ca459a1d9b1
Revises: 337c0a322dd9
Create Date: 2026-10-06 15:13:05.974541
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "7ca459a1d9b1"
down_revision: Union[str, None] = "337c0a322dd9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # AI TASKS
    # ------------------------------------------------------------------
    # IMPORTANT:
    # result_artifact_id intentionally has NO FK here.
    # The FK is added after ai_artifacts exists because:
    #
    #   ai_tasks.result_artifact_id -> ai_artifacts.id
    #   ai_artifacts.task_id       -> ai_tasks.id
    #
    # This is a circular dependency.
    op.create_table(
        "ai_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),

        sa.Column("user_id", sa.UUID(), nullable=False),

        sa.Column(
            "type",
            sa.Enum(
                "analysis",
                "research",
                "document_processing",
                "dataset_processing",
                "report_generation",
                "agent_task",
                name="tasktype",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "running",
                "paused",
                "cancelling",
                "cancelled",
                "failed",
                "completed",
                "waiting_for_input",
                "waiting_for_tool",
                name="taskstatus",
                native_enum=False,
                length=32,
            ),
            server_default="queued",
            nullable=False,
        ),

        sa.Column(
            "title",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column("instruction", sa.Text(), nullable=False),

        sa.Column(
            "config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),

        # Python model: default_factory=list
        # Therefore PostgreSQL default must be [] rather than {}.
        sa.Column(
            "sources",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),

        sa.Column(
            "progress",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),

        sa.Column(
            "current_stage",
            sqlmodel.sql.sqltypes.AutoString(length=64),
            nullable=True,
        ),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("total_stages", sa.Integer(), nullable=False),

        sa.Column(
            "checkpoint",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),

        sa.Column(
            "celery_task_id",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),

        # Circular FK is added later.
        sa.Column("result_artifact_id", sa.UUID(), nullable=True),

        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "heartbeat_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "cancellation_requested",
            sa.Boolean(),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["user_id"],
            ["User.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("ai_tasks", schema=None) as batch_op:
        batch_op.create_index(
            "ix_ai_tasks_celery_task",
            ["celery_task_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_tasks_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_tasks_result_artifact_id"),
            ["result_artifact_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_tasks_status"),
            ["status"],
            unique=False,
        )
        batch_op.create_index(
            "ix_ai_tasks_status_heartbeat",
            ["status", "heartbeat_at"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_tasks_type"),
            ["type"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_tasks_user_id"),
            ["user_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_ai_tasks_user_status_created",
            ["user_id", "status", "created_at"],
            unique=False,
        )

    # ------------------------------------------------------------------
    # AI ARTIFACTS
    # ------------------------------------------------------------------
    op.create_table(
        "ai_artifacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),

        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),

        sa.Column(
            "type",
            sqlmodel.sql.sqltypes.AutoString(length=64),
            nullable=False,
        ),
        sa.Column(
            "name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "mime_type",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "storage_key",
            sqlmodel.sql.sqltypes.AutoString(length=1024),
            nullable=False,
        ),
        sa.Column("size", sa.BigInteger(), nullable=False),

        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["User.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["ai_tasks.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("ai_artifacts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_artifacts_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_artifacts_owner_id"),
            ["owner_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_artifacts_task_id"),
            ["task_id"],
            unique=False,
        )

    # ------------------------------------------------------------------
    # COMPLETE CIRCULAR FK
    # ------------------------------------------------------------------
    op.create_foreign_key(
        "fk_ai_tasks_result_artifact_id",
        "ai_tasks",
        "ai_artifacts",
        ["result_artifact_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # AI PROMPT TEMPLATES
    # ------------------------------------------------------------------
    op.create_table(
        "ai_prompt_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=True),
        sa.Column(
            "slug",
            sqlmodel.sql.sqltypes.AutoString(length=128),
            nullable=False,
        ),
        sa.Column(
            "name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "kind",
            sa.Enum(
                "chat_system",
                "agent_system",
                "query_rewrite",
                "rerank",
                name="promptkind",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("active_version_id", sa.Uuid(), nullable=True),

        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["User.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_id",
            "slug",
            name="uq_ai_prompt_templates_owner_slug",
        ),
    )

    with op.batch_alter_table("ai_prompt_templates", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_prompt_templates_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_prompt_templates_kind"),
            ["kind"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_prompt_templates_owner_id"),
            ["owner_id"],
            unique=False,
        )
        batch_op.create_index(
            "uq_ai_prompt_templates_system_slug",
            ["slug"],
            unique=True,
            postgresql_where=sa.text("owner_id IS NULL"),
        )

    # ------------------------------------------------------------------
    # AI TASK ITEMS
    # ------------------------------------------------------------------
    op.create_table(
        "ai_task_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column(
            "item_key",
            sqlmodel.sql.sqltypes.AutoString(length=512),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "processing",
                "success",
                "failed",
                "skipped",
                name="itemstatus",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["task_id"],
            ["ai_tasks.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "task_id",
            "item_key",
            name="uq_ai_task_items_task_key",
        ),
    )

    with op.batch_alter_table("ai_task_items", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_task_items_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_task_items_status"),
            ["status"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_task_items_task_id"),
            ["task_id"],
            unique=False,
        )

    # ------------------------------------------------------------------
    # AI AGENT PROFILES
    # ------------------------------------------------------------------
    op.create_table(
        "ai_agent_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=True),
        sa.Column(
            "name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("prompt_template_id", sa.UUID(), nullable=False),
        sa.Column(
            "model_alias",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
        sa.Column(
            "allowed_tools",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "default_collection_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("max_steps", sa.Integer(), nullable=False),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["User.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["prompt_template_id"],
            ["ai_prompt_templates.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("ai_agent_profiles", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_agent_profiles_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_agent_profiles_owner_id"),
            ["owner_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_agent_profiles_prompt_template_id"),
            ["prompt_template_id"],
            unique=False,
        )

    # ------------------------------------------------------------------
    # AI PROMPT VERSIONS
    # ------------------------------------------------------------------
    op.create_table(
        "ai_prompt_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "variables_schema",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "model_params",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("changelog", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.UUID(), nullable=True),

        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["User.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["ai_prompt_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "template_id",
            "version",
            name="uq_ai_prompt_versions_number",
        ),
    )

    with op.batch_alter_table("ai_prompt_versions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_prompt_versions_created_by_id"),
            ["created_by_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_prompt_versions_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_prompt_versions_template_id"),
            ["template_id"],
            unique=False,
        )

    # ------------------------------------------------------------------
    # AI RUNS
    # ------------------------------------------------------------------
    op.create_table(
        "ai_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("user_message_id", sa.UUID(), nullable=True),
        sa.Column("assistant_message_id", sa.UUID(), nullable=True),
        sa.Column("profile_id", sa.UUID(), nullable=True),
        sa.Column(
            "mode",
            sa.Enum(
                "chat",
                "agent",
                name="runmode",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "running",
                "waiting_approval",
                "completed",
                "failed",
                "cancelled",
                name="runstatus",
                native_enum=False,
                length=32,
            ),
            server_default="queued",
            nullable=False,
        ),
        sa.Column(
            "config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "usage",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "celery_task_id",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
        sa.Column(
            "heartbeat_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "error_code",
            sqlmodel.sql.sqltypes.AutoString(length=64),
            nullable=True,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),

        sa.ForeignKeyConstraint(
            ["assistant_message_id"],
            ["rag_messages.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["rag_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["ai_agent_profiles.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["User.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_message_id"],
            ["rag_messages.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("ai_runs", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_runs_assistant_message_id"),
            ["assistant_message_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_ai_runs_celery_task",
            ["celery_task_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_ai_runs_conversation_created",
            ["conversation_id", "created_at"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_runs_conversation_id"),
            ["conversation_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_runs_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_runs_mode"),
            ["mode"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_runs_profile_id"),
            ["profile_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_ai_runs_status_heartbeat",
            ["status", "heartbeat_at"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_runs_user_id"),
            ["user_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_runs_user_message_id"),
            ["user_message_id"],
            unique=False,
        )
        batch_op.create_index(
            "uq_ai_runs_one_active_per_conversation",
            ["conversation_id"],
            unique=True,
            postgresql_where=sa.text(
                "status IN ('queued','running','waiting_approval')"
            ),
        )

    # ------------------------------------------------------------------
    # AI RUN STEPS
    # ------------------------------------------------------------------
    op.create_table(
        "ai_run_steps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("idx", sa.Integer(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "llm_call",
                "tool_call",
                "retrieval",
                name="steptype",
                native_enum=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "name",
            sqlmodel.sql.sqltypes.AutoString(length=128),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "ok",
                "error",
                name="stepstatus",
                native_enum=False,
                length=32,
            ),
            server_default="ok",
            nullable=False,
        ),
        sa.Column(
            "input",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "output",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),

        sa.CheckConstraint(
            "idx >= 0",
            name="ck_ai_run_steps_idx",
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["ai_runs.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "run_id",
            "idx",
            name="uq_ai_run_steps_position",
        ),
    )

    with op.batch_alter_table("ai_run_steps", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_run_steps_id"),
            ["id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_ai_run_steps_run_id"),
            ["run_id"],
            unique=False,
        )

    # ------------------------------------------------------------------
    # EXISTING RAG CHANGES
    # ------------------------------------------------------------------
    with op.batch_alter_table("ingestion_jobs", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("ingestion_jobs_document_id_fkey"),
            type_="foreignkey",
        )
        batch_op.create_foreign_key(
            None,
            "documents",
            ["document_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("rag_conversations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "mode",
                sqlmodel.sql.sqltypes.AutoString(length=16),
                server_default="chat",
                nullable=False,
            )
        )

    with op.batch_alter_table("rag_queries", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("run_id", sa.UUID(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("step_id", sa.UUID(), nullable=True)
        )
        batch_op.create_index(
            batch_op.f("ix_rag_queries_run_id"),
            ["run_id"],
            unique=False,
        )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # EXISTING RAG CHANGES
    # ------------------------------------------------------------------
    with op.batch_alter_table("rag_queries", schema=None) as batch_op:
        batch_op.drop_index(
            batch_op.f("ix_rag_queries_run_id")
        )
        batch_op.drop_column("step_id")
        batch_op.drop_column("run_id")

    with op.batch_alter_table("rag_conversations", schema=None) as batch_op:
        batch_op.drop_column("mode")

    with op.batch_alter_table("ingestion_jobs", schema=None) as batch_op:
        batch_op.drop_constraint(
            None,
            type_="foreignkey",
        )
        batch_op.create_foreign_key(
            batch_op.f("ingestion_jobs_document_id_fkey"),
            "documents",
            ["document_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # ------------------------------------------------------------------
    # AI RUN STEPS
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_run_steps", schema=None) as batch_op:
        batch_op.drop_index(
            batch_op.f("ix_ai_run_steps_run_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_run_steps_id")
        )

    op.drop_table("ai_run_steps")

    # ------------------------------------------------------------------
    # AI RUNS
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_runs", schema=None) as batch_op:
        batch_op.drop_index(
            "uq_ai_runs_one_active_per_conversation",
            postgresql_where=sa.text(
                "status IN ('queued','running','waiting_approval')"
            ),
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_user_message_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_user_id")
        )
        batch_op.drop_index(
            "ix_ai_runs_status_heartbeat"
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_profile_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_mode")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_conversation_id")
        )
        batch_op.drop_index(
            "ix_ai_runs_conversation_created"
        )
        batch_op.drop_index(
            "ix_ai_runs_celery_task"
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_runs_assistant_message_id")
        )

    op.drop_table("ai_runs")

    # ------------------------------------------------------------------
    # AI PROMPT VERSIONS
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_prompt_versions", schema=None) as batch_op:
        batch_op.drop_index(
            batch_op.f("ix_ai_prompt_versions_template_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_prompt_versions_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_prompt_versions_created_by_id")
        )

    op.drop_table("ai_prompt_versions")

    # ------------------------------------------------------------------
    # AI AGENT PROFILES
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_agent_profiles", schema=None) as batch_op:
        batch_op.drop_index(
            batch_op.f("ix_ai_agent_profiles_prompt_template_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_agent_profiles_owner_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_agent_profiles_id")
        )

    op.drop_table("ai_agent_profiles")

    # ------------------------------------------------------------------
    # AI TASK ITEMS
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_task_items", schema=None) as batch_op:
        batch_op.drop_index(
            batch_op.f("ix_ai_task_items_task_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_task_items_status")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_task_items_id")
        )

    op.drop_table("ai_task_items")

    # ------------------------------------------------------------------
    # AI PROMPT TEMPLATES
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_prompt_templates", schema=None) as batch_op:
        batch_op.drop_index(
            "uq_ai_prompt_templates_system_slug",
            postgresql_where=sa.text("owner_id IS NULL"),
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_prompt_templates_owner_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_prompt_templates_kind")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_prompt_templates_id")
        )

    op.drop_table("ai_prompt_templates")

    # ------------------------------------------------------------------
    # AI ARTIFACTS
    # ------------------------------------------------------------------
    op.drop_constraint(
        "fk_ai_tasks_result_artifact_id",
        "ai_tasks",
        type_="foreignkey",
    )

    with op.batch_alter_table("ai_artifacts", schema=None) as batch_op:
        batch_op.drop_index(
            batch_op.f("ix_ai_artifacts_task_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_artifacts_owner_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_artifacts_id")
        )

    op.drop_table("ai_artifacts")

    # ------------------------------------------------------------------
    # AI TASKS
    # ------------------------------------------------------------------
    with op.batch_alter_table("ai_tasks", schema=None) as batch_op:
        batch_op.drop_index(
            "ix_ai_tasks_user_status_created"
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_tasks_user_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_tasks_type")
        )
        batch_op.drop_index(
            "ix_ai_tasks_status_heartbeat"
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_tasks_status")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_tasks_result_artifact_id")
        )
        batch_op.drop_index(
            batch_op.f("ix_ai_tasks_id")
        )
        batch_op.drop_index(
            "ix_ai_tasks_celery_task"
        )

    op.drop_table("ai_tasks")