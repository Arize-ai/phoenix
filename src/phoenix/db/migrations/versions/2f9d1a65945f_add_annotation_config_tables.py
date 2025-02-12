"""Add annotation config tables

Revision ID: 2f9d1a65945f
Revises: bc8fea3c2bc8
Create Date: 2025-02-06 10:17:15.726197

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f9d1a65945f"
down_revision: Union[str, None] = "bc8fea3c2bc8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column(
            "annotation_type",
            sa.String,
            sa.CheckConstraint(
                "annotation_type IN ('CATEGORIAL', 'CONTINUOUS', 'FREEFORM', 'BINARY')",
                name="annotation_type",
            ),
            nullable=False,
        ),
        sa.Column(
            "score_direction",
            sa.String,
            sa.CheckConstraint(
                "score_direction IN ('MINIMIZE', 'MAXIMIZE')", name="score_direction"
            ),
            nullable=False,
        ),
        sa.Column("description", sa.String, nullable=True),
    )

    op.create_table(
        "continuous_annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "annotation_config_id",
            sa.Integer,
            sa.ForeignKey("annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("lower_bound", sa.Float, nullable=True),
        sa.Column("upper_bound", sa.Float, nullable=True),
    )

    op.create_table(
        "categorical_annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "annotation_config_id",
            sa.Integer,
            sa.ForeignKey("annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("is_ordinal", sa.Boolean, nullable=False),
        sa.Column("multilabel_allowed", sa.Boolean, nullable=False),
    )

    op.create_table(
        "categorical_annotation_values",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "categorical_annotation_config_id",
            sa.Integer,
            sa.ForeignKey("categorical_annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String, nullable=False),
        sa.Column("numeric_score", sa.Float, nullable=True),
    )

    op.create_table(
        "project_annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "annotation_config_id",
            sa.Integer,
            sa.ForeignKey("annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("categorical_annotation_values")
    op.drop_table("categorical_annotation_configs")
    op.drop_table("continuous_annotation_configs")
    op.drop_table("annotation_configs")
    op.drop_table("project_annotation_configs")
