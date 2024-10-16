"""init

Revision ID: cf03bd6bae1d
Revises:
Create Date: 2024-04-03 19:41:48.871555

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


@compiles(JSONB, "sqlite")  # type: ignore
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),  # type: ignore
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)

# revision identifiers, used by Alembic.
revision: str = "cf03bd6bae1d"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    projects_table = op.create_table(
        "projects",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column(
            "gradient_start_color",
            sa.String,
            nullable=False,
            server_default=sa.text("'#5bdbff'"),
        ),
        sa.Column(
            "gradient_end_color",
            sa.String,
            nullable=False,
            server_default=sa.text("'#1c76fc'"),
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
        "traces",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "project_rowid",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("trace_id", sa.String, nullable=False, unique=True),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=False, index=True),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=False),
    )

    op.create_table(
        "spans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "trace_rowid",
            sa.Integer,
            sa.ForeignKey("traces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("span_id", sa.String, nullable=False, unique=True),
        sa.Column("parent_id", sa.String, nullable=True, index=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("span_kind", sa.String, nullable=False),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=False, index=True),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("attributes", JSON_, nullable=False),
        sa.Column("events", JSON_, nullable=False),
        sa.Column(
            "status_code",
            sa.String,
            # TODO(mikeldking): this doesn't seem to work...
            sa.CheckConstraint("status_code IN ('OK', 'ERROR', 'UNSET')", "valid_status"),
            nullable=False,
            default="UNSET",
            server_default="UNSET",
        ),
        sa.Column("status_message", sa.String, nullable=False),
        sa.Column("cumulative_error_count", sa.Integer, nullable=False),
        sa.Column("cumulative_llm_token_count_prompt", sa.Integer, nullable=False),
        sa.Column("cumulative_llm_token_count_completion", sa.Integer, nullable=False),
    )
    op.create_index("ix_latency", "spans", [sa.text("(end_time - start_time)")], unique=False)
    op.create_index(
        "ix_cumulative_llm_token_count_total",
        "spans",
        [sa.text("(cumulative_llm_token_count_prompt + cumulative_llm_token_count_completion)")],
        unique=False,
    )

    op.create_table(
        "span_annotations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "span_rowid",
            sa.Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("label", sa.String, nullable=True, index=True),
        sa.Column("score", sa.Float, nullable=True, index=True),
        sa.Column("explanation", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "annotator_kind",
            sa.String,
            sa.CheckConstraint(
                "annotator_kind IN ('LLM', 'HUMAN')",
                name="valid_annotator_kind",
            ),
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
        sa.UniqueConstraint(
            "name",
            "span_rowid",
        ),
    )

    op.create_table(
        "trace_annotations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "trace_rowid",
            sa.Integer,
            sa.ForeignKey("traces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("label", sa.String, nullable=True, index=True),
        sa.Column("score", sa.Float, nullable=True, index=True),
        sa.Column("explanation", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "annotator_kind",
            sa.String,
            sa.CheckConstraint(
                "annotator_kind IN ('LLM', 'HUMAN')",
                name="valid_annotator_kind",
            ),
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
        sa.UniqueConstraint(
            "name",
            "trace_rowid",
        ),
    )

    op.create_table(
        "document_annotations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "span_rowid",
            sa.Integer,
            sa.ForeignKey("spans.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("document_position", sa.Integer, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("label", sa.String, nullable=True, index=True),
        sa.Column("score", sa.Float, nullable=True, index=True),
        sa.Column("explanation", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "annotator_kind",
            sa.String,
            sa.CheckConstraint(
                "annotator_kind IN ('LLM', 'HUMAN')",
                name="valid_annotator_kind",
            ),
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
        sa.UniqueConstraint(
            "name",
            "span_rowid",
            "document_position",
        ),
    )

    op.bulk_insert(
        projects_table,
        [
            {"name": "default", "description": "Default project"},
        ],
    )


def downgrade() -> None:
    op.drop_table("span_annotations")
    op.drop_table("trace_annotations")
    op.drop_table("document_annotations")
    op.drop_table("spans")
    op.drop_table("traces")
    op.drop_table("projects")
