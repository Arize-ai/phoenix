"""dataset_evaluators

Revision ID: fd7b46909d27
Revises: 58228d933c91
Create Date: 2025-09-22 11:36:40.216192

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fd7b46909d27"
down_revision: Union[str, None] = "58228d933c91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("dataset_evaluators", sa.Column("id", sa.Integer, primary_key=True))
    pass


def downgrade() -> None:
    op.drop_table("dataset_evaluators")
    pass
