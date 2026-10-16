"""add system_state table

Revision ID: 45c1d8813138
Revises: 4aad9107d196
Create Date: 2026-10-16 12:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(*args: Any, **kwargs: Any) -> str:
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
revision: str = "45c1d8813138"
down_revision: Union[str, None] = "4aad9107d196"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_state",
        sa.Column("key", sa.String(), nullable=False, primary_key=True),
        sa.Column("value", JSON_, nullable=False),
        sa.Column("revision", sa.BigInteger(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("system_state")
