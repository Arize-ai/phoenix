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

from phoenix.db.eval_work import (
    evaluator_signal_kind_check,
    live_eval_session_work_index_predicate,
    undrained_evaluator_signal_predicate,
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
            "criteria_id",
            _Integer,
            sa.ForeignKey("project_evaluator_criteria.id", ondelete="CASCADE"),
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
            sa.CheckConstraint(
                "status IN ('PENDING', 'RUNNING', 'DONE', 'ERROR', 'EXPIRED', "
                "'FILTERED_OUT', 'SAMPLED_OUT')",
                name="valid_eval_work_status",
            ),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "scheduling_origin",
            sa.String(),
            sa.CheckConstraint(
                "scheduling_origin IN ('AMBIENT', 'RULE', 'EXPLICIT')",
                name="valid_scheduling_origin",
            ),
            nullable=False,
            server_default="AMBIENT",
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
        postgresql_where=sa.text(live_eval_session_work_index_predicate()),
        sqlite_where=sa.text(live_eval_session_work_index_predicate()),
    )
    op.create_index(
        "ix_eval_session_work_units_claimable",
        "eval_session_work_units",
        ["status", "id"],
        postgresql_where=sa.text("status IN ('PENDING', 'RUNNING', 'ERROR')"),
        sqlite_where=sa.text("status IN ('PENDING', 'RUNNING', 'ERROR')"),
    )
    op.create_index(
        "ix_eval_session_work_units_terminal",
        "eval_session_work_units",
        ["updated_at"],
        postgresql_where=sa.text("status IN ('DONE', 'EXPIRED')"),
        sqlite_where=sa.text("status IN ('DONE', 'EXPIRED')"),
    )
    op.create_index(
        "ix_eval_session_work_units_terminal_watermark",
        "eval_session_work_units",
        ["project_session_rowid", "evaluator_id", "config_fingerprint"],
    )
    op.create_index(
        "ix_eval_session_work_units_error_attempts",
        "eval_session_work_units",
        ["attempts"],
        postgresql_where=sa.text("status = 'ERROR'"),
        sqlite_where=sa.text("status = 'ERROR'"),
    )
    op.create_index(
        "ix_eval_session_work_units_evaluator_id",
        "eval_session_work_units",
        ["evaluator_id"],
    )
    op.create_index(
        "ix_eval_session_work_units_criteria_id",
        "eval_session_work_units",
        ["criteria_id"],
    )


def _create_evaluator_signals_table() -> None:
    op.create_table(
        "evaluator_signals",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint(evaluator_signal_kind_check("kind"), name="valid_signal_kind"),
            nullable=False,
        ),
        sa.Column("dedup_key", sa.String(), nullable=False),
        sa.Column(
            "project_id",
            _Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_session_rowid",
            _Integer,
            sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("payload", JSON_, nullable=False),
        sa.Column("acknowledged_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("kind", "dedup_key"),
    )
    # Auto-increment ids are allocation-ordered, not commit-ordered, so a scalar cursor can
    # permanently skip a signal whose transaction committed late. Unacknowledged-ness has no
    # such hole, and this index holds only the small undrained set.
    op.create_index(
        "ix_evaluator_signals_undrained",
        "evaluator_signals",
        ["id"],
        postgresql_where=sa.text(undrained_evaluator_signal_predicate()),
        sqlite_where=sa.text(undrained_evaluator_signal_predicate()),
    )
    op.create_index(
        "ix_evaluator_signals_project_id",
        "evaluator_signals",
        ["project_id"],
    )
    op.create_index(
        "ix_evaluator_signals_project_session_rowid",
        "evaluator_signals",
        ["project_session_rowid"],
    )


def _create_project_evaluator_triggers_table() -> None:
    op.create_table(
        "project_evaluator_triggers",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "criteria_id",
            _Integer,
            sa.ForeignKey("project_evaluator_criteria.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "signal_kind",
            sa.String(),
            sa.CheckConstraint(
                evaluator_signal_kind_check("signal_kind"), name="valid_signal_kind"
            ),
            nullable=False,
        ),
        sa.Column("annotation_name", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("score_below", sa.Float(), nullable=True),
        sa.Column("score_above", sa.Float(), nullable=True),
        sa.Column(
            "annotator_kind",
            sa.String(),
            sa.CheckConstraint(
                "annotator_kind IN ('LLM', 'CODE', 'HUMAN')",
                name="valid_annotator_kind",
            ),
            nullable=True,
        ),
        sa.Column(
            "annotation_change",
            sa.String(),
            sa.CheckConstraint(
                "annotation_change IN ('created', 'updated')",
                name="valid_annotation_change",
            ),
            nullable=True,
        ),
        sa.Column(
            "annotation_target",
            sa.String(),
            sa.CheckConstraint(
                "annotation_target IN ('span', 'trace', 'session')",
                name="valid_annotation_target",
            ),
            nullable=True,
        ),
        sa.Column(
            "source_criteria_id",
            _Integer,
            sa.ForeignKey("project_evaluator_criteria.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "result_changed_only",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
        sa.CheckConstraint(
            "signal_kind != 'annotation_upserted' OR "
            "(source_criteria_id IS NULL AND result_changed_only = false)",
            name="valid_annotation_predicates",
        ),
        sa.CheckConstraint(
            "signal_kind != 'evaluation_completed' OR "
            "(annotator_kind IS NULL AND annotation_change IS NULL AND annotation_target IS NULL)",
            name="valid_evaluation_predicates",
        ),
    )
    op.create_index(
        "ix_project_evaluator_triggers_criteria_id",
        "project_evaluator_triggers",
        ["criteria_id"],
    )
    op.create_index(
        "ix_project_evaluator_triggers_source_criteria_id",
        "project_evaluator_triggers",
        ["source_criteria_id"],
    )


def _create_evaluation_requests_table() -> None:
    op.create_table(
        "evaluation_requests",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "project_session_rowid",
            _Integer,
            sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "criteria_id",
            _Integer,
            sa.ForeignKey("project_evaluator_criteria.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requested_generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("materialized_generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("force_requested_generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "materialized_by_session_work_unit_id",
            _Integer,
            sa.ForeignKey("eval_session_work_units.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("requested_by", sa.String(), nullable=True),
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
        sa.UniqueConstraint("project_session_rowid", "criteria_id"),
        sa.CheckConstraint(
            "requested_generation >= 0",
            name="valid_requested_generation",
        ),
        sa.CheckConstraint(
            "0 <= materialized_generation AND materialized_generation <= requested_generation",
            name="valid_materialized_generation",
        ),
        sa.CheckConstraint(
            "0 <= force_requested_generation "
            "AND force_requested_generation <= requested_generation",
            name="valid_force_requested_generation",
        ),
    )
    # The sweeper reaches rows by criteria, and the leading column serves the criteria
    # cascade; the unique constraint leads with project_session_rowid and serves the
    # session cascade.
    op.create_index(
        "ix_evaluation_requests_criteria_id_project_session_rowid",
        "evaluation_requests",
        ["criteria_id", "project_session_rowid"],
    )
    if op.get_bind().dialect.name == "postgresql":
        # Every row is rewritten on each request and each materialization, and no index
        # covers a generation column, so leaving free space keeps those updates heap-only.
        # The table stays small, so the scale factors are lowered to make autovacuum
        # actually fire on it.
        op.execute(
            "ALTER TABLE evaluation_requests SET ("
            "fillfactor = 80, "
            "autovacuum_vacuum_scale_factor = 0.02, "
            "autovacuum_analyze_scale_factor = 0.02, "
            "autovacuum_vacuum_threshold = 50, "
            "autovacuum_analyze_threshold = 50"
            ")"
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
    _create_session_work_units_table()
    _create_evaluator_signals_table()
    _create_project_evaluator_triggers_table()
    _create_evaluation_requests_table()

    # The delta adapter finds edited annotations by updated_at; no annotation table carries
    # an index on it, so without these every tick sequential-scans the annotation tables.
    op.create_index("ix_span_annotations_updated_at", "span_annotations", ["updated_at"])
    op.create_index("ix_trace_annotations_updated_at", "trace_annotations", ["updated_at"])
    op.create_index(
        "ix_project_session_annotations_updated_at",
        "project_session_annotations",
        ["updated_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_project_session_annotations_updated_at",
        table_name="project_session_annotations",
    )
    op.drop_index("ix_trace_annotations_updated_at", table_name="trace_annotations")
    op.drop_index("ix_span_annotations_updated_at", table_name="span_annotations")

    op.drop_index(
        "ix_evaluation_requests_criteria_id_project_session_rowid",
        table_name="evaluation_requests",
    )
    op.drop_table("evaluation_requests")

    op.drop_index(
        "ix_project_evaluator_triggers_source_criteria_id",
        table_name="project_evaluator_triggers",
    )
    op.drop_index(
        "ix_project_evaluator_triggers_criteria_id",
        table_name="project_evaluator_triggers",
    )
    op.drop_table("project_evaluator_triggers")

    op.drop_index("ix_evaluator_signals_project_session_rowid", table_name="evaluator_signals")
    op.drop_index("ix_evaluator_signals_project_id", table_name="evaluator_signals")
    op.drop_index("ix_evaluator_signals_undrained", table_name="evaluator_signals")
    op.drop_table("evaluator_signals")

    op.drop_index("ix_eval_session_work_units_criteria_id", table_name="eval_session_work_units")
    op.drop_index("ix_eval_session_work_units_evaluator_id", table_name="eval_session_work_units")
    op.drop_index("ix_eval_session_work_units_error_attempts", table_name="eval_session_work_units")
    op.drop_index(
        "ix_eval_session_work_units_terminal_watermark",
        table_name="eval_session_work_units",
    )
    op.drop_index("ix_eval_session_work_units_terminal", table_name="eval_session_work_units")
    op.drop_index("ix_eval_session_work_units_claimable", table_name="eval_session_work_units")
    op.drop_table("eval_session_work_units")

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
    op.drop_table("eval_work_leases")
    op.drop_table("eval_work_cursors")

    op.drop_index(
        "ix_project_sessions_project_id_last_span_ingested_at",
        table_name="project_sessions",
    )
    op.drop_column("project_sessions", "content_complete")
    op.drop_column("project_sessions", "last_span_ingested_at")
