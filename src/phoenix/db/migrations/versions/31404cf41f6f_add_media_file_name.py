"""add media file name

Revision ID: 31404cf41f6f
Revises: e0307b79758d
Create Date: 2026-07-31 13:18:05.401048

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "31404cf41f6f"
down_revision: Union[str, None] = "e0307b79758d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: media stored before this column existed has no remembered name, and
    # a name is only needed by the providers that require one to carry a document.
    with op.batch_alter_table("media_files") as batch_op:
        batch_op.add_column(sa.Column("file_name", sa.String, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("media_files") as batch_op:
        batch_op.drop_column("file_name")
