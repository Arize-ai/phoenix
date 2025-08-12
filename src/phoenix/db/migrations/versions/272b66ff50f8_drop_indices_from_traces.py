"""drop indices from traces

Revision ID: 272b66ff50f8
Revises: a20694b15f82
Create Date: 2025-08-11 20:37:46.941940

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "272b66ff50f8"
down_revision: Union[str, None] = "a20694b15f82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_traces_project_rowid", table_name="traces")
    op.drop_index("ix_traces_start_time", table_name="traces")


def downgrade() -> None:
    op.create_index("ix_traces_project_rowid", "traces", ["project_rowid"])
    op.create_index("ix_traces_start_time", "traces", ["start_time"])
