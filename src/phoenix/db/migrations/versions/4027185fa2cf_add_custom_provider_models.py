"""add models to custom providers

Revision ID: 4027185fa2cf
Revises: ef09e3bc213f
Create Date: 2026-11-06 12:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

revision: str = "4027185fa2cf"
down_revision: Union[str, None] = "ef09e3bc213f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    return "JSONB"


JSON_ = JSON().with_variant(postgresql.JSONB(), "postgresql").with_variant(JSONB(), "sqlite")


def upgrade() -> None:
    # Every provider that exists before this migration serves chat models only.
    with op.batch_alter_table("generative_model_custom_providers") as batch_op:
        batch_op.add_column(
            sa.Column("models", JSON_, nullable=False, server_default='{"chat": {}}')
        )


def downgrade() -> None:
    with op.batch_alter_table("generative_model_custom_providers") as batch_op:
        batch_op.drop_column("models")
