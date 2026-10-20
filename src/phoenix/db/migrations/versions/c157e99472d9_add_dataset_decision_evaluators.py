"""add dataset decision evaluators

Revision ID: c157e99472d9
Revises: e724eb2ee5cf
Create Date: 2026-10-19 00:08:40.087062

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

revision: str = "c157e99472d9"
down_revision: Union[str, None] = "e724eb2ee5cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

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


def upgrade() -> None:
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
            "decision_id",
            _Integer,
            sa.ForeignKey("decisions.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "decision_version_tag_id",
            _Integer,
            sa.ForeignKey("decision_version_tags.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
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
