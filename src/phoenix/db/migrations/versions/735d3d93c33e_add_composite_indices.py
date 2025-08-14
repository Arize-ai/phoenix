"""add composite indices to traces, project_sessions, and partial index to spans

Revision ID: 735d3d93c33e
Revises: 272b66ff50f8
Create Date: 2025-08-11 20:52:47.477712

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "735d3d93c33e"
down_revision: Union[str, None] = "272b66ff50f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "CREATE INDEX ix_traces_project_rowid_start_time "
            "ON traces (project_rowid, start_time DESC)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX ix_project_sessions_project_id_start_time "
            "ON project_sessions (project_id, start_time DESC)"
        )
    )
    op.execute(
        sa.text("CREATE INDEX ix_spans_trace_rowid_start_time ON spans (trace_rowid, start_time)")
    )
    op.execute(
        sa.text(
            "CREATE INDEX ix_spans_trace_rowid_start_time_where_parent_id_is_null "
            "ON spans (trace_rowid, start_time) WHERE parent_id IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_traces_project_rowid_start_time", table_name="traces")
    op.drop_index("ix_project_sessions_project_id_start_time", table_name="project_sessions")
    op.drop_index("ix_spans_trace_rowid_start_time", table_name="spans")
    op.drop_index("ix_spans_trace_rowid_where_parent_id_is_null", table_name="spans")
