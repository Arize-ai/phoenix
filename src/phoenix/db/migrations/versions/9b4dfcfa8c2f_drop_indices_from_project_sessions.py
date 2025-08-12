"""drop indices from project_sessions

Revision ID: 9b4dfcfa8c2f
Revises: 735d3d93c33e
Create Date: 2025-08-11 21:11:54.593728

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9b4dfcfa8c2f"
down_revision: Union[str, None] = "735d3d93c33e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_project_sessions_project_id", table_name="project_sessions")
    op.drop_index("ix_project_sessions_start_time", table_name="project_sessions")


def downgrade() -> None:
    op.create_index("ix_project_sessions_project_id", "project_sessions", ["project_id"])
    op.create_index("ix_project_sessions_start_time", "project_sessions", ["start_time"])
