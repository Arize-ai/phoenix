"""project tags

Revision ID: d22fcebbdb95
Revises: d619f21c879d
Create Date: 2024-04-03 13:43:40.714496

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d22fcebbdb95"
down_revision: Union[str, None] = "d619f21c879d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("tags", sa.JSON, nullable=True))
    pass


def downgrade() -> None:
    op.drop_column("projects", "tags")
    pass
