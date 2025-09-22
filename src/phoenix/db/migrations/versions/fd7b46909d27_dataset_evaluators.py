"""dataset_evaluators

Revision ID: fd7b46909d27
Revises: 58228d933c91
Create Date: 2025-09-22 11:36:40.216192

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fd7b46909d27"
down_revision: Union[str, None] = "58228d933c91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The polymorphic root for all evaluations
    op.create_table(
        "evaluators",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String),
        # The type discriminator
        # TODO
        sa.Column(
            "kind",
            sa.String,
            sa.CheckConstraint("kind IN ('LLM', 'CODE', 'REMOTE')"),
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
        # To facilitate global uniqueness. If created through datasets, we might want
        # to auto-generate the name
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "dataset_evaluators",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("dataset_id", sa.Integer, sa.ForeignKey("datasets.id"), ondelete="CASCADE"),
        sa.Column(
            "evaluator_id",
            sa.Integer,
            sa.ForeignKey("evaluators.id"),
            ondelete="CASCADE",
            nullable=False,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            onupdate=sa.func.now(),
        ),
        # Force uniqueness of name on a given dataset
        sa.UniqueConstraint("name", "dataset_id"),
    )

    # Sub-type evaluators
    op.create_table(
        "llm_evaluators",
        sa.Column("id", sa.Integer, primary_key=True),
        # TODO - how to reference these if we decide to share evaluators across
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String),
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
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # TODO - there's some sort of choices mapping for label -> score
    )


def downgrade() -> None:
    op.drop_table("llm_evaluators")
    op.drop_table("dataset_evaluators")
    op.drop_table("evaluators")
