"""add media files table

Revision ID: e0307b79758d
Revises: c9d0e1f2a3b4
Create Date: 2026-07-30 15:01:39.541521

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e0307b79758d"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_files",
        # Content-addressed: the digest is the identity, so storing the same bytes
        # twice costs nothing and a prompt version can reference media by digest.
        sa.Column("sha256", sa.String, primary_key=True),
        sa.Column("media_type", sa.String, nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("content", sa.LargeBinary, nullable=False),
        # Nullable: a name is not always known — a URL import may not supply one —
        # and only the providers that require a name to carry a document need it.
        # Because rows are keyed by digest, identical bytes keep the first name given.
        sa.Column("file_name", sa.String, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("media_files")
