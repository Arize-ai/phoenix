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

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)


def upgrade() -> None:
    op.create_table(
        "generative_models",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "name",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "provider",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "name_pattern",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "is_built_in",
            sa.Boolean,
            nullable=False,
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
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_generative_models_match_criteria",
        "generative_models",
        ["name_pattern", "provider", "is_built_in"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_generative_models_name_is_built_in",
        "generative_models",
        ["name", "is_built_in"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_table(
        "token_prices",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "model_id",
            _Integer,
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
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "span_rowid",
            _Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "trace_rowid",
            _Integer,
            sa.ForeignKey("traces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "model_id",
            _Integer,
            sa.ForeignKey(
                "generative_models.id",
                ondelete="RESTRICT",
            ),
            nullable=True,
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
    op.create_index(
        "ix_span_costs_model_id_span_start_time",
        "span_costs",
        ["model_id", "span_start_time"],
    )
    op.create_table(
        "span_cost_details",
        sa.Column(
            "id",
            _Integer,
            primary_key=True,
        ),
        sa.Column(
            "span_cost_id",
            _Integer,
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
