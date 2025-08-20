"""add session annotations table

Revision ID: 0df286449799
Revises: 735d3d93c33e
Create Date: 2025-08-06 11:27:01.479664

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "0df286449799"
down_revision: Union[str, None] = "735d3d93c33e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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


def upgrade() -> None:
    # Create project_session_annotations table
    op.create_table(
        "project_session_annotations",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "project_session_id",
            _Integer,
            sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("label", sa.String),
        sa.Column("score", sa.Float),
        sa.Column("explanation", sa.String),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "annotator_kind",
            sa.String,
            sa.CheckConstraint(
                "annotator_kind IN ('LLM', 'CODE', 'HUMAN')",
                name="valid_annotator_kind",
            ),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("identifier", sa.String, server_default="", nullable=False),
        sa.Column(
            "source",
            sa.String,
            sa.CheckConstraint("source IN ('API', 'APP')", name="valid_source"),
            nullable=False,
        ),
        sa.Column("trace_id", sa.String),
        sa.Column("error", sa.String),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("name", "project_session_id", "identifier"),
    )

    # Add trace_id column to existing annotation tables
    op.add_column("span_annotations", sa.Column("trace_id", sa.String))
    op.add_column("trace_annotations", sa.Column("trace_id", sa.String))
    op.add_column("document_annotations", sa.Column("trace_id", sa.String))

    # Add error column to existing annotation tables
    op.add_column("span_annotations", sa.Column("error", sa.String))
    op.add_column("trace_annotations", sa.Column("error", sa.String))
    op.add_column("document_annotations", sa.Column("error", sa.String))


def downgrade() -> None:
    # Remove trace_id columns from existing annotation tables
    op.drop_column("document_annotations", "trace_id")
    op.drop_column("trace_annotations", "trace_id")
    op.drop_column("span_annotations", "trace_id")

    # Remove error columns from existing annotation tables
    op.drop_column("document_annotations", "error")
    op.drop_column("trace_annotations", "error")
    op.drop_column("span_annotations", "error")

    # Drop the project_session_annotations table
    op.drop_table("project_session_annotations")
