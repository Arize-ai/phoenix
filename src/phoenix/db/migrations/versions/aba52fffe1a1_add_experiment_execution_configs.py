"""add experiment_execution_configs

Revision ID: aba52fffe1a1
Revises: a1b2c3d4e5f6
Create Date: 2026-01-18 00:00:00.000000

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

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "aba52fffe1a1"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "experiment_execution_configs",
        sa.Column(
            "id",
            _Integer,
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("task_config", JSON_),
        sa.Column("evaluator_configs", JSON_),
        # Ownership tracking for multi-replica coordination
        # claimed_at NOT NULL = running, NULL = not running
        sa.Column(
            "claimed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "claimed_by",
            sa.String(),
            nullable=True,
        ),
        # Cooldown: set on user-initiated stop/resume, not by heartbeat
        sa.Column(
            "toggled_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        # Error tracking (set when experiment fails, e.g., circuit breaker trip)
        sa.Column(
            "last_error",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("experiment_execution_configs")
