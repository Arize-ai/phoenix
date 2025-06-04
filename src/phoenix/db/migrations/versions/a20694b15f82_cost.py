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
        "models",
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
            "name_pattern",
            sa.String,
            nullable=False,
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
        "model_costs",
        sa.Column(
            "id",
            sa.Integer,
            primary_key=True,
        ),
        sa.Column(
            "model_id",
            sa.Integer,
            sa.ForeignKey("models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "token_type",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "cost_type",
            sa.String,
            sa.CheckConstraint(
                "cost_type IN ('DEFAULT', 'OVERRIDE')",
                name="valid_cost_type",
            ),
            nullable=False,
        ),
        sa.Column(
            "cost_per_token",
            sa.Float,
            nullable=False,
        ),
        sa.UniqueConstraint(
            "model_id",
            "token_type",
            "cost_type",
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
            "span_id",
            sa.Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "input_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "output_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "cache_read_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "cache_write_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "prompt_audio_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "completion_audio_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "reasoning_token_cost",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "total_token_cost",
            sa.Float,
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("span_costs")
    op.drop_table("model_costs")
    op.drop_table("models")
