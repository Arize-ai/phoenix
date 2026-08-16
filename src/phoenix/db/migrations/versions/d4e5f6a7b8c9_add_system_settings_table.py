"""add system_settings table and index on generative_models.updated_at

Revision ID: d4e5f6a7b8c9
Revises: 0ff41b5b118f
Create Date: 2026-05-14 12:00:00.000000

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

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "0ff41b5b118f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(), nullable=False, primary_key=True),
        sa.Column("value", JSON_, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "updated_by",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_generative_models_updated_at",
        "generative_models",
        ["updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_generative_models_updated_at", table_name="generative_models")
    op.drop_table("system_settings")
