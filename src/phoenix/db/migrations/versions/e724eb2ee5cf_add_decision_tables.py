"""add decision tables

Revision ID: e724eb2ee5cf
Revises: f3b8c2d14e70
Create Date: 2026-10-19 12:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

revision: str = "e724eb2ee5cf"
down_revision: Union[str, None] = "f3b8c2d14e70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_JOB_TYPES_BEFORE = "type IN ('PROMPT', 'EVAL_ONLY', 'EVALUATOR')"
_JOB_TYPES_AFTER = "type IN ('PROMPT', 'EVAL_ONLY', 'EVALUATOR', 'DECISION')"

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


def _set_kinds(include_decision: bool) -> None:
    kinds = "'LLM', 'CODE', 'BUILTIN'" + (", 'DECISION'" if include_decision else "")
    for table, column in (("evaluators", "kind"), ("experiment_evaluator_tasks", "evaluator_kind")):
        constraint = f'"ck_{table}_`valid_evaluator_kind`"'
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT {constraint}")
        op.execute(f"ALTER TABLE {table} ADD CONSTRAINT {constraint} CHECK ({column} IN ({kinds}))")


def _user_id() -> sa.Column[Any]:
    return sa.Column(
        "user_id",
        _Integer,
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


def upgrade() -> None:
    """Add saved decisions: decisions, their immutable versions, and movable tags.

    They mirror prompts, prompt versions, and prompt version tags. A tag's foreign key to
    its version is composite, (decision_id, decision_version_id), so a tag can never point
    at another decision's version. Decision experiment tasks record the version they were
    copied from.
    """
    op.create_table(
        "decisions",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "source_decision_id",
            _Integer,
            sa.ForeignKey("decisions.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False, unique=True, index=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        _user_id(),
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
            onupdate=sa.func.now(),
        ),
    )
    op.create_table(
        "decision_versions",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "decision_id",
            _Integer,
            sa.ForeignKey("decisions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("description", sa.String, nullable=True),
        _user_id(),
        sa.Column("inputs", JSON_, nullable=False),
        sa.Column("state", JSON_, nullable=False),
        sa.Column("questions", JSON_, nullable=False),
        sa.Column("model_provider", sa.String, nullable=False),
        sa.Column("model_name", sa.String, nullable=False),
        sa.Column(
            "custom_provider_id",
            _Integer,
            sa.ForeignKey("generative_model_custom_providers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # The target of the tags' composite foreign key.
        sa.UniqueConstraint("decision_id", "id"),
    )
    op.create_table(
        "decision_version_tags",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "decision_id",
            _Integer,
            sa.ForeignKey("decisions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("decision_version_id", _Integer, nullable=False, index=True),
        _user_id(),
        sa.UniqueConstraint("name", "decision_id"),
        sa.ForeignKeyConstraint(
            ["decision_id", "decision_version_id"],
            ["decision_versions.decision_id", "decision_versions.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_table(
        "decision_labels",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
    )
    op.create_index("ix_decision_labels_name", "decision_labels", ["name"], unique=True)
    op.create_table(
        "decisions_decision_labels",
        sa.Column(
            "decision_label_id",
            _Integer,
            sa.ForeignKey("decision_labels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "decision_id",
            _Integer,
            sa.ForeignKey("decisions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("decision_label_id", "decision_id"),
    )
    op.create_index(
        "ix_decisions_decision_labels_decision_id", "decisions_decision_labels", ["decision_id"]
    )

    op.execute('ALTER TABLE experiment_jobs DROP CONSTRAINT "ck_experiment_jobs_`valid_type`"')
    op.execute(
        'ALTER TABLE experiment_jobs ADD CONSTRAINT "ck_experiment_jobs_`valid_type`" '
        f"CHECK ({_JOB_TYPES_AFTER})"
    )
    op.create_table(
        "experiment_decision_tasks",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "type",
            sa.String(),
            sa.CheckConstraint("type = 'DECISION'", name="valid_type"),
            nullable=False,
            server_default="DECISION",
        ),
        sa.ForeignKeyConstraint(
            ["type", "id"],
            ["experiment_jobs.type", "experiment_jobs.id"],
            ondelete="CASCADE",
        ),
        # Model identity
        sa.Column("model_provider", sa.String(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=False),
        # Provider routing: a custom provider, or a built-in one with an optional endpoint
        sa.Column(
            "custom_provider_id",
            _Integer,
            sa.ForeignKey("generative_model_custom_providers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("base_url", sa.String(), nullable=True),
        sa.CheckConstraint(
            "NOT (custom_provider_id IS NOT NULL AND base_url IS NOT NULL)",
            name="custom_provider_or_base_url",
        ),
        # Inputs, state, question source, references, and scoring settings
        sa.Column("config", JSON_, nullable=False),
        sa.Column(
            "decision_version_id",
            _Integer,
            sa.ForeignKey("decision_versions.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )

    _set_kinds(True)
    op.create_table(
        "decision_evaluators",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint("kind = 'DECISION'", name="valid_evaluator_kind"),
            nullable=False,
            server_default="DECISION",
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"], ["evaluators.kind", "evaluators.id"], ondelete="CASCADE"
        ),
        sa.Column(
            "decision_version_id",
            _Integer,
            sa.ForeignKey("decision_versions.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("scoring_policy", JSON_, nullable=False),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.add_column(
        "experiment_jobs",
        sa.Column("decision_evaluator_snapshots", JSON_, nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    connection = op.get_bind()
    # Refuse before removing the existing constraint or any decision data.
    if connection.scalar(sa.text("SELECT COUNT(*) FROM experiment_jobs WHERE type = 'DECISION'")):
        raise ValueError("Cannot restore valid_type while DECISION jobs exist")
    for table, column in (("evaluators", "kind"), ("experiment_evaluator_tasks", "evaluator_kind")):
        if connection.scalar(sa.text(f"SELECT COUNT(*) FROM {table} WHERE {column} = 'DECISION'")):
            raise ValueError("Cannot downgrade while decision evaluators exist")
    if connection.scalar(
        sa.text("SELECT COUNT(*) FROM experiment_jobs WHERE decision_evaluator_snapshots != '[]'")
    ):
        raise ValueError("Cannot downgrade while decision evaluator snapshots exist")
    op.drop_column("experiment_jobs", "decision_evaluator_snapshots")
    op.drop_table("decision_evaluators")
    _set_kinds(False)
    op.execute('ALTER TABLE experiment_jobs DROP CONSTRAINT "ck_experiment_jobs_`valid_type`"')
    op.execute(
        'ALTER TABLE experiment_jobs ADD CONSTRAINT "ck_experiment_jobs_`valid_type`" '
        f"CHECK ({_JOB_TYPES_BEFORE})"
    )
    op.drop_table("experiment_decision_tasks")
    op.drop_table("decisions_decision_labels")
    op.drop_table("decision_labels")
    op.drop_table("decision_version_tags")
    op.drop_table("decision_versions")
    op.drop_table("decisions")
