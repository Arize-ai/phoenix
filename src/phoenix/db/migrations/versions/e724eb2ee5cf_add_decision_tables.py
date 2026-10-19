"""add decision tables

Revision ID: e724eb2ee5cf
Revises: 3050448199d9
Create Date: 2026-10-19 12:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

revision: str = "e724eb2ee5cf"
down_revision: Union[str, None] = "3050448199d9"
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
        sa.Column("schema_version", sa.Integer, nullable=False),
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
    # SQLite cannot add a column with a foreign key in place, so batch mode rewrites the
    # table. The inline foreign key takes its name from the naming convention, which
    # shortens it within PostgreSQL's identifier limit.
    with op.batch_alter_table("experiment_decision_tasks") as batch_op:
        batch_op.add_column(
            sa.Column(
                "decision_version_id",
                _Integer,
                sa.ForeignKey("decision_versions.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
        batch_op.create_index(
            "ix_experiment_decision_tasks_decision_version_id", ["decision_version_id"]
        )


def downgrade() -> None:
    # Dropping the column drops its foreign key too.
    with op.batch_alter_table("experiment_decision_tasks") as batch_op:
        batch_op.drop_index("ix_experiment_decision_tasks_decision_version_id")
        batch_op.drop_column("decision_version_id")
    op.drop_table("decision_version_tags")
    op.drop_table("decision_versions")
    op.drop_table("decisions")
