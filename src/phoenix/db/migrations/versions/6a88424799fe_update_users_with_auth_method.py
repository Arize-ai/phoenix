"""Add auth_method column to users table and migrate existing authentication data.

This migration:
1. Adds a new 'auth_method' column to the users table that indicates whether a user
   authenticates via local password ('LOCAL') or external OAuth2 ('OAUTH2')
2. Migrates existing authentication data to populate the new column:
   - Sets 'LOCAL' for users with password_hash
   - Sets 'OAUTH2' for users with OAuth2 credentials
3. Adds appropriate constraints to ensure data integrity:
   - NOT NULL constraint on auth_method
   - 'valid_auth_method': ensures only 'LOCAL' or 'OAUTH2' values
   - 'local_auth_has_password_no_oauth': ensures LOCAL users have password credentials and
     do not have OAuth2 credentials
   - 'non_local_auth_has_no_password': ensures OAUTH2 users do not have password credentials
4. Removes legacy constraints that are replaced by the new column:
   - 'password_hash_and_salt': ensures password_hash and password_salt are consistent
   - 'exactly_one_auth_method': replaced by auth_method column and its constraints
   - 'oauth2_client_id_and_user_id': replaced by auth_method column and its constraints
5. Drops redundant single column indices:
   - 'ix_users_oauth2_client_id' and 'ix_users_oauth2_user_id' are removed as they are
     redundant with the unique constraint 'uq_users_oauth2_client_id_oauth2_user_id',
     which already provides the necessary composite index for lookups

The migration uses batch_alter_table to ensure compatibility with both SQLite and PostgreSQL.
This approach allows us to:
- Add the column as nullable initially
- Update the values based on existing authentication data
- Make the column NOT NULL after populating
- Add appropriate constraints
- Remove legacy constraints
- Drop redundant indices

The downgrade path:
1. Recreates the legacy constraints:
   - 'password_hash_and_salt': ensures password_hash and password_salt are consistent
   - 'exactly_one_auth_method': ensures exactly one auth method is set
   - 'oauth2_client_id_and_user_id': ensures OAuth2 credentials are consistent
2. Removes the auth_method column and its associated constraints
3. Recreates the single column indices to maintain backward compatibility:
   - 'ix_users_oauth2_client_id'
   - 'ix_users_oauth2_user_id'

Revision ID: 6a88424799fe
Revises: 8a3764fe7f1a
Create Date: 2025-05-01 08:08:22.700715

"""  # noqa: E501

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a88424799fe"
down_revision: Union[str, None] = "8a3764fe7f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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


def _sqlite_check_name(table_name: str, constraint_name: str) -> str:
    """SQLite identifier produced by the ck_%(table_name)s_`%(constraint_name)s` convention."""
    return f'"ck_{table_name}_`{constraint_name}`"'


def _drop_check_constraint(table_name: str, constraint_name: str) -> None:
    """Drop a CHECK constraint without a SQLite table rewrite.

    Alembic's SQLite dialect rejects ``op.drop_constraint`` outside batch mode.
    SQLite 3.53+ can drop the constraint in place; the stored name is the
    naming-convention form, not the logical Alembic name.
    """
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "ALTER TABLE "
            f"{table_name} DROP CONSTRAINT {_sqlite_check_name(table_name, constraint_name)}"
        )
        return
    op.drop_constraint(constraint_name, table_name, type_="check")


def _create_check_constraint(table_name: str, constraint_name: str, condition: str) -> None:
    """Add a CHECK constraint without a SQLite table rewrite."""
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "ALTER TABLE "
            f"{table_name} ADD CONSTRAINT {_sqlite_check_name(table_name, constraint_name)} "
            f"CHECK ({condition})"
        )
        return
    op.create_check_constraint(constraint_name, table_name, condition)


def upgrade() -> None:
    """Upgrade the database schema to include the auth_method column.

    This function:
    1. Adds the auth_method column as nullable
    2. Populates the column based on existing authentication data:
       - 'LOCAL' for users with password_hash
       - 'OAUTH2' for users with OAuth2 credentials
    3. Makes the column NOT NULL after populating
    4. Adds CHECK constraints to ensure data integrity:
       - 'valid_auth_method': ensures only 'LOCAL' or 'OAUTH2' values
       - 'local_auth_has_password_no_oauth': ensures LOCAL users have password credentials and
          do not have OAuth2 credentials
       - 'non_local_auth_has_no_password': ensures OAUTH2 users do not have password credentials
    5. Removes legacy constraints that are replaced by the new column:
       - 'password_hash_and_salt'
       - 'exactly_one_auth_method'
       - 'oauth2_client_id_and_user_id'
    6. Drops redundant single column indices:
       - 'ix_users_oauth2_client_id' and 'ix_users_oauth2_user_id' are removed as they are
         redundant with the unique constraint 'uq_users_oauth2_client_id_oauth2_user_id',
         which already provides the necessary composite index for lookups

    The implementation uses batch_alter_table for compatibility with both
    SQLite and PostgreSQL databases.

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """  # noqa: E501
    with (
        _preserve_sqlite_sequence("users"),
        op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op,
    ):
        # For SQLite, first add the column as nullable
        batch_op.add_column(sa.Column("auth_method", sa.String, nullable=True))

    op.execute("""
        UPDATE users
        SET auth_method = CASE
        WHEN password_hash IS NOT NULL THEN 'LOCAL' ELSE 'OAUTH2' END
    """)
    # Drop the legacy checks before the rebuild so SQLite does not copy them onto
    # the new table. 3.53+ drops them in place; Alembic still requires batch mode
    # for the NOT NULL change below.
    _drop_check_constraint("users", "password_hash_and_salt")
    _drop_check_constraint("users", "exactly_one_auth_method")
    _drop_check_constraint("users", "oauth2_client_id_and_user_id")

    with (
        _preserve_sqlite_sequence("users"),
        op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op,
    ):
        # Make the column non-nullable
        batch_op.alter_column("auth_method", nullable=False, existing_nullable=True)

        # Drop redundant single column indices, because a composite index already
        # exists in the uniqueness constraint for (client_id, user_id)
        batch_op.drop_index("ix_users_oauth2_client_id")
        batch_op.drop_index("ix_users_oauth2_user_id")

    _create_check_constraint(
        "users",
        "valid_auth_method",
        "auth_method IN ('LOCAL', 'OAUTH2')",
    )
    _create_check_constraint(
        "users",
        "local_auth_has_password_no_oauth",
        "auth_method != 'LOCAL' "
        "OR (password_hash IS NOT NULL AND password_salt IS NOT NULL "
        "AND oauth2_client_id IS NULL AND oauth2_user_id IS NULL)",
    )
    _create_check_constraint(
        "users",
        "non_local_auth_has_no_password",
        "auth_method = 'LOCAL' OR (password_hash IS NULL AND password_salt IS NULL)",
    )


def downgrade() -> None:
    """Downgrade the database schema by removing the auth_method column.

    This function:
    1. Recreates the legacy constraints that were removed in the upgrade:
       - 'password_hash_and_salt': ensures password_hash and password_salt are consistent
       - 'exactly_one_auth_method': ensures exactly one auth method is set
       - 'oauth2_client_id_and_user_id': ensures OAuth2 credentials are consistent
    2. Removes the auth_method column and its associated CHECK constraints:
       - 'non_local_auth_has_no_password'
       - 'local_auth_has_password_no_oauth'
       - 'valid_auth_method'
    3. Recreates the single column indices to maintain backward compatibility:
       - 'ix_users_oauth2_client_id'
       - 'ix_users_oauth2_user_id'

    The implementation uses batch_alter_table to ensure compatibility with both
    SQLite and PostgreSQL databases.

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """  # noqa: E501
    # Drop checks that reference auth_method before the column is removed.
    _drop_check_constraint("users", "non_local_auth_has_no_password")
    _drop_check_constraint("users", "local_auth_has_password_no_oauth")
    _drop_check_constraint("users", "valid_auth_method")

    with (
        _preserve_sqlite_sequence("users"),
        op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op,
    ):
        # Recreate single column indices
        batch_op.create_index("ix_users_oauth2_user_id", ["oauth2_user_id"])
        batch_op.create_index("ix_users_oauth2_client_id", ["oauth2_client_id"])

        # Remove added column
        batch_op.drop_column("auth_method")

    _create_check_constraint(
        "users",
        "oauth2_client_id_and_user_id",
        "(oauth2_client_id IS NULL) = (oauth2_user_id IS NULL)",
    )
    _create_check_constraint(
        "users",
        "exactly_one_auth_method",
        "(password_hash IS NULL) != (oauth2_client_id IS NULL)",
    )
    _create_check_constraint(
        "users",
        "password_hash_and_salt",
        "(password_hash IS NULL) = (password_salt IS NULL)",
    )
