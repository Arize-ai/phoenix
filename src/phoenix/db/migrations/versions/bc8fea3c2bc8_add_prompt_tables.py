"""Add prompt tables

Revision ID: bc8fea3c2bc8
Revises: 4ded9e43755f
Create Date: 2024-12-16 15:45:01.090563

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

revision: str = "bc8fea3c2bc8"
down_revision: Union[str, None] = "4ded9e43755f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prompt_labels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True, index=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("color", sa.String, nullable=True),
    )

    op.create_table(
        "prompts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "source_prompt_id",
            sa.Integer,
            sa.ForeignKey("prompts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String, unique=True, index=True, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            onupdate=sa.func.now(),
        ),
    )

    op.create_table(
        "prompts_prompt_labels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "prompt_label_id",
            sa.Integer,
            sa.ForeignKey("prompt_labels.id", ondelete="CASCADE"),
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
        sa.UniqueConstraint(
            "prompt_label_id",
            "prompt_id",
        ),
    )

    op.create_table(
        "prompt_versions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "prompt_id",
            sa.Integer,
            sa.ForeignKey("prompts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "template_type",
            sa.String,
            sa.CheckConstraint(
                "template_type IN ('CHAT', 'STR')",
                name="template_type",
            ),
            nullable=False,
        ),
        sa.Column(
            "template_format",
            sa.String,
            sa.CheckConstraint(
                "template_format IN ('F_STRING', 'MUSTACHE', 'NONE')",
                name="template_format",
            ),
            nullable=False,
        ),
        sa.Column("template", JSON_, nullable=False),
        sa.Column("invocation_parameters", JSON_, nullable=False),
        sa.Column("tools", JSON_, nullable=True),
        sa.Column("response_format", JSON_, nullable=True),
        sa.Column("model_provider", sa.String, nullable=False),
        sa.Column("model_name", sa.String, nullable=False),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sqlite_autoincrement=True,
    )

    op.create_table(
        "prompt_version_tags",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "prompt_id",
            sa.Integer,
            sa.ForeignKey("prompts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "prompt_version_id",
            sa.Integer,
            sa.ForeignKey("prompt_versions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.UniqueConstraint(
            "name",
            "prompt_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("prompt_version_tags")
    op.drop_table("prompt_versions")
    op.drop_table("prompts_prompt_labels")
    op.drop_table("prompts")
    op.drop_table("prompt_labels")
