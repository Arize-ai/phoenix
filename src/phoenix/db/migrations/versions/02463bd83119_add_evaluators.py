"""add evaluators

Revision ID: 02463bd83119
Revises: deb2c81c0bb2
Create Date: 2025-10-15 16:26:01.200457

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON, LargeBinary
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


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

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "02463bd83119"
down_revision: Union[str, None] = "deb2c81c0bb2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "secrets",
        sa.Column("key", sa.String, nullable=False, primary_key=True),
        sa.Column("value", LargeBinary, nullable=False),
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
    op.create_table(
        "evaluators",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "kind",
            sa.String,
            sa.CheckConstraint("kind IN ('LLM', 'CODE')", name="valid_evaluator_kind"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("kind", "id"),  # needed for the composite FK
    )
    op.create_table(
        "llm_evaluators",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String,
            sa.CheckConstraint("kind = 'LLM'", name="valid_evaluator_kind"),
            server_default="LLM",
            nullable=False,
        ),
        sa.Column(
            "prompt_id",
            _Integer,
            sa.ForeignKey("prompts.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "prompt_version_tag_id",
            _Integer,
            sa.ForeignKey("prompt_version_tags.id", ondelete="SET NULL"),
            index=True,
        ),
        sa.Column("output_config", JSON_, nullable=False),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["evaluators.kind", "evaluators.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_table(
        # TODO: This is a stub for development purposes; remove before product release
        "code_evaluators",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String,
            sa.CheckConstraint("kind = 'CODE'", name="valid_evaluator_kind"),
            server_default="CODE",
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["evaluators.kind", "evaluators.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_table(
        "dataset_evaluators",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "dataset_id",
            _Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_id",
            _Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("builtin_evaluator_id", _Integer, nullable=True, index=True),
        sa.Column("display_name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("output_config", JSON_, nullable=True),
        sa.Column("input_mapping", JSON_, nullable=False),
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
        sa.CheckConstraint(
            "(evaluator_id IS NOT NULL) != (builtin_evaluator_id IS NOT NULL)",
            name="evaluator_id_xor_builtin_evaluator_id",
        ),
        sa.UniqueConstraint(
            "dataset_id",
            "display_name",
        ),
    )

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
    op.drop_table("dataset_evaluators")
    op.drop_table("code_evaluators")
    op.drop_table("llm_evaluators")
    op.drop_table("evaluators")
    op.drop_table("generative_model_custom_providers")
    op.drop_table("secrets")
