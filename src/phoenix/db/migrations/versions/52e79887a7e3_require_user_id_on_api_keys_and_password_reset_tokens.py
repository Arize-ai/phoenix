"""require user_id on api_keys and password_reset_tokens

Revision ID: 52e79887a7e3
Revises: ef09e3bc213f
Create Date: 2026-09-18 12:00:00.000000

The models have always declared api_keys.user_id and
password_reset_tokens.user_id NOT NULL, but the tables were created without
the constraint. A row without a user is left behind by an ORM delete of its
user that nulled the column instead of letting ON DELETE CASCADE remove the
row. Such a row cannot authenticate anything, because the token store loads
tokens through an inner join to users, so it is deleted rather than blocking
the constraint. The downgrade drops the constraint again; deleted rows are not
restored.

SQLite rebuilds both tables. The rebuild keeps AUTOINCREMENT and carries each
table's sqlite_sequence counter over, so ids stay unique over each table's
lifetime. Without the counter, a rebuilt table would continue from its highest
surviving id.
"""

from typing import Optional, Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "52e79887a7e3"
down_revision: Union[str, None] = "ef09e3bc213f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("api_keys", "password_reset_tokens")


def _sqlite_sequence(table: str) -> Optional[int]:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return None
    stmt = sa.text("SELECT seq FROM sqlite_sequence WHERE name = :name")
    return bind.execute(stmt, {"name": table}).scalar()


def _restore_sqlite_sequence(table: str, seq: Optional[int]) -> None:
    if seq is None:
        return
    bind = op.get_bind()
    params = {"name": table, "seq": seq}
    bind.execute(sa.text("DELETE FROM sqlite_sequence WHERE name = :name AND seq < :seq"), params)
    bind.execute(
        sa.text(
            "INSERT INTO sqlite_sequence (name, seq) SELECT :name, :seq "
            "WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = :name)"
        ),
        params,
    )


def _set_user_id_nullable(table: str, nullable: bool) -> None:
    seq = _sqlite_sequence(table)
    with op.batch_alter_table(table, table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=nullable)
    _restore_sqlite_sequence(table, seq)


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"DELETE FROM {table} WHERE user_id IS NULL")
        _set_user_id_nullable(table, False)


def downgrade() -> None:
    for table in _TABLES:
        _set_user_id_nullable(table, True)
