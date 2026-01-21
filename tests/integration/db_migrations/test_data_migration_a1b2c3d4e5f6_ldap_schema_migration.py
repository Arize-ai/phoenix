"""Test data migration for LDAP schema migration (a1b2c3d4e5f6).

This test verifies the migration that:
1. Adds 'LDAP' to the auth_method CHECK constraint
2. Adds the ldap_unique_id column for LDAP users
3. Makes the email column nullable
4. Migrates legacy LDAP users from auth_method='OAUTH2' to 'LDAP'
5. Moves oauth2_user_id to ldap_unique_id for LDAP users
6. Converts null email markers to actual NULLs
7. Clears oauth2_client_id and oauth2_user_id for LDAP users
8. Creates partial unique indexes for proper constraint enforcement
"""

from hashlib import md5
from secrets import token_hex
from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Engine, text

from . import _down, _up, _version_num

# Legacy markers used before this migration
LDAP_CLIENT_ID_MARKER = "\ue000LDAP(stopgap)"
NULL_EMAIL_MARKER_PREFIX = "\ue000NULL(stopgap)"


def _generate_null_email_marker(unique_id: str) -> str:
    """Generate a legacy null email marker for testing."""
    return f"{NULL_EMAIL_MARKER_PREFIX}{md5(unique_id.lower().encode()).hexdigest()}"


def test_ldap_schema_migration(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    """Test the LDAP schema migration with legacy data.

    This test verifies:
    1. Legacy LDAP users (with marker) are migrated to auth_method='LDAP'
    2. oauth2_user_id is moved to ldap_unique_id for LDAP users
    3. Legacy null email markers are converted to actual NULLs
    4. oauth2_client_id and oauth2_user_id are set to NULL for LDAP users
    5. New constraints are properly enforced
    6. Downgrade correctly restores the legacy format
    """
    # No migrations applied yet
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine, _schema)

    # Apply migrations up to right before our migration
    _up(_engine, _alembic_config, "3f53d82a1b7e", _schema)

    # Create test data in legacy format
    with _engine.connect() as conn:
        # Create a user role
        role_id = conn.execute(
            text(
                """
                INSERT INTO user_roles (name)
                VALUES ('MEMBER')
                RETURNING id
                """
            )
        ).scalar()
        assert isinstance(role_id, int)

        # Create a LOCAL user (should not be affected)
        local_user_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, password_hash, password_salt,
                    reset_password, auth_method, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email,
                    :password_hash, :password_salt, false, 'LOCAL', NULL, NULL
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"local_user_{token_hex(4)}",
                "email": f"local_{token_hex(4)}@example.com",
                "password_hash": b"test_hash",
                "password_salt": b"test_salt",
            },
        ).scalar()
        assert isinstance(local_user_id, int)

        # Create an OAuth2 user (should not be affected)
        oauth_user_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, password_hash, password_salt,
                    reset_password, auth_method, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email,
                    NULL, NULL, false, 'OAUTH2', :client_id, :user_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"oauth_user_{token_hex(4)}",
                "email": f"oauth_{token_hex(4)}@example.com",
                "client_id": f"google_{token_hex(4)}",
                "user_id": f"google_user_{token_hex(4)}",
            },
        ).scalar()
        assert isinstance(oauth_user_id, int)

        # Create a legacy LDAP user with email (should be migrated)
        ldap_unique_id = f"ldap-guid-{token_hex(8)}"
        ldap_user_with_email_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, password_hash, password_salt,
                    reset_password, auth_method, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email,
                    NULL, NULL, false, 'OAUTH2', :client_id, :user_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"ldap_user_{token_hex(4)}",
                "email": f"ldap_{token_hex(4)}@example.com",
                "client_id": LDAP_CLIENT_ID_MARKER,
                "user_id": ldap_unique_id,
            },
        ).scalar()
        assert isinstance(ldap_user_with_email_id, int)

        # Create a legacy LDAP user with null email marker (should be migrated)
        ldap_unique_id_2 = f"ldap-guid-{token_hex(8)}"
        null_email_marker = _generate_null_email_marker(ldap_unique_id_2)
        ldap_user_null_email_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, password_hash, password_salt,
                    reset_password, auth_method, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email,
                    NULL, NULL, false, 'OAUTH2', :client_id, :user_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"ldap_null_email_{token_hex(4)}",
                "email": null_email_marker,
                "client_id": LDAP_CLIENT_ID_MARKER,
                "user_id": ldap_unique_id_2,
            },
        ).scalar()
        assert isinstance(ldap_user_null_email_id, int)

        conn.commit()

    # Run the LDAP schema migration
    _up(_engine, _alembic_config, "a1b2c3d4e5f6", _schema)

    # Verify migration results
    with _engine.connect() as conn:
        # Verify LOCAL user is unchanged
        local_user = conn.execute(
            text(
                """
                SELECT auth_method, oauth2_client_id, oauth2_user_id, ldap_unique_id, email
                FROM users WHERE id = :id
                """
            ),
            {"id": local_user_id},
        ).first()
        assert local_user is not None
        assert local_user[0] == "LOCAL", "LOCAL user auth_method should be unchanged"
        assert local_user[1] is None, "LOCAL user oauth2_client_id should be NULL"
        assert local_user[2] is None, "LOCAL user oauth2_user_id should be NULL"
        assert local_user[3] is None, "LOCAL user ldap_unique_id should be NULL"
        assert local_user[4] is not None, "LOCAL user email should not be NULL"

        # Verify OAuth2 user is unchanged
        oauth_user = conn.execute(
            text(
                """
                SELECT auth_method, oauth2_client_id, oauth2_user_id, ldap_unique_id, email
                FROM users WHERE id = :id
                """
            ),
            {"id": oauth_user_id},
        ).first()
        assert oauth_user is not None
        assert oauth_user[0] == "OAUTH2", "OAuth2 user auth_method should be unchanged"
        assert oauth_user[1] is not None, "OAuth2 user oauth2_client_id should NOT be NULL"
        assert oauth_user[1] != LDAP_CLIENT_ID_MARKER, "OAuth2 user should not have LDAP marker"
        assert oauth_user[2] is not None, "OAuth2 user oauth2_user_id should NOT be NULL"
        assert oauth_user[3] is None, "OAuth2 user ldap_unique_id should be NULL"
        assert oauth_user[4] is not None, "OAuth2 user email should not be NULL"

        # Verify LDAP user with email is migrated
        ldap_user_email = conn.execute(
            text(
                """
                SELECT auth_method, oauth2_client_id, oauth2_user_id, ldap_unique_id, email
                FROM users WHERE id = :id
                """
            ),
            {"id": ldap_user_with_email_id},
        ).first()
        assert ldap_user_email is not None
        assert ldap_user_email[0] == "LDAP", "LDAP user auth_method should be 'LDAP'"
        assert ldap_user_email[1] is None, "LDAP user oauth2_client_id should be NULL"
        assert ldap_user_email[2] is None, "LDAP user oauth2_user_id should be NULL"
        assert ldap_user_email[3] == ldap_unique_id, "LDAP user ldap_unique_id should be preserved"
        assert ldap_user_email[4] is not None, "LDAP user email should be preserved"

        # Verify LDAP user with null email marker is migrated
        ldap_user_null = conn.execute(
            text(
                """
                SELECT auth_method, oauth2_client_id, oauth2_user_id, ldap_unique_id, email
                FROM users WHERE id = :id
                """
            ),
            {"id": ldap_user_null_email_id},
        ).first()
        assert ldap_user_null is not None
        assert ldap_user_null[0] == "LDAP", "LDAP user auth_method should be 'LDAP'"
        assert ldap_user_null[1] is None, "LDAP user oauth2_client_id should be NULL"
        assert ldap_user_null[2] is None, "LDAP user oauth2_user_id should be NULL"
        assert ldap_user_null[3] == ldap_unique_id_2, "LDAP user ldap_unique_id should be preserved"
        assert ldap_user_null[4] is None, "Null email marker should be converted to NULL"

    # Test new constraints
    with _engine.connect() as conn:
        # Test LDAP user with oauth2_client_id should fail
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'LDAP',
                        false, 'should_be_null', NULL, :ldap_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"ldap_invalid_{token_hex(4)}",
                    "email": f"ldap_invalid_{token_hex(4)}@example.com",
                    "ldap_id": f"ldap-guid-{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "ldap_auth_no_oauth_fields" in error_message, (
            "Expected ldap_auth_no_oauth_fields constraint violation"
        )

    # Test valid LDAP user creation
    with _engine.connect() as conn:
        new_ldap_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method,
                    reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                )
                VALUES (
                    :role_id, :username, NULL, 'LDAP',
                    false, NULL, NULL, :ldap_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"new_ldap_{token_hex(4)}",
                "ldap_id": f"new-ldap-guid-{token_hex(4)}",
            },
        ).scalar()
        conn.commit()
        assert isinstance(new_ldap_id, int), "Should be able to create LDAP user with NULL email"

    # Test downgrade
    _down(_engine, _alembic_config, "3f53d82a1b7e", _schema)

    # Verify downgrade state
    with _engine.connect() as conn:
        # Verify LDAP users are reverted to legacy format
        ldap_user_reverted = conn.execute(
            text(
                """
                SELECT auth_method, oauth2_client_id, oauth2_user_id, email
                FROM users WHERE id = :id
                """
            ),
            {"id": ldap_user_with_email_id},
        ).first()
        assert ldap_user_reverted is not None
        assert ldap_user_reverted[0] == "OAUTH2", "LDAP user should revert to auth_method='OAUTH2'"
        assert ldap_user_reverted[1] == LDAP_CLIENT_ID_MARKER, (
            "LDAP user should have LDAP marker restored"
        )
        assert ldap_user_reverted[2] == ldap_unique_id, (
            "LDAP user oauth2_user_id should be restored from ldap_unique_id"
        )

        # Verify null email was regenerated (not exact match due to different hash input)
        ldap_user_null_reverted = conn.execute(
            text(
                """
                SELECT auth_method, oauth2_client_id, oauth2_user_id, email
                FROM users WHERE id = :id
                """
            ),
            {"id": ldap_user_null_email_id},
        ).first()
        assert ldap_user_null_reverted is not None
        assert ldap_user_null_reverted[0] == "OAUTH2", (
            "LDAP user should revert to auth_method='OAUTH2'"
        )
        assert ldap_user_null_reverted[1] == LDAP_CLIENT_ID_MARKER, (
            "LDAP user should have LDAP marker restored"
        )
        assert ldap_user_null_reverted[2] == ldap_unique_id_2, (
            "LDAP user oauth2_user_id should be restored from ldap_unique_id"
        )
        assert ldap_user_null_reverted[3] is not None, "Null email should have marker regenerated"
        assert ldap_user_null_reverted[3].startswith(NULL_EMAIL_MARKER_PREFIX), (
            "Email should start with null marker prefix"
        )
