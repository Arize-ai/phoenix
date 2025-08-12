"""add index to project_sessions

Revision ID: 5d4f7806d5ac
Revises: 9b4dfcfa8c2f
Create Date: 2025-08-11 21:12:09.746960

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5d4f7806d5ac"
down_revision: Union[str, None] = "9b4dfcfa8c2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "CREATE INDEX ix_project_sessions_project_rowid_start_time "
            "ON project_sessions (project_id, start_time DESC)"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_project_sessions_project_rowid_start_time", table_name="project_sessions")
