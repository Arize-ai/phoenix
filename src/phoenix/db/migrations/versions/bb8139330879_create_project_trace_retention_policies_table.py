"""create project trace retention policies table

Revision ID: bb8139330879
Revises: 2f9d1a65945f
Create Date: 2025-02-27 15:57:18.752472

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


# revision identifiers, used by Alembic.
revision: str = "bb8139330879"
down_revision: Union[str, None] = "2f9d1a65945f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_trace_retention_policies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("cron_expression", sa.String, nullable=False),
        sa.Column("rule", JSON_, nullable=False),
    )
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(
            sa.Column(
                "trace_retention_policy_id",
                sa.Integer,
                sa.ForeignKey("project_trace_retention_policies.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
    op.create_index(
        "ix_projects_trace_retention_policy_id",
        "projects",
        ["trace_retention_policy_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_projects_trace_retention_policy_id")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("trace_retention_policy_id")
    op.drop_table("project_trace_retention_policies")
