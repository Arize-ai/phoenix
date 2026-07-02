"""add online eval coordination

Revision ID: a7f1c3e9d2b4
Revises: d4e5f6a7b8c9
Create Date: 2026-06-17 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "a7f1c3e9d2b4"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "eval_work_cursors",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "grain",
            sa.String(),
            sa.CheckConstraint("grain IN ('SPAN', 'TRACE', 'SESSION')", name="valid_grain"),
            nullable=False,
        ),
        sa.Column("consumer_group", sa.String(), nullable=False),
        sa.Column(
            "produced_through_id",
            _Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("observed_high_water_id", _Integer, nullable=True),
        sa.Column("observed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("claimed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("claimed_by", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("grain", "consumer_group"),
    )
    op.create_table(
        "eval_work_units",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "span_rowid",
            _Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_id",
            _Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("config_fingerprint", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.String(),
            sa.CheckConstraint(
                "status IN ('PENDING', 'RUNNING', 'DONE', 'ERROR')",
                name="valid_eval_work_status",
            ),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("claimed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("claimed_by", sa.String(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("cooldown_until", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("span_rowid", "evaluator_id", "config_fingerprint"),
    )
    op.create_index(
        "ix_eval_work_units_claimable",
        "eval_work_units",
        ["status", "id"],
        postgresql_where=sa.text("status <> 'DONE'"),
        sqlite_where=sa.text("status <> 'DONE'"),
    )
    op.create_index(
        "ix_eval_work_units_evaluator_id",
        "eval_work_units",
        ["evaluator_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_eval_work_units_evaluator_id", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_claimable", table_name="eval_work_units")
    op.drop_table("eval_work_units")
    op.drop_table("eval_work_cursors")
