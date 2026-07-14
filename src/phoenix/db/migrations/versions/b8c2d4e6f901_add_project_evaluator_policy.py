"""add project evaluator policy

Revision ID: b8c2d4e6f901
Revises: a7f1c3e9d2b4
Create Date: 2026-07-14 00:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    return "JSONB"


JSON_ = JSON().with_variant(postgresql.JSONB(), "postgresql").with_variant(JSONB(), "sqlite")

revision: str = "b8c2d4e6f901"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.add_column(sa.Column("evaluation_target", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("input_mapping", JSON_, nullable=True))

    op.execute(
        sa.text(
            "UPDATE project_evaluator_criteria "
            "SET evaluation_target = 'SPAN' WHERE evaluation_target IS NULL"
        )
    )

    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.alter_column(
            "evaluation_target",
            existing_type=sa.String(),
            nullable=False,
            existing_nullable=True,
        )
        batch_op.create_check_constraint(
            "valid_evaluation_target",
            "evaluation_target IN ('SPAN', 'TRACE', 'SESSION')",
        )


def downgrade() -> None:
    with op.batch_alter_table("project_evaluator_criteria") as batch_op:
        batch_op.drop_constraint("valid_evaluation_target", type_="check")
        batch_op.drop_column("input_mapping")
        batch_op.drop_column("evaluation_target")
