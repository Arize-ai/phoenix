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
            sa.CheckConstraint("kind IN ('LLM', 'CODE', 'BUILTIN')", name="valid_evaluator_kind"),
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
        sa.Column("output_configs", JSON_, nullable=False),
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
            index=True,
        ),
        sa.Column(
            "evaluator_id",
            _Integer,
            sa.ForeignKey("evaluators.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("output_configs", JSON_, nullable=False),
        sa.Column("input_mapping", JSON_, nullable=False),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "project_id",
            _Integer,
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
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
        sa.UniqueConstraint(
            "dataset_id",
            "name",
        ),
    )
    # Builtin evaluators table - part of the polymorphic evaluator hierarchy.
    # This table reflects the in-memory builtin evaluator registry in the database.
    # Data is populated/synced on application startup, not in this migration.
    # name, description, metadata, user_id, created_at are inherited from base evaluators table.
    op.create_table(
        "builtin_evaluators",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String,
            sa.CheckConstraint("kind = 'BUILTIN'", name="valid_evaluator_kind"),
            server_default="BUILTIN",
            nullable=False,
        ),
        sa.Column("key", sa.String, nullable=False, unique=True),
        sa.Column("input_schema", JSON_, nullable=False),
        sa.Column("output_configs", JSON_, nullable=False),
        sa.Column(
            "synced_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["evaluators.kind", "evaluators.id"],
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("builtin_evaluators")
    op.drop_table("dataset_evaluators")
    op.drop_table("code_evaluators")
    op.drop_table("llm_evaluators")
    op.drop_table("evaluators")
    op.drop_table("generative_model_custom_providers")
    op.drop_table("secrets")
