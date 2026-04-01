"""add experiment_jobs

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
down_revision: Union[str, None] = "9c5c1f6bd0d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "experiment_jobs",
        sa.Column(
            "id",
            _Integer,
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        # Type discriminator for polymorphic dispatch
        sa.Column(
            "type",
            sa.String(),
            sa.CheckConstraint(
                "type IN ('PROMPT', 'EVAL_ONLY')",
                name="valid_type",
            ),
            nullable=False,
        ),
        sa.UniqueConstraint("type", "id"),
        # Experiment lifecycle status
        sa.Column(
            "status",
            sa.String(),
            sa.CheckConstraint(
                "status IN ('RUNNING', 'COMPLETED', 'STOPPED', 'ERROR')",
                name="valid_experiment_status",
            ),
            nullable=False,
            server_default="STOPPED",
        ),
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
        # Cooldown: earliest time the next stop/resume is allowed
        sa.Column(
            "cooldown_until",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        # Per-experiment concurrency limit
        sa.Column(
            "max_concurrency",
            sa.Integer,
            nullable=False,
            server_default="10",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "experiment_prompt_tasks",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "type",
            sa.String(),
            sa.CheckConstraint("type = 'PROMPT'", name="valid_type"),
            nullable=False,
            server_default="PROMPT",
        ),
        sa.ForeignKeyConstraint(
            ["type", "id"],
            ["experiment_jobs.type", "experiment_jobs.id"],
            ondelete="CASCADE",
        ),
        # Prompt version (nullable)
        sa.Column(
            "prompt_version_id",
            _Integer,
            sa.ForeignKey("prompt_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Model identity
        sa.Column("model_provider", sa.String(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=False),
        # Provider routing
        sa.Column(
            "custom_provider_id",
            _Integer,
            sa.ForeignKey("generative_model_custom_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Prompt definition (complex nested → JSON)
        sa.Column("template_type", sa.String(), nullable=False),
        sa.Column("template_format", sa.String(), nullable=False),
        sa.Column("template", JSON_, nullable=False),
        sa.Column("tools", JSON_, nullable=True),
        sa.Column("response_format", JSON_, nullable=True),
        sa.Column("invocation_parameters", JSON_, nullable=False, server_default="{}"),
        # Connection overrides (SDK-specific, mutually exclusive with custom_provider_id)
        sa.Column("connection", JSON_, nullable=True),
        sa.CheckConstraint(
            "NOT (custom_provider_id IS NOT NULL AND connection IS NOT NULL)",
            name="custom_provider_or_connection",
        ),
        # Evolving playground features, stored as JSON
        sa.Column("playground_config", JSON_, nullable=True),
        # Runtime
        sa.Column(
            "stream_model_output",
            sa.Boolean(),
            nullable=False,
            server_default="1",
        ),
    )
    op.create_table(
        "experiment_logs",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column(
            "experiment_id",
            _Integer,
            sa.ForeignKey("experiment_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "occurred_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # Polymorphic discriminator
        sa.Column(
            "category",
            sa.String(),
            sa.CheckConstraint(
                "category IN ('TASK', 'EVAL', 'EXPERIMENT')",
                name="valid_event_category",
            ),
            nullable=False,
        ),
        sa.UniqueConstraint("category", "id"),
        sa.Column(
            "level",
            sa.String(),
            sa.CheckConstraint(
                "level IN ('ERROR', 'WARN', 'INFO')",
                name="valid_event_level",
            ),
            nullable=False,
        ),
        sa.Column(
            "message",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "detail",
            JSON_,
            nullable=True,
        ),
        sa.Index(
            "ix_experiment_logs_experiment_id_occurred_at_errors",
            "experiment_id",
            sa.text("occurred_at DESC"),
            postgresql_where=sa.text("level = 'ERROR'"),
            sqlite_where=sa.text("level = 'ERROR'"),
        ),
    )
    op.create_table(
        "experiment_task_logs",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "category",
            sa.String(),
            sa.CheckConstraint("category = 'TASK'", name="valid_category"),
            nullable=False,
            server_default="TASK",
        ),
        sa.ForeignKeyConstraint(
            ["category", "id"],
            ["experiment_logs.category", "experiment_logs.id"],
            ondelete="CASCADE",
        ),
        sa.Column(
            "dataset_example_id",
            _Integer,
            sa.ForeignKey("dataset_examples.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "repetition_number",
            sa.Integer,
            nullable=False,
        ),
    )
    op.create_table(
        "experiment_eval_logs",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "category",
            sa.String(),
            sa.CheckConstraint("category = 'EVAL'", name="valid_category"),
            nullable=False,
            server_default="EVAL",
        ),
        sa.ForeignKeyConstraint(
            ["category", "id"],
            ["experiment_logs.category", "experiment_logs.id"],
            ondelete="CASCADE",
        ),
        sa.Column(
            "experiment_run_id",
            _Integer,
            sa.ForeignKey("experiment_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dataset_evaluator_id",
            _Integer,
            sa.ForeignKey("dataset_evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_table(
        "experiment_dataset_evaluators",
        sa.Column(
            "experiment_id",
            _Integer,
            sa.ForeignKey("experiment_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dataset_evaluator_id",
            _Integer,
            sa.ForeignKey("dataset_evaluators.id", ondelete="CASCADE"),
            nullable=False,
            # index on the second element of the composite primary key
            index=True,
        ),
        sa.PrimaryKeyConstraint(
            "experiment_id",
            "dataset_evaluator_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("experiment_dataset_evaluators")
    op.drop_table("experiment_eval_logs")
    op.drop_table("experiment_task_logs")
    op.drop_table("experiment_logs")
    op.drop_table("experiment_prompt_tasks")
    op.drop_table("experiment_jobs")
