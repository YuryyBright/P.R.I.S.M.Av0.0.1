"""align ai agent profile step limit

Revision ID: 4b82c50a9f1e
Revises: 091d94ceaa2f
Create Date: 2026-10-08 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "4b82c50a9f1e"
down_revision: Union[str, None] = "091d94ceaa2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("ai_agent_profiles") as batch_op:
        batch_op.create_check_constraint(
            "ck_ai_agent_profiles_max_steps",
            "max_steps BETWEEN 1 AND 50",
        )


def downgrade() -> None:
    with op.batch_alter_table("ai_agent_profiles") as batch_op:
        batch_op.drop_constraint(
            "ck_ai_agent_profiles_max_steps",
            type_="check",
        )
