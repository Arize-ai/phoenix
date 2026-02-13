"""add span session.id index

Revision ID: f1a6b2f0c9d5
Revises: a1b2c3d4e5f6
Create Date: 2026-01-19 12:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)

# revision identifiers, used by Alembic.
revision: str = "f1a6b2f0c9d5"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    session_id = sa.column("attributes", JSON_)[["session", "id"]].as_string()
    op.create_index(
        "ix_spans_session_id",
        "spans",
        [session_id],
        unique=False,
        if_not_exists=True,
        postgresql_where=session_id.is_not(None),
        sqlite_where=session_id.is_not(None),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_spans_session_id",
        table_name="spans",
        if_exists=True,
    )
