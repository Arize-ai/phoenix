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

    # ==========================================================================
    # TEST ALL CONSTRAINTS
    # ==========================================================================
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
    # Constraints:
    # - valid_auth_method: auth_method IN ('LOCAL', 'OAUTH2', 'LDAP')
    # - local_auth_has_password_no_oauth: LOCAL must have password, no oauth2/ldap fields
    # - non_local_auth_has_no_password: OAUTH2/LDAP must NOT have password
    # - ldap_auth_valid: LDAP must have no oauth2 fields, must have email OR ldap_unique_id
    # - oauth2_auth_no_ldap_fields: OAUTH2 must NOT have ldap_unique_id
    # - non_ldap_auth_has_email: LOCAL/OAUTH2 must have email
    # ==========================================================================

    # -------------------------------------------------------------------------
    # Test ldap_auth_valid: LDAP user with oauth2_client_id should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
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
        assert "ldap_auth_valid" in error_message, (
            "Expected ldap_auth_valid constraint violation for LDAP with oauth2_client_id"
        )

    # -------------------------------------------------------------------------
    # Test ldap_auth_valid: LDAP user with oauth2_user_id should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
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
                        false, NULL, 'should_be_null', :ldap_id
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
        assert "ldap_auth_valid" in error_message, (
            "Expected ldap_auth_valid constraint violation for LDAP with oauth2_user_id"
        )

    # -------------------------------------------------------------------------
    # Test ldap_auth_valid: LDAP orphan (NULL email AND NULL ldap_unique_id) should fail
    # This is the critical bug we're preventing!
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, NULL, 'LDAP',
                        false, NULL, NULL, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"ldap_orphan_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "ldap_auth_valid" in error_message, (
            "Expected ldap_auth_valid constraint violation for LDAP orphan "
            "(NULL email AND NULL ldap_unique_id)"
        )

    # -------------------------------------------------------------------------
    # Test non_ldap_auth_has_email: LOCAL user with NULL email should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, NULL, 'LOCAL',
                        :password_hash, :password_salt, false,
                        NULL, NULL, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"local_no_email_{token_hex(4)}",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                },
            )
        error_message = str(exc_info.value)
        assert "non_ldap_auth_has_email" in error_message, (
            "Expected non_ldap_auth_has_email constraint violation for LOCAL with NULL email"
        )

    # -------------------------------------------------------------------------
    # Test non_ldap_auth_has_email: OAUTH2 user with NULL email should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, NULL, 'OAUTH2',
                        false, :client_id, :user_id, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"oauth_no_email_{token_hex(4)}",
                    "client_id": f"google_{token_hex(4)}",
                    "user_id": f"google_user_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "non_ldap_auth_has_email" in error_message, (
            "Expected non_ldap_auth_has_email constraint violation for OAUTH2 with NULL email"
        )

    # -------------------------------------------------------------------------
    # Test oauth2_auth_no_ldap_fields: OAUTH2 user with ldap_unique_id should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'OAUTH2',
                        false, :client_id, :user_id, :ldap_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"oauth_with_ldap_{token_hex(4)}",
                    "email": f"oauth_with_ldap_{token_hex(4)}@example.com",
                    "client_id": f"google_{token_hex(4)}",
                    "user_id": f"google_user_{token_hex(4)}",
                    "ldap_id": f"ldap-guid-{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "oauth2_auth_no_ldap_fields" in error_message, (
            "Expected oauth2_auth_no_ldap_fields constraint violation"
        )

    # -------------------------------------------------------------------------
    # Test local_auth_has_password_no_oauth: LOCAL user with ldap_unique_id should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'LOCAL',
                        :password_hash, :password_salt, false,
                        NULL, NULL, :ldap_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"local_with_ldap_{token_hex(4)}",
                    "email": f"local_with_ldap_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "ldap_id": f"ldap-guid-{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "local_auth_has_password_no_oauth" in error_message, (
            "Expected local_auth_has_password_no_oauth constraint violation for LOCAL with ldap_unique_id"
        )

    # -------------------------------------------------------------------------
    # Test local_auth_has_password_no_oauth: LOCAL user with oauth2_client_id should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'LOCAL',
                        :password_hash, :password_salt, false,
                        :client_id, NULL, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"local_with_oauth_{token_hex(4)}",
                    "email": f"local_with_oauth_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "client_id": f"google_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "local_auth_has_password_no_oauth" in error_message, (
            "Expected local_auth_has_password_no_oauth constraint violation for LOCAL with oauth2_client_id"
        )

    # -------------------------------------------------------------------------
    # Test non_local_auth_has_no_password: LDAP user with password should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'LDAP',
                        :password_hash, :password_salt, false,
                        NULL, NULL, :ldap_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"ldap_with_password_{token_hex(4)}",
                    "email": f"ldap_with_password_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "ldap_id": f"ldap-guid-{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "non_local_auth_has_no_password" in error_message, (
            "Expected non_local_auth_has_no_password constraint violation for LDAP with password"
        )

    # -------------------------------------------------------------------------
    # Test non_local_auth_has_no_password: OAUTH2 user with password should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id, ldap_unique_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'OAUTH2',
                        :password_hash, :password_salt, false,
                        :client_id, :user_id, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"oauth_with_password_{token_hex(4)}",
                    "email": f"oauth_with_password_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "client_id": f"google_{token_hex(4)}",
                    "user_id": f"google_user_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "non_local_auth_has_no_password" in error_message, (
            "Expected non_local_auth_has_no_password constraint violation for OAUTH2 with password"
        )

    # -------------------------------------------------------------------------
    # Test unique index: Duplicate ldap_unique_id should fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        duplicate_ldap_id = f"duplicate-ldap-guid-{token_hex(4)}"
        # Create first LDAP user
        conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method,
                    reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                )
                VALUES (
                    :role_id, :username, :email, 'LDAP',
                    false, NULL, NULL, :ldap_id
                )
                """
            ),
            {
                "role_id": role_id,
                "username": f"ldap_dup1_{token_hex(4)}",
                "email": f"ldap_dup1_{token_hex(4)}@example.com",
                "ldap_id": duplicate_ldap_id,
            },
        )
        conn.commit()

    with _engine.connect() as conn:
        # Try to create second LDAP user with same ldap_unique_id
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
                        false, NULL, NULL, :ldap_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"ldap_dup2_{token_hex(4)}",
                    "email": f"ldap_dup2_{token_hex(4)}@example.com",
                    "ldap_id": duplicate_ldap_id,
                },
            )
        error_message = str(exc_info.value).lower()
        assert "unique" in error_message or "duplicate" in error_message, (
            "Expected unique constraint violation for duplicate ldap_unique_id"
        )

    # ==========================================================================
    # TEST VALID EDGE CASES
    # ==========================================================================

    # -------------------------------------------------------------------------
    # Valid: LDAP user with ldap_unique_id but NULL email (null email mode)
    # -------------------------------------------------------------------------
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
                "username": f"ldap_null_email_{token_hex(4)}",
                "ldap_id": f"ldap-guid-{token_hex(4)}",
            },
        ).scalar()
        conn.commit()
        assert isinstance(new_ldap_id, int), "Should be able to create LDAP user with NULL email"

    # -------------------------------------------------------------------------
    # Valid: LDAP user with email but NULL ldap_unique_id (simple mode)
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        ldap_email_only_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method,
                    reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                )
                VALUES (
                    :role_id, :username, :email, 'LDAP',
                    false, NULL, NULL, NULL
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"ldap_email_only_{token_hex(4)}",
                "email": f"ldap_email_only_{token_hex(4)}@example.com",
            },
        ).scalar()
        conn.commit()
        assert isinstance(ldap_email_only_id, int), (
            "Should be able to create LDAP user with email but NULL ldap_unique_id"
        )

    # -------------------------------------------------------------------------
    # Valid: LDAP user with both email and ldap_unique_id (enterprise mode)
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        ldap_both_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method,
                    reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                )
                VALUES (
                    :role_id, :username, :email, 'LDAP',
                    false, NULL, NULL, :ldap_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"ldap_both_{token_hex(4)}",
                "email": f"ldap_both_{token_hex(4)}@example.com",
                "ldap_id": f"ldap-guid-{token_hex(4)}",
            },
        ).scalar()
        conn.commit()
        assert isinstance(ldap_both_id, int), (
            "Should be able to create LDAP user with both email and ldap_unique_id"
        )

    # -------------------------------------------------------------------------
    # Valid: OAUTH2 user with NULL oauth2 fields (pre-provisioned)
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        oauth_preprovisioned_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method,
                    reset_password, oauth2_client_id, oauth2_user_id, ldap_unique_id
                )
                VALUES (
                    :role_id, :username, :email, 'OAUTH2',
                    false, NULL, NULL, NULL
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"oauth_preprovisioned_{token_hex(4)}",
                "email": f"oauth_preprovisioned_{token_hex(4)}@example.com",
            },
        ).scalar()
        conn.commit()
        assert isinstance(oauth_preprovisioned_id, int), (
            "Should be able to create OAUTH2 user with NULL oauth2 fields (pre-provisioned)"
        )

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

    # ==========================================================================
    # TEST DOWNGRADE CONSTRAINTS
    # ==========================================================================
    #
    # After downgrade, the old constraints should be restored:
    # - valid_auth_method: only 'LOCAL' and 'OAUTH2' (no 'LDAP')
    # - email is NOT NULL (required for all users)
    # - ldap_unique_id column does not exist
    # - local_auth_has_password_no_oauth: LOCAL must have password, no oauth2 fields
    # - non_local_auth_has_no_password: OAUTH2 must NOT have password
    # ==========================================================================

    # -------------------------------------------------------------------------
    # Downgrade: Verify ldap_unique_id column was dropped
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        # Try to select ldap_unique_id - should fail because column doesn't exist
        with pytest.raises(Exception) as exc_info:
            conn.execute(text("SELECT ldap_unique_id FROM users LIMIT 1"))
        error_message = str(exc_info.value).lower()
        assert "ldap_unique_id" in error_message, (
            "Expected error mentioning ldap_unique_id column (should not exist after downgrade)"
        )

    # -------------------------------------------------------------------------
    # Downgrade: auth_method='LDAP' should fail (not in valid_auth_method)
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        reset_password, oauth2_client_id, oauth2_user_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'LDAP',
                        false, NULL, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"ldap_after_downgrade_{token_hex(4)}",
                    "email": f"ldap_after_downgrade_{token_hex(4)}@example.com",
                },
            )
        error_message = str(exc_info.value)
        assert "valid_auth_method" in error_message, (
            "Expected valid_auth_method constraint violation for 'LDAP' after downgrade"
        )

    # -------------------------------------------------------------------------
    # Downgrade: NULL email should fail (email is NOT NULL after downgrade)
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        reset_password, oauth2_client_id, oauth2_user_id
                    )
                    VALUES (
                        :role_id, :username, NULL, 'OAUTH2',
                        false, :client_id, :user_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"oauth_null_email_downgrade_{token_hex(4)}",
                    "client_id": LDAP_CLIENT_ID_MARKER,
                    "user_id": f"ldap-guid-{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value).lower()
        assert "null" in error_message or "not null" in error_message, (
            "Expected NOT NULL constraint violation for NULL email after downgrade"
        )

    # -------------------------------------------------------------------------
    # Downgrade: LOCAL user with oauth2_client_id should still fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'LOCAL',
                        :password_hash, :password_salt, false,
                        :client_id, NULL
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"local_with_oauth_downgrade_{token_hex(4)}",
                    "email": f"local_with_oauth_downgrade_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "client_id": f"google_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "local_auth_has_password_no_oauth" in error_message, (
            "Expected local_auth_has_password_no_oauth constraint after downgrade"
        )

    # -------------------------------------------------------------------------
    # Downgrade: OAUTH2 user with password should still fail
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method,
                        password_hash, password_salt, reset_password,
                        oauth2_client_id, oauth2_user_id
                    )
                    VALUES (
                        :role_id, :username, :email, 'OAUTH2',
                        :password_hash, :password_salt, false,
                        :client_id, :user_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"oauth_with_password_downgrade_{token_hex(4)}",
                    "email": f"oauth_with_password_downgrade_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "client_id": f"google_{token_hex(4)}",
                    "user_id": f"google_user_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert "non_local_auth_has_no_password" in error_message, (
            "Expected non_local_auth_has_no_password constraint after downgrade"
        )

    # -------------------------------------------------------------------------
    # Downgrade: Valid LDAP user creation (using legacy marker format)
    # -------------------------------------------------------------------------
    with _engine.connect() as conn:
        legacy_ldap_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method,
                    reset_password, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email, 'OAUTH2',
                    false, :client_id, :user_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"legacy_ldap_{token_hex(4)}",
                "email": f"legacy_ldap_{token_hex(4)}@example.com",
                "client_id": LDAP_CLIENT_ID_MARKER,
                "user_id": f"ldap-guid-{token_hex(4)}",
            },
        ).scalar()
        conn.commit()
        assert isinstance(legacy_ldap_id, int), (
            "Should be able to create legacy LDAP user with marker after downgrade"
        )
