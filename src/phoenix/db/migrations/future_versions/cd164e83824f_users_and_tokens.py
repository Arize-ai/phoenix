"""users and tokens

Revision ID: cd164e83824f
Revises: 10460e46d750
Create Date: 2024-08-01 18:36:52.157604

"""

from typing import Sequence, Union

import sqlalchemy as sa  # noqa: F401
from alembic import op  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "cd164e83824f"
down_revision: Union[str, None] = "10460e46d750"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
