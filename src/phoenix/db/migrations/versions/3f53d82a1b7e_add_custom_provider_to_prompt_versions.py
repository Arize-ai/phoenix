"""add custom_provider_id to prompt_versions

Revision ID: 3f53d82a1b7e
Revises: 02463bd83119
Create Date: 2026-01-16 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "3f53d82a1b7e"
down_revision: Union[str, None] = "02463bd83119"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add custom_provider_id FK to prompt_versions for evaluator provider binding
    # NULL = use built-in provider (secrets/env vars)
    # SET = use custom provider config
    with op.batch_alter_table(
        "prompt_versions",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.add_column(
            sa.Column(
                "custom_provider_id",
                _Integer,
                sa.ForeignKey("generative_model_custom_providers.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
    # Create index outside batch operation to avoid _alembic_tmp_ naming issues
    op.create_index(
        "ix_prompt_versions_custom_provider_id",
        "prompt_versions",
        ["custom_provider_id"],
    )


def downgrade() -> None:
    # Drop index outside batch operation first
    op.drop_index("ix_prompt_versions_custom_provider_id", table_name="prompt_versions")
    with op.batch_alter_table(
        "prompt_versions",
        table_kwargs={"sqlite_autoincrement": True},
    ) as batch_op:
        batch_op.drop_column("custom_provider_id")
