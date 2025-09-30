"""add experiments_dataset_examples junction table

Revision ID: e76cbd66ffc3
Revises: deb2c81c0bb2
Create Date: 2025-09-23 12:33:13.554164

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

# revision identifiers, used by Alembic.
revision: str = "e76cbd66ffc3"
down_revision: Union[str, None] = "58228d933c91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BACKFILL = """\
INSERT INTO experiments_dataset_examples (
    experiment_id,
    dataset_example_id,
    dataset_example_revision_id
)
SELECT
    ranked.experiment_id,
    ranked.dataset_example_id,
    ranked.dataset_example_revision_id
FROM (
    SELECT
        e.id as experiment_id,
        der.dataset_example_id,
        der.id as dataset_example_revision_id,
        der.revision_kind,
        ROW_NUMBER() OVER (
            PARTITION BY e.id, der.dataset_example_id
            ORDER BY der.dataset_version_id DESC
        ) as rn
    FROM experiments e
        JOIN dataset_examples de ON de.dataset_id = e.dataset_id
        JOIN dataset_example_revisions der ON der.dataset_example_id = de.id
    WHERE der.dataset_version_id <= e.dataset_version_id
) ranked
WHERE ranked.rn = 1
    AND ranked.revision_kind != 'DELETE'
"""


def upgrade() -> None:
    op.create_table(
        "experiments_dataset_examples",
        sa.Column(
            "experiment_id",
            _Integer,
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dataset_example_id",
            _Integer,
            sa.ForeignKey("dataset_examples.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "dataset_example_revision_id",
            _Integer,
            sa.ForeignKey("dataset_example_revisions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.PrimaryKeyConstraint(
            "experiment_id",
            "dataset_example_id",
        ),
    )
    op.execute(BACKFILL)


def downgrade() -> None:
    op.drop_table("experiments_dataset_examples")
