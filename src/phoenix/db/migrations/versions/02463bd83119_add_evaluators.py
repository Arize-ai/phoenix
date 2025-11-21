"""add evaluators

Revision ID: 02463bd83119
Revises: deb2c81c0bb2
Create Date: 2025-10-15 16:26:01.200457

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
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
        sa.Column("annotation_name", sa.String, nullable=False),
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
        "datasets_evaluators",
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
        sa.Column("input_config", JSON_, nullable=False),
        sa.CheckConstraint(
            "(evaluator_id IS NOT NULL) != (builtin_evaluator_id IS NOT NULL)",
            name="evaluator_id_xor_builtin_evaluator_id",
        ),
        sa.UniqueConstraint(
            "dataset_id",
            "evaluator_id",
            name="uq_datasets_evaluators_dataset_evaluator",
        ),
        sa.UniqueConstraint(
            "dataset_id",
            "builtin_evaluator_id",
            name="uq_datasets_evaluators_dataset_builtin",
        ),
    )


def downgrade() -> None:
    op.drop_table("datasets_evaluators")
    op.drop_table("code_evaluators")
    op.drop_table("llm_evaluators")
    op.drop_table("evaluators")
