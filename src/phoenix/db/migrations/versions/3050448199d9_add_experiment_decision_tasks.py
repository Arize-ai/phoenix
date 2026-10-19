"""add experiment decision tasks

Revision ID: 3050448199d9
Revises: f3b8c2d14e70
Create Date: 2026-10-18 20:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

revision: str = "3050448199d9"
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


def upgrade() -> None:
    """Add DECISION as an experiment job type, with its joined task table.

    A decision task runs a decision model over a dataset as an experiment; the table
    freezes the connection and how examples become requests, so a resumed experiment
    asks exactly what it asked when it started.
    """
    # SQLite cannot alter a CHECK constraint in place, so batch mode rewrites the table.
    with op.batch_alter_table("experiment_jobs") as batch_op:
        batch_op.drop_constraint(constraint_name="valid_type", type_="check")
        batch_op.create_check_constraint(
            constraint_name="valid_type",
            condition=_JOB_TYPES_AFTER,
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
    )


def downgrade() -> None:
    # Restoring the narrower CHECK fails while DECISION jobs exist, which stops the
    # downgrade before it touches anything else rather than discarding those experiments'
    # bookkeeping.
    with op.batch_alter_table("experiment_jobs") as batch_op:
        batch_op.drop_constraint(constraint_name="valid_type", type_="check")
        batch_op.create_check_constraint(
            constraint_name="valid_type",
            condition=_JOB_TYPES_BEFORE,
        )
    op.drop_table("experiment_decision_tasks")
