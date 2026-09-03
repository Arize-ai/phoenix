"""add online eval coordination

Revision ID: a7f1c3e9d2b4
Revises: 4aad9107d196
Create Date: 2026-06-17 00:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

_EVAL_WORK_STATUS_CHECK = (
    "status IN ('PENDING', 'RUNNING', 'ERROR', 'DONE', 'FAILED', 'EXPIRED', 'SUPERSEDED')"
)
_EVAL_SESSION_WORK_STATUS_CHECK = (
    "status IN ('PENDING', 'RUNNING', 'ERROR', 'DONE', 'FAILED', 'EXPIRED', 'SUPERSEDED', "
    "'CONTENT_LOST', 'FILTERED_OUT', 'SAMPLED_OUT')"
)
_LIVE_EVAL_WORK_PREDICATE = "status IN ('PENDING', 'RUNNING', 'ERROR')"
_LIVE_EVAL_SESSION_WORK_PREDICATE = (
    "status IN ('PENDING', 'RUNNING', 'ERROR', 'FILTERED_OUT', 'SAMPLED_OUT')"
)
_TERMINAL_EVAL_WORK_PREDICATE = "status IN ('DONE', 'FAILED', 'EXPIRED', 'SUPERSEDED')"
_TERMINAL_EVAL_SESSION_WORK_PREDICATE = (
    "status IN ('DONE', 'FAILED', 'EXPIRED', 'SUPERSEDED', 'CONTENT_LOST')"
)

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
down_revision: Union[str, None] = "4aad9107d196"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_session_work_units_table() -> None:
    op.create_table(
        "eval_session_work_units",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "project_session_rowid",
            _Integer,
            sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_id",
            _Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_evaluator_id",
            _Integer,
            sa.ForeignKey("project_evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("config_fingerprint", sa.String(), nullable=False),
        sa.Column(
            "evaluated_through",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "transcript_covered_through",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(),
            sa.CheckConstraint(_EVAL_SESSION_WORK_STATUS_CHECK, name="valid_eval_work_status"),
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
    )
    op.create_index(
        "uq_eval_session_work_units_live_key",
        "eval_session_work_units",
        ["project_session_rowid", "evaluator_id", "config_fingerprint"],
        unique=True,
        postgresql_where=sa.text(_LIVE_EVAL_SESSION_WORK_PREDICATE),
        sqlite_where=sa.text(_LIVE_EVAL_SESSION_WORK_PREDICATE),
    )
    op.create_index(
        "ix_eval_session_work_units_claimable",
        "eval_session_work_units",
        ["status", "id"],
        postgresql_where=sa.text(_LIVE_EVAL_WORK_PREDICATE),
        sqlite_where=sa.text(_LIVE_EVAL_WORK_PREDICATE),
    )
    op.create_index(
        "ix_eval_session_work_units_terminal",
        "eval_session_work_units",
        ["updated_at"],
        postgresql_where=sa.text(_TERMINAL_EVAL_SESSION_WORK_PREDICATE),
        sqlite_where=sa.text(_TERMINAL_EVAL_SESSION_WORK_PREDICATE),
    )
    op.create_index(
        "ix_eval_session_work_units_terminal_watermark",
        "eval_session_work_units",
        ["project_session_rowid", "evaluator_id", "config_fingerprint"],
    )
    op.create_index(
        "ix_eval_session_work_units_evaluator_id",
        "eval_session_work_units",
        ["evaluator_id"],
    )
    op.create_index(
        "ix_eval_session_work_units_project_evaluator_id",
        "eval_session_work_units",
        ["project_evaluator_id"],
    )


def upgrade() -> None:
    # project_sessions carries raw-expression DESC indexes, so add_column/drop_column are used
    # bare here: batch mode would rebuild the table by reflection and silently recreate those
    # indexes as ascending. SQLite supports both statements natively on this column.
    op.add_column(
        "project_sessions",
        sa.Column(
            "last_span_ingested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "project_sessions",
        sa.Column(
            "content_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.create_index(
        "ix_project_sessions_project_id_last_span_ingested_at",
        "project_sessions",
        ["project_id", "last_span_ingested_at"],
        postgresql_where=sa.text("last_span_ingested_at IS NOT NULL"),
        sqlite_where=sa.text("last_span_ingested_at IS NOT NULL"),
    )

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
        "eval_work_leases",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("holder", sa.String(), nullable=True),
        sa.Column("heartbeat_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "project_evaluators",
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
        sa.Column(
            "trace_project_id",
            _Integer,
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
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
        sa.Column(
            "evaluation_delay_seconds",
            sa.Integer(),
            sa.CheckConstraint(
                "evaluation_delay_seconds >= 10",
                name="valid_evaluation_delay_seconds",
            ),
            nullable=False,
            server_default="300",
        ),
        sa.Column("input_mapping", JSON_, nullable=True),
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
        "ix_project_evaluators_project_id",
        "project_evaluators",
        ["project_id"],
    )
    op.create_index(
        "ix_project_evaluators_evaluator_id",
        "project_evaluators",
        ["evaluator_id"],
    )
    op.create_index(
        "ix_project_evaluators_trace_project_id",
        "project_evaluators",
        ["trace_project_id"],
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
            "project_evaluator_id",
            _Integer,
            sa.ForeignKey("project_evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("config_fingerprint", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.String(),
            sa.CheckConstraint(_EVAL_WORK_STATUS_CHECK, name="valid_eval_work_status"),
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
        postgresql_where=sa.text(_LIVE_EVAL_WORK_PREDICATE),
        sqlite_where=sa.text(_LIVE_EVAL_WORK_PREDICATE),
    )
    op.create_index(
        "ix_eval_work_units_terminal",
        "eval_work_units",
        ["updated_at"],
        postgresql_where=sa.text(_TERMINAL_EVAL_WORK_PREDICATE),
        sqlite_where=sa.text(_TERMINAL_EVAL_WORK_PREDICATE),
    )
    op.create_index(
        "ix_eval_work_units_evaluator_id",
        "eval_work_units",
        ["evaluator_id"],
    )
    op.create_index(
        "ix_eval_work_units_project_evaluator_id",
        "eval_work_units",
        ["project_evaluator_id"],
    )
    _create_session_work_units_table()


def downgrade() -> None:
    op.drop_index(
        "ix_eval_session_work_units_project_evaluator_id", table_name="eval_session_work_units"
    )
    op.drop_index("ix_eval_session_work_units_evaluator_id", table_name="eval_session_work_units")
    op.drop_index(
        "ix_eval_session_work_units_terminal_watermark",
        table_name="eval_session_work_units",
    )
    op.drop_index("ix_eval_session_work_units_terminal", table_name="eval_session_work_units")
    op.drop_index("ix_eval_session_work_units_claimable", table_name="eval_session_work_units")
    op.drop_table("eval_session_work_units")

    op.drop_index("ix_eval_work_units_project_evaluator_id", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_evaluator_id", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_terminal", table_name="eval_work_units")
    op.drop_index("ix_eval_work_units_claimable", table_name="eval_work_units")
    op.drop_table("eval_work_units")
    op.drop_index("ix_project_evaluators_evaluator_id", table_name="project_evaluators")
    op.drop_index("ix_project_evaluators_project_id", table_name="project_evaluators")
    op.drop_table("project_evaluators")
    op.drop_table("eval_work_leases")
    op.drop_table("eval_work_cursors")

    op.drop_index(
        "ix_project_sessions_project_id_last_span_ingested_at",
        table_name="project_sessions",
    )
    op.drop_column("project_sessions", "content_complete")
    op.drop_column("project_sessions", "last_span_ingested_at")
