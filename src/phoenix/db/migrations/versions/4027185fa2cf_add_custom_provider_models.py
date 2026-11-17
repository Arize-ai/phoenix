"""add custom provider model tables

Revision ID: 4027185fa2cf
Revises: ef09e3bc213f
Create Date: 2026-11-06 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4027185fa2cf"
down_revision: Union[str, None] = "ef09e3bc213f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

_VALID_MODEL_TYPE = "model_type IN ('CHAT', 'DECISION')"


def upgrade() -> None:
    op.create_table(
        "custom_provider_model_types",
        sa.Column("provider_id", _Integer, nullable=False),
        sa.Column("model_type", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint(
            "provider_id",
            "model_type",
            name=op.f("pk_custom_provider_model_types"),
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["generative_model_custom_providers.id"],
            name=op.f(
                "fk_custom_provider_model_types_provider_id_generative_model_custom_providers"
            ),
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(_VALID_MODEL_TYPE, name="valid_model_type"),
    )
    op.create_table(
        "model_profiles",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("model_type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.UniqueConstraint("id", "model_type", name=op.f("uq_model_profiles_id_model_type")),
        sa.CheckConstraint(_VALID_MODEL_TYPE, name="valid_model_type"),
        sa.CheckConstraint("name <> '' AND name = trim(name)", name="valid_name"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "custom_provider_model_profiles",
        sa.Column("provider_id", _Integer, nullable=False),
        sa.Column("model_type", sa.String(), nullable=False),
        sa.Column("model_profile_id", _Integer, nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint(
            "provider_id",
            "model_type",
            "position",
            name=op.f("pk_custom_provider_model_profiles"),
        ),
        sa.ForeignKeyConstraint(
            ["provider_id", "model_type"],
            [
                "custom_provider_model_types.provider_id",
                "custom_provider_model_types.model_type",
            ],
            name=op.f("fk_custom_provider_model_profiles_provider_id_custom_provider_model_types"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["model_profile_id", "model_type"],
            ["model_profiles.id", "model_profiles.model_type"],
            name=op.f("fk_custom_provider_model_profiles_model_profile_id_model_profiles"),
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "model_profile_id",
            name=op.f("uq_custom_provider_model_profiles_model_profile_id"),
        ),
    )

    # TypeSafe providers serve decision models only; every other SDK serves chat by default.
    op.execute(
        "INSERT INTO custom_provider_model_types (provider_id, model_type) "
        "SELECT id, CASE WHEN sdk = 'typesafe' THEN 'DECISION' ELSE 'CHAT' END "
        "FROM generative_model_custom_providers"
    )


def downgrade() -> None:
    op.drop_table("custom_provider_model_profiles")
    op.drop_table("model_profiles")
    op.drop_table("custom_provider_model_types")
