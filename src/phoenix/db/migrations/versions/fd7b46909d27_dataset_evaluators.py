"""dataset_evaluators

Revision ID: fd7b46909d27
Revises:  deb2c81c0bb2
Create Date: 2025-09-22 11:36:40.216192

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "fd7b46909d27"
down_revision: Union[str, None] = "deb2c81c0bb2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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


def upgrade() -> None:
    # The polymorphic root for all evaluations
    op.create_table(
        "evaluators",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String),
        # The type discriminator
        sa.Column(
            "kind",
            sa.String,
            sa.CheckConstraint("kind IN ('LLM', 'CODE', 'REMOTE')", name="valid_evaluator_kind"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            onupdate=sa.func.now(),
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # TODO(evaluators) - how do we store annotation definition like optimization direction
    )
    op.create_table(
        "dataset_evaluators",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String),
        sa.Column(
            "dataset_id",
            sa.Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_id",
            sa.Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            onupdate=sa.func.now(),
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # Force uniqueness of name on a given dataset
        sa.UniqueConstraint("name", "dataset_id"),
        # an evaluator can be a part of a dataset only once
        sa.UniqueConstraint("dataset_id", "evaluator_id"),
    )

    # Sub-type evaluator
    op.create_table(
        "llm_evaluator_definitions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "evaluator_id",
            sa.Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "prompt_id",
            sa.Integer,
            sa.ForeignKey("prompts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # If specified, the specific version gets tied to the evaluator, not latest
        sa.Column(
            "prompt_version_tag_id",
            sa.Integer,
            sa.ForeignKey("prompt_version_tags.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            onupdate=sa.func.now(),
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # The field to store how to map output labels to numerical scores
        sa.Column("output_score_mapping", JSON_, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("llm_evaluators")
    op.drop_table("dataset_evaluators")
    op.drop_table("evaluators")
