"""Migrate LDAP users to dedicated auth_method and ldap_unique_id column.

This migration fully eliminates the LDAP stopgap tech debt by:

1. Adding 'LDAP' to the auth_method CHECK constraint
2. Adding a dedicated ldap_unique_id column for LDAP users
3. Migrating existing LDAP users from auth_method='OAUTH2' to auth_method='LDAP'
4. Moving LDAP unique IDs from oauth2_user_id to ldap_unique_id
5. Making the email column nullable (no more null email markers needed)
6. Restructuring constraints to properly separate OAuth2 and LDAP fields

Background:
  The original LDAP implementation used a "stopgap" approach that stored LDAP users
  as OAuth2 users with a special Unicode marker ('\ue000LDAP(stopgap)') in
  oauth2_client_id and stored LDAP unique IDs in oauth2_user_id. This resulted in:
  - auth_method='OAUTH2' for LDAP users (semantically incorrect)
  - Placeholder emails like '\ue000NULL(stopgap){md5_hash}' for users without email
  - Polluted oauth2_* columns with non-OAuth2 data

  This migration provides a clean schema by:
  - Using auth_method='LDAP' for LDAP-authenticated users
  - Using ldap_unique_id column (not oauth2_user_id) for LDAP unique identifiers
  - Setting oauth2_client_id=NULL AND oauth2_user_id=NULL for LDAP users
  - Allowing NULL emails instead of placeholder markers
  - Using partial unique indexes for proper constraint enforcement

Revision ID: a1b2c3d4e5f6
Revises: 3f53d82a1b7e
Create Date: 2026-01-16 14:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "3f53d82a1b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The legacy stopgap markers (only used for migration detection and downgrade)
LDAP_CLIENT_ID_MARKER = "\ue000LDAP(stopgap)"
NULL_EMAIL_MARKER_PREFIX = "\ue000NULL(stopgap)"


def upgrade() -> None:
    """Upgrade to clean LDAP schema with dedicated ldap_unique_id column.

    This function:
    1. Drops existing constraints
    2. Adds ldap_unique_id column
    3. Makes email column nullable
    4. Migrates LDAP users: auth_method='LDAP', moves oauth2_user_id to ldap_unique_id
    5. Converts null email markers to actual NULLs
    6. Drops the old unique constraint on (oauth2_client_id, oauth2_user_id)
    7. Creates new partial unique indexes for proper constraint enforcement
    8. Recreates CHECK constraints with 'LDAP' support and field separation

    Note: All batch_alter_table calls include sqlite_autoincrement=True to fix
    the autoincrement issue introduced in migration 6a88424799fe.
    """
    # IMPORTANT: sqlite_autoincrement=True fixes broken autoincrement from migration 6a88424799fe
    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        # Step 1: Drop existing constraints
        batch_op.drop_constraint("valid_auth_method", type_="check")
        batch_op.drop_constraint("local_auth_has_password_no_oauth", type_="check")
        batch_op.drop_constraint("non_local_auth_has_no_password", type_="check")

        # Drop the old unique constraint - we'll replace it with partial indexes
        batch_op.drop_constraint("uq_users_oauth2_client_id_oauth2_user_id", type_="unique")

        # Step 2: Add ldap_unique_id column
        batch_op.add_column(sa.Column("ldap_unique_id", sa.String(), nullable=True))

        # Step 3: Make email column nullable
        batch_op.alter_column(
            "email",
            existing_type=sa.String(),
            nullable=True,
        )

    # Step 4: Migrate data
    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        # Migrate LDAP users:
        # - Set auth_method='LDAP'
        # - Copy oauth2_user_id to ldap_unique_id
        # - Clear oauth2_client_id and oauth2_user_id
        batch_op.execute(f"""
            UPDATE users
            SET auth_method = 'LDAP',
                ldap_unique_id = oauth2_user_id,
                oauth2_client_id = NULL,
                oauth2_user_id = NULL
            WHERE oauth2_client_id = '{LDAP_CLIENT_ID_MARKER}'
        """)

        # Convert null email markers to actual NULLs
        batch_op.execute(f"""
            UPDATE users
            SET email = NULL
            WHERE email LIKE '{NULL_EMAIL_MARKER_PREFIX}%'
        """)

    # Step 5: Create new constraints
    #
    # Constraint summary (R = Required, N = Must be NULL, O = Optional):
    #
    # | Field            | LOCAL | OAUTH2 | LDAP |
    # |------------------|-------|--------|------|
    # | email            |   R   |   R    |  *   |
    # | password         |   R   |   N    |  N   |
    # | ldap_unique_id   |   N   |   N    |  *   |
    # | oauth2_client_id |   N   |   O    |  N   |
    # | oauth2_user_id   |   N   |   O    |  N   |
    #
    # *: LDAP users must have email OR ldap_unique_id (or both).
    #
    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        # CHECK constraints
        batch_op.create_check_constraint(
            "valid_auth_method",
            "auth_method IN ('LOCAL', 'OAUTH2', 'LDAP')",
        )

        # LOCAL users: must have password, must NOT have oauth2/ldap fields
        batch_op.create_check_constraint(
            "local_auth_has_password_no_oauth",
            "auth_method != 'LOCAL' "
            "OR (password_hash IS NOT NULL AND password_salt IS NOT NULL "
            "AND oauth2_client_id IS NULL AND oauth2_user_id IS NULL "
            "AND ldap_unique_id IS NULL)",
        )

        # LDAP users: must NOT have oauth2 fields, must have at least one identifier
        # (email or ldap_unique_id) to prevent orphan accounts that can't be found on login
        batch_op.create_check_constraint(
            "ldap_auth_valid",
            "auth_method != 'LDAP' OR ("
            "oauth2_client_id IS NULL AND oauth2_user_id IS NULL AND "
            "(email IS NOT NULL OR ldap_unique_id IS NOT NULL))",
        )

        # OAUTH2 users: must NOT have ldap_unique_id
        batch_op.create_check_constraint(
            "oauth2_auth_no_ldap_fields",
            "auth_method != 'OAUTH2' OR ldap_unique_id IS NULL",
        )

        # OAUTH2/LDAP users: must NOT have password
        batch_op.create_check_constraint(
            "non_local_auth_has_no_password",
            "auth_method = 'LOCAL' OR (password_hash IS NULL AND password_salt IS NULL)",
        )

        # LOCAL and OAUTH2 users: must have email (only LDAP supports null email mode)
        batch_op.create_check_constraint(
            "non_ldap_auth_has_email",
            "auth_method = 'LDAP' OR email IS NOT NULL",
        )

    # Step 6: Create partial unique indexes
    # OAuth2 users: unique on (oauth2_client_id, oauth2_user_id)
    op.create_index(
        "ix_users_oauth2_unique",
        "users",
        ["oauth2_client_id", "oauth2_user_id"],
        unique=True,
        postgresql_where=sa.text("auth_method = 'OAUTH2'"),
        sqlite_where=sa.text("auth_method = 'OAUTH2'"),
    )

    # LDAP users with unique_id: unique on ldap_unique_id
    op.create_index(
        "ix_users_ldap_unique_id",
        "users",
        ["ldap_unique_id"],
        unique=True,
        postgresql_where=sa.text("auth_method = 'LDAP' AND ldap_unique_id IS NOT NULL"),
        sqlite_where=sa.text("auth_method = 'LDAP' AND ldap_unique_id IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade to stopgap LDAP schema with markers.

    This function:
    1. Drops the new constraints and indexes
    2. Restores the stopgap markers for LDAP users (moves ldap_unique_id to oauth2_user_id)
    3. Generates null email markers for users with NULL emails
    4. Makes email column NOT NULL again
    5. Drops the ldap_unique_id column
    6. Recreates original constraints
    """
    # Step 1: Drop new indexes
    op.drop_index("ix_users_ldap_unique_id", "users")
    op.drop_index("ix_users_oauth2_unique", "users")

    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        # Drop new constraints
        batch_op.drop_constraint("non_ldap_auth_has_email", type_="check")
        batch_op.drop_constraint("oauth2_auth_no_ldap_fields", type_="check")
        batch_op.drop_constraint("ldap_auth_valid", type_="check")
        batch_op.drop_constraint("non_local_auth_has_no_password", type_="check")
        batch_op.drop_constraint("local_auth_has_password_no_oauth", type_="check")
        batch_op.drop_constraint("valid_auth_method", type_="check")

    # Step 2: Restore stopgap data format
    # Detect database dialect for SQL syntax differences
    dialect = op.get_bind().dialect.name

    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        # Restore LDAP marker, move ldap_unique_id back to oauth2_user_id, revert auth_method
        batch_op.execute(f"""
            UPDATE users
            SET auth_method = 'OAUTH2',
                oauth2_client_id = '{LDAP_CLIENT_ID_MARKER}',
                oauth2_user_id = ldap_unique_id
            WHERE auth_method = 'LDAP'
        """)

        # Generate null email markers for users with NULL emails
        # Use ldap_unique_id if available (for LDAP users), otherwise use id
        # Note: printf is SQLite-specific, PostgreSQL uses lpad(to_hex())
        if dialect == "sqlite":
            id_to_hex = "printf('%032x', id)"
        else:  # postgresql
            id_to_hex = "lpad(to_hex(id), 32, '0')"

        batch_op.execute(f"""
            UPDATE users
            SET email = '{NULL_EMAIL_MARKER_PREFIX}' ||
                CASE
                    WHEN ldap_unique_id IS NOT NULL
                    THEN lower(replace(ldap_unique_id, '-', ''))
                    ELSE {id_to_hex}
                END
            WHERE email IS NULL
        """)

    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        # Step 3: Make email NOT NULL again
        batch_op.alter_column(
            "email",
            existing_type=sa.String(),
            nullable=False,
        )

        # Step 4: Drop the ldap_unique_id column
        batch_op.drop_column("ldap_unique_id")

        # Step 5: Recreate original unique constraint
        batch_op.create_unique_constraint(
            "uq_users_oauth2_client_id_oauth2_user_id",
            ["oauth2_client_id", "oauth2_user_id"],
        )

        # Step 6: Recreate original CHECK constraints
        #
        # Original constraint summary (R = Required, N = Must be NULL, O = Optional):
        #
        # | Field            | LOCAL | OAUTH2 |
        # |------------------|-------|--------|
        # | email            |   R   |   R    |
        # | password         |   R   |   N    |
        # | oauth2_client_id |   N   |   O    |
        # | oauth2_user_id   |   N   |   O    |
        #
        # Note: LDAP users were stored as OAUTH2 with a marker in oauth2_client_id.
        #
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
