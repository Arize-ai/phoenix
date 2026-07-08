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

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a88424799fe"
down_revision: Union[str, None] = "8a3764fe7f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
    with op.batch_alter_table("users") as batch_op:
        # For SQLite, first add the column as nullable
        batch_op.add_column(sa.Column("auth_method", sa.String, nullable=True))

    with op.batch_alter_table("users") as batch_op:
        batch_op.execute("""
            UPDATE users
            SET auth_method = CASE
            WHEN password_hash IS NOT NULL THEN 'LOCAL' ELSE 'OAUTH2' END
        """)
        # Make the column non-nullable
        batch_op.alter_column("auth_method", nullable=False, existing_nullable=True)

        # Drop both old constraints as they're now redundant
        batch_op.drop_constraint("password_hash_and_salt", type_="check")
        batch_op.drop_constraint("exactly_one_auth_method", type_="check")
        batch_op.drop_constraint("oauth2_client_id_and_user_id", type_="check")

        # Drop redundant single column indices, because a composite index already
        # exists in the uniqueness constraint for (client_id, user_id)
        batch_op.drop_index("ix_users_oauth2_client_id")
        batch_op.drop_index("ix_users_oauth2_user_id")

        # Add CHECK constraint to ensure only valid values are allowed
        batch_op.create_check_constraint(
            "valid_auth_method",
            "auth_method IN ('LOCAL', 'OAUTH2')",
        )
        batch_op.create_check_constraint(
            "local_auth_has_password_no_oauth",
            "auth_method != 'LOCAL' "
            "OR (password_hash IS NOT NULL AND password_salt IS NOT NULL "
            "AND oauth2_client_id IS NULL AND oauth2_user_id IS NULL)",
        )
        batch_op.create_check_constraint(
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
    # Use batch_alter_table for SQLite compatibility
    # This ensures the downgrade works on both SQLite and PostgreSQL
    with op.batch_alter_table("users") as batch_op:
        # Drop the CHECK constraint and column
        batch_op.drop_constraint("non_local_auth_has_no_password", type_="check")
        batch_op.drop_constraint("local_auth_has_password_no_oauth", type_="check")
        batch_op.drop_constraint("valid_auth_method", type_="check")

        # Recreate single column indices
        batch_op.create_index("ix_users_oauth2_user_id", ["oauth2_user_id"])
        batch_op.create_index("ix_users_oauth2_client_id", ["oauth2_client_id"])

        # Recreate both old constraints that were dropped in upgrade
        batch_op.create_check_constraint(
            "oauth2_client_id_and_user_id",
            "(oauth2_client_id IS NULL) = (oauth2_user_id IS NULL)",
        )
        batch_op.create_check_constraint(
            "exactly_one_auth_method",
            "(password_hash IS NULL) != (oauth2_client_id IS NULL)",
        )
        batch_op.create_check_constraint(
            "password_hash_and_salt",
            "(password_hash IS NULL) = (password_salt IS NULL)",
        )

        # Remove added column
        batch_op.drop_column("auth_method")
