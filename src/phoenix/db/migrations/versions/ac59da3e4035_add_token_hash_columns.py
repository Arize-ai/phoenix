"""add token hash columns

Revision ID: ac59da3e4035
Revises: a7f1c3e9d2b4
Create Date: 2026-10-01 00:00:00.000000

"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ac59da3e4035"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Each issued token's SHA-256 hash is recorded so that a token signed with the public
# default key can be accepted only if Phoenix issued it. The column is nullable because
# rows issued before this migration have no hash; they remain valid while a private
# PHOENIX_SECRET signs tokens. A nullable column with no default is a plain ALTER TABLE
# ADD COLUMN on both dialects, so no SQLite table rebuild is needed.
_TABLES = ("password_reset_tokens", "refresh_tokens", "access_tokens", "api_keys")


@contextmanager
def _preserve_sqlite_sequence(table_name: str) -> Iterator[None]:
    """Keep the AUTOINCREMENT high-water mark across a SQLite table rebuild."""
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        yield
        return
    sequence = connection.execute(
        sa.text("SELECT seq FROM sqlite_sequence WHERE name = :name"),
        {"name": table_name},
    ).scalar()
    yield
    if sequence is None:
        return
    parameters = {"name": table_name, "sequence": sequence}
    result = connection.execute(
        sa.text(
            "UPDATE sqlite_sequence SET seq = MAX(COALESCE(seq, 0), :sequence) WHERE name = :name"
        ),
        parameters,
    )
    if not result.rowcount:
        connection.execute(
            sa.text("INSERT INTO sqlite_sequence (name, seq) VALUES (:name, :sequence)"),
            parameters,
        )


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(table, sa.Column("token_hash", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    for table in reversed(_TABLES):
        with _preserve_sqlite_sequence(table):
            with op.batch_alter_table(
                table, table_kwargs={"sqlite_autoincrement": True}
            ) as batch_op:
                batch_op.drop_column("token_hash")
