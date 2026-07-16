"""add session eval queue substrate

Revision ID: 48bab43e71d7
Revises: a7f1c3e9d2b4
Create Date: 2026-07-16 15:30:55.692516

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "48bab43e71d7"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def _create_work_units_table(
    table_name: str,
    entity_column: str,
    entity_table: str,
) -> None:
    op.create_table(
        table_name,
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            entity_column,
            _Integer,
            sa.ForeignKey(f"{entity_table}.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_id",
            _Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "criteria_id",
            _Integer,
            sa.ForeignKey("project_evaluator_criteria.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("config_fingerprint", sa.String(), nullable=False),
        sa.Column("generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.String(),
            sa.CheckConstraint(
                "status IN ('PENDING', 'RUNNING', 'DONE', 'ERROR', 'EXPIRED')",
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
        sa.UniqueConstraint(
            entity_column,
            "evaluator_id",
            "config_fingerprint",
            "generation",
        ),
    )
    op.create_index(
        f"ix_{table_name}_claimable",
        table_name,
        ["status", "id"],
        postgresql_where=sa.text("status NOT IN ('DONE', 'EXPIRED')"),
        sqlite_where=sa.text("status NOT IN ('DONE', 'EXPIRED')"),
    )
    op.create_index(
        f"ix_{table_name}_terminal",
        table_name,
        ["updated_at"],
        postgresql_where=sa.text("status IN ('DONE', 'EXPIRED')"),
        sqlite_where=sa.text("status IN ('DONE', 'EXPIRED')"),
    )
    op.create_index(
        f"ix_{table_name}_error_attempts",
        table_name,
        ["attempts"],
        postgresql_where=sa.text("status = 'ERROR'"),
        sqlite_where=sa.text("status = 'ERROR'"),
    )
    op.create_index(f"ix_{table_name}_evaluator_id", table_name, ["evaluator_id"])
    op.create_index(f"ix_{table_name}_criteria_id", table_name, ["criteria_id"])


def _create_activity_table(
    table_name: str,
    entity_column: str,
    entity_table: str,
) -> None:
    op.create_table(
        table_name,
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            entity_column,
            _Integer,
            sa.ForeignKey(f"{entity_table}.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_span_id",
            _Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "observed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(entity_column),
    )
    op.create_index(f"ix_{table_name}_observed_at", table_name, ["observed_at"])


def upgrade() -> None:
    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.add_column(sa.Column("evaluation_delay_seconds", sa.Integer(), nullable=True))

    _create_work_units_table(
        "eval_session_work_units",
        "project_session_rowid",
        "project_sessions",
    )
    _create_work_units_table("eval_trace_work_units", "trace_rowid", "traces")
    _create_activity_table(
        "eval_session_activity",
        "project_session_rowid",
        "project_sessions",
    )
    _create_activity_table("eval_trace_activity", "trace_rowid", "traces")


def downgrade() -> None:
    op.drop_index("ix_eval_trace_activity_observed_at", table_name="eval_trace_activity")
    op.drop_table("eval_trace_activity")
    op.drop_index("ix_eval_session_activity_observed_at", table_name="eval_session_activity")
    op.drop_table("eval_session_activity")

    for table_name in ("eval_trace_work_units", "eval_session_work_units"):
        op.drop_index(f"ix_{table_name}_criteria_id", table_name=table_name)
        op.drop_index(f"ix_{table_name}_evaluator_id", table_name=table_name)
        op.drop_index(f"ix_{table_name}_error_attempts", table_name=table_name)
        op.drop_index(f"ix_{table_name}_terminal", table_name=table_name)
        op.drop_index(f"ix_{table_name}_claimable", table_name=table_name)
        op.drop_table(table_name)

    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.drop_column("evaluation_delay_seconds")
