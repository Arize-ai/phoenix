"""Add auth_method column to users table and migrate existing authentication data.

This migration:
1. Adds a new 'auth_method' column to the users table that indicates whether a user
   authenticates via local password ('local') or external OAuth2 ('external')
2. Migrates existing authentication data to populate the new column
3. Adds appropriate constraints to ensure data integrity
4. Removes legacy constraints that are replaced by the new column

The migration uses batch_alter_table to ensure compatibility with both SQLite and PostgreSQL.
This approach allows us to:
- Add the column as nullable initially
- Update the values based on existing authentication data
- Make the column NOT NULL after populating
- Add appropriate constraints
- Remove legacy constraints

Revision ID: 6a88424799fe
Revises: 8a3764fe7f1a
Create Date: 2025-05-01 08:08:22.700715

"""

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
    4. Adds a CHECK constraint to ensure valid values
    5. Removes legacy constraints that are replaced by the new column

    The implementation uses batch_alter_table for compatibility with both
    SQLite and PostgreSQL databases.
    """
    with op.batch_alter_table("users") as batch_op:
        # For SQLite, first add the column with a simple default
        batch_op.add_column(sa.Column("auth_method", sa.String, nullable=True))

    with op.batch_alter_table("users") as batch_op:
        batch_op.execute("""
            UPDATE users
            SET auth_method = CASE
            WHEN password_hash IS NOT NULL THEN 'LOCAL' ELSE 'OAUTH2' END
        """)
        # Make the column non-nullable
        batch_op.alter_column("auth_method", nullable=False, existing_nullable=True)

        # Add CHECK constraint to ensure only valid values are allowed
        batch_op.create_check_constraint("auth_method", "auth_method IN ('LOCAL', 'OAUTH2')")
        batch_op.create_check_constraint(
            "auth_method_password",
            "(auth_method = 'LOCAL' AND password_hash IS NOT NULL) OR "
            "(auth_method = 'OAUTH2' AND password_hash IS NULL)",
        )

        # No index added: small user base makes full scans efficient
        # Scaling considerations:
        # - < 1,000 users: current approach optimal
        # - 1,000-10,000: monitor query performance
        # - > 10,000: consider adding index if auth queries are frequent
        # Add index when:
        # - Auth-related queries take >100ms
        # - User count reaches ~5,000 with frequent auth queries
        # - Many concurrent users or complex auth-related joins

        # Drop the old constraints that are no longer needed
        # These are replaced by the new auth_method column and its CHECK constraint
        batch_op.drop_constraint("oauth2_client_id_and_user_id", type_="check")
        batch_op.drop_constraint("exactly_one_auth_method", type_="check")


def downgrade() -> None:
    """Downgrade the database schema by removing the auth_method column.

    This function:
    1. Recreates the legacy constraints that were removed in the upgrade
    2. Removes the auth_method column and its associated CHECK constraint

    The implementation uses batch_alter_table to ensure compatibility with both
    SQLite and PostgreSQL databases.
    """
    # Use batch_alter_table for SQLite compatibility
    # This ensures the downgrade works on both SQLite and PostgreSQL
    with op.batch_alter_table("users") as batch_op:
        # Recreate the old constraints that were dropped in upgrade
        # Order matters: recreate constraints before dropping new ones
        batch_op.create_check_constraint(
            "oauth2_client_id_and_user_id",
            "(oauth2_client_id IS NULL) = (oauth2_user_id IS NULL)",
        )
        batch_op.create_check_constraint(
            "exactly_one_auth_method",
            "(password_hash IS NULL) != (oauth2_client_id IS NULL)",
        )

        # Drop the CHECK constraint and column
        # Order matters: drop constraint before dropping column
        # This prevents any constraint violations during the process
        batch_op.drop_constraint("auth_method", type_="check")
        batch_op.drop_constraint("auth_method_password", type_="check")
        batch_op.drop_column("auth_method")
