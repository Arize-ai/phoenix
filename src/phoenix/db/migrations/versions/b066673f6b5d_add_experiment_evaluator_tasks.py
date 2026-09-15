"""add experiment evaluator tasks

Revision ID: b066673f6b5d
Revises: a7f1c3e9d2b4
Create Date: 2026-09-14 18:41:04.763233

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
revision: str = "b066673f6b5d"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_JOB_TYPES_BEFORE = "type IN ('PROMPT', 'EVAL_ONLY')"
_JOB_TYPES_AFTER = "type IN ('PROMPT', 'EVAL_ONLY', 'EVALUATOR')"


def upgrade() -> None:
    # SQLite cannot alter a CHECK constraint in place, so batch mode rewrites the table.
    with op.batch_alter_table("experiment_jobs") as batch_op:
        batch_op.drop_constraint(constraint_name="valid_type", type_="check")
        batch_op.create_check_constraint(
            constraint_name="valid_type",
            condition=_JOB_TYPES_AFTER,
        )
    op.create_table(
        "experiment_evaluator_tasks",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "type",
            sa.String(),
            sa.CheckConstraint("type = 'EVALUATOR'", name="valid_type"),
            nullable=False,
            server_default="EVALUATOR",
        ),
        sa.ForeignKeyConstraint(
            ["type", "id"],
            ["experiment_jobs.type", "experiment_jobs.id"],
            ondelete="CASCADE",
        ),
        # The evaluator's name; run annotations are named after it
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "evaluator_kind",
            sa.String(),
            sa.CheckConstraint(
                "evaluator_kind IN ('LLM', 'CODE', 'BUILTIN')",
                name="valid_evaluator_kind",
            ),
            nullable=False,
        ),
        # The evaluator as drafted (inline prompt version or code) or a stored evaluator's id
        sa.Column("definition", JSON_, nullable=False),
        sa.Column("input_mapping", JSON_, nullable=False),
        sa.Column("output_configs", JSON_, nullable=False),
    )


def downgrade() -> None:
    # Restoring the narrower CHECK fails while EVALUATOR jobs exist, which leaves the
    # database untouched rather than discarding those experiments' bookkeeping.
    with op.batch_alter_table("experiment_jobs") as batch_op:
        batch_op.drop_constraint(constraint_name="valid_type", type_="check")
        batch_op.create_check_constraint(
            constraint_name="valid_type",
            condition=_JOB_TYPES_BEFORE,
        )
    op.drop_table("experiment_evaluator_tasks")
