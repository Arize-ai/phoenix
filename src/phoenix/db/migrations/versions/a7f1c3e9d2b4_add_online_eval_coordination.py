"""add online eval coordination

Revision ID: a7f1c3e9d2b4
Revises: eaf1907ae453
Create Date: 2026-06-17 00:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    return "JSONB"


JSON_ = JSON().with_variant(postgresql.JSONB(), "postgresql").with_variant(JSONB(), "sqlite")

# revision identifiers, used by Alembic.
revision: str = "a7f1c3e9d2b4"
down_revision: Union[str, None] = "eaf1907ae453"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
            "last_seen_span_rowid",
            _Integer,
            sa.ForeignKey("spans.id", ondelete="SET NULL"),
            nullable=True,
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
    op.create_table(
        "eval_work_cursors",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "evaluation_target",
            sa.String(),
            sa.CheckConstraint(
                "evaluation_target IN ('SPAN', 'TRACE', 'SESSION')", name="valid_evaluation_target"
            ),
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
        sa.UniqueConstraint("evaluation_target", "consumer_group"),
    )
    op.create_table(
        "project_evaluator_criteria",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "project_id",
            _Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_id",
            _Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("filter_condition", sa.String(), nullable=False, server_default=""),
        sa.Column(
            "sampling_rate",
            sa.Float(),
            sa.CheckConstraint(
                "0.0 <= sampling_rate AND sampling_rate <= 1.0",
                name="valid_sampling_rate",
            ),
            nullable=False,
        ),
        sa.Column(
            "evaluation_target",
            sa.String(),
            sa.CheckConstraint(
                "evaluation_target IN ('SPAN', 'TRACE', 'SESSION')",
                name="valid_evaluation_target",
            ),
            nullable=False,
        ),
        sa.Column("input_mapping", JSON_, nullable=True),
        sa.Column("evaluation_delay_seconds", sa.Integer(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.UniqueConstraint("project_id", "name"),
    )
    op.create_index(
        "ix_project_evaluator_criteria_project_id",
        "project_evaluator_criteria",
        ["project_id"],
    )
    op.create_index(
        "ix_project_evaluator_criteria_evaluator_id",
        "project_evaluator_criteria",
        ["evaluator_id"],
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
        sa.Column(
            "criteria_id",
            _Integer,
            sa.ForeignKey("project_evaluator_criteria.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("config_fingerprint", sa.String(), nullable=False),
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
        sa.UniqueConstraint("span_rowid", "evaluator_id", "config_fingerprint"),
    )
    op.create_index(
        "ix_eval_work_units_claimable",
        "eval_work_units",
        ["status", "id"],
        postgresql_where=sa.text("status NOT IN ('DONE', 'EXPIRED')"),
        sqlite_where=sa.text("status NOT IN ('DONE', 'EXPIRED')"),
    )
    op.create_index(
        "ix_eval_work_units_terminal",
        "eval_work_units",
        ["updated_at"],
        postgresql_where=sa.text("status IN ('DONE', 'EXPIRED')"),
        sqlite_where=sa.text("status IN ('DONE', 'EXPIRED')"),
    )
    op.create_index(
        "ix_eval_work_units_error_attempts",
        "eval_work_units",
        ["attempts"],
        postgresql_where=sa.text("status = 'ERROR'"),
        sqlite_where=sa.text("status = 'ERROR'"),
    )
    op.create_index(
        "ix_eval_work_units_evaluator_id",
        "eval_work_units",
        ["evaluator_id"],
    )
    op.create_index(
        "ix_eval_work_units_criteria_id",
        "eval_work_units",
        ["criteria_id"],
    )
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

    op.drop_index("ix_eval_work_units_criteria_id", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_evaluator_id", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_error_attempts", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_terminal", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_claimable", table_name="eval_work_units")
    op.drop_table("eval_work_units")
    op.drop_index(
        "ix_project_evaluator_criteria_evaluator_id", table_name="project_evaluator_criteria"
    )
    op.drop_index(
        "ix_project_evaluator_criteria_project_id", table_name="project_evaluator_criteria"
    )
    op.drop_table("project_evaluator_criteria")
    op.drop_table("eval_work_cursors")
