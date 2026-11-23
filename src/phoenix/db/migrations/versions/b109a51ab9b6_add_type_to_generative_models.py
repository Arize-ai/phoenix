"""add type to generative_models

Revision ID: b109a51ab9b6
Revises: 7c2bc8452d60
Create Date: 2026-11-02 12:00:00.000000

`generative_models.type` says which kind of span a model prices (LLM, DECISION or EMBEDDING),
so that one model name can be priced differently per kind. Existing models become LLM. The
type joins both partial unique indexes, so a name is unique within a type.

The downgrade soft-deletes DECISION and EMBEDDING models, because older servers would price LLM
spans with them. Built-in ones return when the server next applies its manifest; custom ones must
be created again.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b109a51ab9b6"
down_revision: Union[str, None] = "7c2bc8452d60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_indexes(with_type: bool) -> None:
    type_ = ["type"] if with_type else []
    op.create_index(
        "ix_generative_models_match_criteria",
        "generative_models",
        [*type_, "name_pattern", "provider", "is_built_in"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_generative_models_name_is_built_in",
        "generative_models",
        ["name", "is_built_in", *type_],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def upgrade() -> None:
    op.drop_index("ix_generative_models_match_criteria", table_name="generative_models")
    op.drop_index("ix_generative_models_name_is_built_in", table_name="generative_models")
    with op.batch_alter_table("generative_models") as batch_op:
        batch_op.add_column(
            sa.Column(
                "type",
                sa.String,
                sa.CheckConstraint("type IN ('LLM', 'DECISION', 'EMBEDDING')", name="valid_type"),
                nullable=False,
                server_default="LLM",
            )
        )
    _create_indexes(with_type=True)


def downgrade() -> None:
    generative_models = sa.table(
        "generative_models",
        sa.column("type", sa.String),
        sa.column("deleted_at", sa.TIMESTAMP(timezone=True)),
    )
    op.execute(
        generative_models.update()
        .where(generative_models.c.type != "LLM")
        .where(generative_models.c.deleted_at.is_(None))
        .values(deleted_at=sa.func.now())
    )
    op.drop_index("ix_generative_models_match_criteria", table_name="generative_models")
    op.drop_index("ix_generative_models_name_is_built_in", table_name="generative_models")
    with op.batch_alter_table("generative_models") as batch_op:
        batch_op.drop_constraint("valid_type", type_="check")
        batch_op.drop_column("type")
    _create_indexes(with_type=False)
