"""add custom llm providers

Revision ID: 64d59ac812a4
Revises: deb2c81c0bb2
Create Date: 2025-11-03 22:33:27.052344

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import LargeBinary

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "64d59ac812a4"
down_revision: Union[str, None] = "02463bd83119"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "secrets",
        sa.Column("key", sa.String, nullable=False, primary_key=True),
        sa.Column("value", LargeBinary),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
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
        "ix_secrets_key_not_deleted",
        "secrets",
        ["key"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_table(
        "generative_model_custom_providers",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String),
        sa.Column("provider", sa.String, nullable=False),
        sa.Column("sdk", sa.String, nullable=False),
        sa.Column("config", LargeBinary, nullable=False),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
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


def downgrade() -> None:
    op.drop_table("generative_model_custom_providers")
    op.drop_index("ix_secrets_key_not_deleted", table_name="secrets")
    op.drop_table("secrets")
