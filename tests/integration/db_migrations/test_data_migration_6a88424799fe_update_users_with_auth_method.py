from secrets import token_hex
from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, Engine, text

from . import _down, _up, _version_num


def test_user_auth_method_migration(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    """Test the migration that adds the auth_method column to the users table.

    This test verifies the complete migration process for adding the auth_method column,
    including both upgrade and downgrade paths. It ensures data integrity throughout
    the migration process and verifies that the schema changes are correctly applied.

    The test process:
    1. Initial Setup:
       - Verifies clean state
       - Runs initial migration
       - Creates test users with different auth methods (local and OAuth2)

    2. Migration Testing:
       - Verifies pre-migration state
       - Runs auth_method migration
       - Verifies post-migration state and schema
       - Tests new user creation with auth_method
       - Tests constraint enforcement for invalid auth_method values
       - Tests NOT NULL constraint for auth_method

    3. Downgrade Testing:
       - Runs downgrade migration
       - Verifies schema returns to initial state
       - Verifies data integrity of existing users
       - Verifies original constraints are restored correctly

    Args:
        _engine: Database engine fixture
        _alembic_config: Alembic configuration fixture
        _db_backend: Database backend type ('sqlite' or 'postgresql')

    Raises:
        AssertionError: If any verification checks fail
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # no migrations applied yet
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine, _schema)

    # apply migrations up to right before auth method migration
    _up(_engine, _alembic_config, "8a3764fe7f1a", _schema)

    # Create test users
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

        # Create a local auth user
        local_user_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, password_hash, password_salt,
                    reset_password, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email,
                    :password_hash, :password_salt, false, NULL, NULL
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

        # Create an OAuth2 user
        oauth_user_id = conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, password_hash, password_salt,
                    reset_password, oauth2_client_id, oauth2_user_id
                )
                VALUES (
                    :role_id, :username, :email,
                    NULL, NULL, false, :client_id, :user_id
                )
                RETURNING id
                """
            ),
            {
                "role_id": role_id,
                "username": f"oauth_user_{token_hex(4)}",
                "email": f"oauth_{token_hex(4)}@example.com",
                "client_id": f"test_client_{token_hex(4)}",
                "user_id": f"test_user_{token_hex(4)}",
            },
        ).scalar()
        assert isinstance(oauth_user_id, int)
        conn.commit()

    # Run the auth method migration
    _up(_engine, _alembic_config, "6a88424799fe", _schema)

    # Test post-migration constraints
    with _engine.connect() as conn:
        # Test invalid auth_method value
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_role_id, username, email, auth_method, reset_password
                    )
                    VALUES (
                        :role_id, :username, :email, 'INVALID', false
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"invalid_auth_{token_hex(4)}",
                    "email": f"invalid_auth_{token_hex(4)}@example.com",
                },
            )
        error_message = str(exc_info.value)
        assert (
            "valid_auth_method" in error_message
        ), "Expected valid_auth_method constraint violation"

    with _engine.connect() as conn:
        # Test LOCAL auth with OAuth2 credentials
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
                        :client_id, :user_id
                    )
                    """
                ),
                {
                    "role_id": role_id,
                    "username": f"local_with_oauth_{token_hex(4)}",
                    "email": f"local_with_oauth_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "client_id": f"test_client_{token_hex(4)}",
                    "user_id": f"test_user_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert (
            "local_auth_has_password_no_oauth" in error_message
        ), "Expected local_auth_has_password_no_oauth constraint violation"

    with _engine.connect() as conn:
        # Test OAUTH2 auth with password credentials
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
                    "username": f"oauth_with_password_{token_hex(4)}",
                    "email": f"oauth_with_password_{token_hex(4)}@example.com",
                    "password_hash": b"test_hash",
                    "password_salt": b"test_salt",
                    "client_id": f"test_client_{token_hex(4)}",
                    "user_id": f"test_user_{token_hex(4)}",
                },
            )
        error_message = str(exc_info.value)
        assert (
            "non_local_auth_has_no_password" in error_message
        ), "Expected non_local_auth_has_no_password constraint violation"

    # Test downgrade
    _down(_engine, _alembic_config, "8a3764fe7f1a", _schema)

    # Verify downgrade state
    with _engine.connect() as conn:
        # Verify users still exist and have correct data
        local_user = conn.execute(
            text(
                """
                SELECT password_hash IS NOT NULL as has_password_hash,
                       password_salt IS NOT NULL as has_password_salt,
                       oauth2_client_id IS NOT NULL as has_oauth2_client_id,
                       oauth2_user_id IS NOT NULL as has_oauth2_user_id
                FROM users
                WHERE id = :id
                """
            ),
            {"id": local_user_id},
        ).first()
        assert local_user is not None
        assert bool(local_user[0]), "Local user should still have password_hash"
        assert bool(local_user[1]), "Local user should still have password_salt"
        assert not bool(local_user[2]), "Local user should still not have oauth2_client_id"
        assert not bool(local_user[3]), "Local user should still not have oauth2_user_id"

    with _engine.connect() as conn:
        oauth_user = conn.execute(
            text(
                """
                SELECT password_hash IS NOT NULL as has_password_hash,
                       password_salt IS NOT NULL as has_password_salt,
                       oauth2_client_id IS NOT NULL as has_oauth2_client_id,
                       oauth2_user_id IS NOT NULL as has_oauth2_user_id
                FROM users
                WHERE id = :id
                """
            ),
            {"id": oauth_user_id},
        ).first()
        assert oauth_user is not None
        assert not bool(oauth_user[0]), "OAuth2 user should still not have password_hash"
        assert not bool(oauth_user[1]), "OAuth2 user should still not have password_salt"
        assert bool(oauth_user[2]), "OAuth2 user should still have oauth2_client_id"
        assert bool(oauth_user[3]), "OAuth2 user should still have oauth2_user_id"


def _create_local_user(
    conn: Connection,
    role_id: int,
) -> int:
    """Create a new local authentication user.

    Creates a user with:
    - Local authentication method ('LOCAL')
    - Password credentials (hash and salt)
    - Randomly generated username and email
    - Assigned user role
    - reset_password set to false

    Args:
        conn: Database connection to use
        role_id: ID of the user role to assign

    Returns:
        int: ID of the created user

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
        AssertionError: If user creation fails or returned ID is not an integer
    """
    result = conn.execute(
        text(
            """
            INSERT INTO users (
                user_role_id, username, email, password_hash, password_salt,
                reset_password, auth_method
            )
            VALUES (
                :role_id, :username, :email,
                :password_hash, :password_salt, false, 'LOCAL'
            )
            RETURNING id
            """
        ),
        {
            "role_id": role_id,
            "username": f"new_local_user_{token_hex(4)}",
            "email": f"new_local_{token_hex(4)}@example.com",
            "password_hash": b"new_hash",
            "password_salt": b"new_salt",
        },
    ).scalar_one()
    assert isinstance(result, int)
    return result


def _create_oauth_user(
    conn: Connection,
    role_id: int,
) -> int:
    """Create a new OAuth2 user.

    Creates a user with:
    - External authentication method ('OAUTH2')
    - OAuth2 credentials (client_id and user_id)
    - Randomly generated username, email, and OAuth IDs
    - Assigned user role
    - reset_password set to false

    Args:
        conn: Database connection to use
        role_id: ID of the user role to assign

    Returns:
        int: ID of the created user

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
        AssertionError: If user creation fails or returned ID is not an integer
    """
    result = conn.execute(
        text(
            """
            INSERT INTO users (
                user_role_id, username, email, oauth2_client_id, oauth2_user_id,
                reset_password, auth_method
            )
            VALUES (
                :role_id, :username, :email,
                :client_id, :user_id, false, 'OAUTH2'
            )
            RETURNING id
            """
        ),
        {
            "role_id": role_id,
            "username": f"new_oauth_user_{token_hex(4)}",
            "email": f"new_oauth_{token_hex(4)}@example.com",
            "client_id": f"new_client_{token_hex(4)}",
            "user_id": f"new_user_{token_hex(4)}",
        },
    ).scalar_one()
    assert isinstance(result, int)
    return result
