"""add span session.id index

Revision ID: f1a6b2f0c9d5
Revises: deb2c81c0bb2
Create Date: 2026-01-19 12:00:00.000000

"""

from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a6b2f0c9d5"
down_revision: Union[str, None] = "deb2c81c0bb2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect = op.get_context().dialect.name
    if dialect == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_spans_session_id "
            "ON spans ((CAST(attributes #>> '{session, id}' AS VARCHAR)))"
        )
    elif dialect == "sqlite":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_spans_session_id "
            "ON spans (json_extract(attributes, '$.\"session\".\"id\"'))"
        )
    else:
        # Unknown dialect; skip to avoid migration failure.
        return


def downgrade() -> None:
    op.drop_index(
        "ix_spans_session_id",
        table_name="spans",
        if_exists=True,
    )
