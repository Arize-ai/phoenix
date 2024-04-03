"""project metadata

Revision ID: d619f21c879d
Revises:
Create Date: 2024-04-03 13:16:28.129794

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d619f21c879d"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("metadata", sa.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "metadata")
