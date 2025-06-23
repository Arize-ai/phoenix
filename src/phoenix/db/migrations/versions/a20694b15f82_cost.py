"""Cost-related tables

Revision ID: a20694b15f82
Revises: migrations/versions/6a88424799fe_update_users_with_auth_method.py
Create Date: 2025-05-30 17:15:12.663565

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a20694b15f82"
down_revision: Union[str, None] = "6a88424799fe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generative_models",
        sa.Column(
            "id",
            sa.Integer,
            primary_key=True,
        ),
        sa.Column(
            "name",
            sa.String,
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "provider",
            sa.String,
            nullable=True,
        ),
        sa.Column(
            "llm_name_pattern",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "is_built_in",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "start_time",
            sa.TIMESTAMP(timezone=True),
        ),
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
        "token_prices",
        sa.Column(
            "id",
            sa.Integer,
            primary_key=True,
        ),
        sa.Column(
            "model_id",
            sa.Integer,
            sa.ForeignKey("generative_models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_type", sa.String, nullable=False),
        sa.Column("is_prompt", sa.Boolean, nullable=False),
        sa.Column("base_rate", sa.Float, nullable=False),
        sa.Column("customization", sa.JSON),
        sa.UniqueConstraint(
            "model_id",
            "token_type",
            "is_prompt",
        ),
    )
    op.create_table(
        "span_costs",
        sa.Column(
            "id",
            sa.Integer,
            primary_key=True,
        ),
        sa.Column(
            "span_rowid",
            sa.Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "trace_rowid",
            sa.Integer,
            sa.ForeignKey("traces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "model_id",
            sa.Integer,
            sa.ForeignKey("generative_models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "span_start_time",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            index=True,
        ),
        sa.Column("total_cost", sa.Float),
        sa.Column("total_tokens", sa.Float),
        sa.Column("prompt_cost", sa.Float),
        sa.Column("prompt_tokens", sa.Float),
        sa.Column("completion_cost", sa.Float),
        sa.Column("completion_tokens", sa.Float),
    )
    op.create_table(
        "span_cost_details",
        sa.Column(
            "id",
            sa.Integer,
            primary_key=True,
        ),
        sa.Column(
            "span_cost_id",
            sa.Integer,
            sa.ForeignKey("span_costs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_type", sa.String, nullable=False, index=True),
        sa.Column("is_prompt", sa.Boolean, nullable=False),
        sa.Column("cost", sa.Float),
        sa.Column("tokens", sa.Float),
        sa.Column("cost_per_token", sa.Float),
        sa.UniqueConstraint(
            "span_cost_id",
            "token_type",
            "is_prompt",
        ),
    )


def downgrade() -> None:
    op.drop_table("span_cost_details")
    op.drop_table("span_costs")
    op.drop_table("token_prices")
    op.drop_table("generative_models")
