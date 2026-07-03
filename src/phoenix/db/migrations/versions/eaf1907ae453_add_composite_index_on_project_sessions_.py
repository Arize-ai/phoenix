"""add composite index on project_sessions project_id end_time

Revision ID: eaf1907ae453
Revises: d4e5f6a7b8c9
Create Date: 2026-07-02 18:34:04.568348

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "eaf1907ae453"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_project_sessions_project_id_end_time "
        "ON project_sessions (project_id, end_time DESC)"
    )


def downgrade() -> None:
    op.drop_index(
        "ix_project_sessions_project_id_end_time",
        table_name="project_sessions",
        if_exists=True,
    )
