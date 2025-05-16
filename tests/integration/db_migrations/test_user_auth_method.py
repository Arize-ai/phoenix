from __future__ import annotations

from secrets import token_hex
from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, Engine, text
from typing_extensions import TypeAlias, assert_never

from . import (
    _down,
    _get_table_schema_info,
    _TableSchemaInfo,
    _up,
    _verify_clean_state,
)

DBBackend: TypeAlias = Literal["sqlite", "postgresql"]


def test_add_auth_method_to_users(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: DBBackend,
) -> None:
    """Test the migration that adds the auth_method column to the users table.

    This test verifies the complete migration process for adding the auth_method column,
    including both upgrade and downgrade paths. It ensures data integrity throughout
    the migration process and verifies that the schema changes are correctly applied.

    The test process:
    1. Initial Setup:
       - Verifies clean state
       - Runs initial migration
       - Creates test users with different auth methods

    2. Migration Testing:
       - Verifies pre-migration state
       - Runs auth_method migration
       - Verifies post-migration state and schema
       - Tests new user creation with auth_method
       - Tests constraint enforcement

    3. Downgrade Testing:
       - Runs downgrade migration
       - Verifies schema returns to initial state
       - Verifies data integrity

    Args:
        _engine: Database engine fixture
        _alembic_config: Alembic configuration fixture
        _db_backend: Database backend type ('sqlite' or 'postgresql')

    Raises:
        AssertionError: If any verification checks fail
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # Verify clean state and setup initial conditions
    _verify_clean_state(_engine)
    initial_info, role_id = _setup_initial_state(_engine, _alembic_config, _db_backend)

    # Run the migration twice to verify that it works multiple times
    for _ in range(2):
        with _engine.connect() as conn:
            # Create test users
            local_user_id, oauth_user_id = _create_test_users(conn, role_id)
            conn.commit()

        # Verify pre-migration state
        with _engine.connect() as conn:
            _verify_pre_migration_state(conn, _db_backend)

        # Run the auth_method migration
        _up(_engine, _alembic_config, "6a88424799fe")

        # Verify post-migration state and schema
        with _engine.connect() as conn:
            _verify_post_upgrade_schema(conn, _db_backend)
            _verify_post_migration_state(conn, local_user_id, oauth_user_id, role_id)

        # Test downgrade
        _down(_engine, _alembic_config, "cd164e83824f")

        # Verify downgrade state
        with _engine.connect() as conn:
            _verify_downgrade_state(conn, _db_backend)


def _setup_initial_state(
    engine: Engine,
    alembic_config: Config,
    db_backend: DBBackend,
) -> tuple[_TableSchemaInfo, int]:
    """Set up the initial database state for testing.

    This function:
    1. Runs the initial migration to create the base schema
    2. Gets the initial schema information for the users table
    3. Creates a test user role with 'MEMBER' privileges

    Args:
        engine: Database engine to use
        alembic_config: Alembic configuration for running migrations
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Returns:
        Tuple containing:
        - TableSchemaInfo: Initial schema information for the users table
        - int: ID of the created user role

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
        AssertionError: If role creation fails
    """
    # Run the initial migration
    _up(engine, alembic_config, "cd164e83824f")

    # Get initial schema info and create role
    with engine.connect() as conn:
        initial_info = _get_table_schema_info(conn, "users", db_backend)
        role_result = conn.execute(
            text(
                """
                INSERT INTO user_roles (name)
                VALUES ('MEMBER')
                RETURNING id
                """
            )
        ).scalar_one()
        assert isinstance(role_result, int)
        role_id = role_result
        conn.commit()
    assert initial_info
    return initial_info, role_id


def _verify_pre_migration_state(
    conn: Connection,
    db_backend: DBBackend,
) -> None:
    """Verify that the schema matches the expected state before migration.

    This function verifies that:
    1. The schema matches the expected pre-upgrade state
    2. All legacy constraints are present
    3. The auth_method column doesn't exist

    Args:
        conn: Database connection to use
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Raises:
        AssertionError: If the schema doesn't match the expected state
    """
    # Get actual schema info
    actual_info = _get_table_schema_info(conn, "users", db_backend)

    # Get expected schema info
    expected_info = _get_expected_pre_upgrade_schema(db_backend)

    # Verify schema matches
    assert expected_info == actual_info


def _get_expected_pre_upgrade_schema(db_backend: DBBackend) -> _TableSchemaInfo:
    """Get the expected schema information before the auth_method migration.

    This function defines the expected schema state before running the auth_method migration.
    The schema differs slightly between PostgreSQL and SQLite due to how they handle indices
    and constraints. In particular:
    - SQLite auto-generates index names for primary keys
    - PostgreSQL uses explicit names for all indices and constraints

    The pre-upgrade schema includes:
    1. Common columns for both backends:
       - id, user_role_id, username, email, password_hash, password_salt
       - reset_password, oauth2_client_id, oauth2_user_id
       - created_at, updated_at, profile_picture_url
    2. Common constraints for both backends:
       - Legacy constraints (exactly_one_auth_method, oauth2_client_id_and_user_id)
       - Password hash and salt constraint
       - Unique constraint on OAuth2 IDs
       - Primary key and foreign key constraints
    3. Backend-specific indices:
       - PostgreSQL: All indices have explicit names
       - SQLite: Primary key index is auto-generated

    Args:
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Returns:
        _TableSchemaInfo: Expected schema information before the upgrade, with
                         backend-specific differences handled appropriately.
    """
    # Common column names that exist in both PostgreSQL and SQLite
    column_names = {
        "id",
        "user_role_id",
        "username",
        "email",
        "password_hash",
        "password_salt",
        "reset_password",
        "oauth2_client_id",
        "oauth2_user_id",
        "created_at",
        "updated_at",
        "profile_picture_url",
    }

    # Common constraint names that exist in both backends
    constraint_names = {
        "ck_users_`exactly_one_auth_method`",  # Legacy constraint (removed in migration)
        "ck_users_`oauth2_client_id_and_user_id`",  # Legacy constraint (removed in migration)
        "ck_users_`password_hash_and_salt`",  # CHECK constraint for password fields
        "uq_users_oauth2_client_id_oauth2_user_id",  # Unique constraint on OAuth2 IDs
        "pk_users",  # Primary key constraint
        "fk_users_user_role_id_user_roles",  # Foreign key to user_roles table
    }

    # Common index names that exist in both backends
    index_names = {
        "ix_users_username",  # Index on username for faster lookups
        "ix_users_email",  # Index on email for faster lookups
        "ix_users_oauth2_client_id",  # Index on OAuth2 client ID
        "ix_users_oauth2_user_id",  # Index on OAuth2 user ID
        "ix_users_user_role_id",  # Index on user role ID for foreign key
    }
    if db_backend == "postgresql":
        index_names.update(
            {
                "pk_users",  # Primary key index
                "uq_users_oauth2_client_id_oauth2_user_id",  # Unique constraint on OAuth2 IDs
            }
        )
    elif db_backend == "sqlite":
        index_names.update(
            {
                "sqlite_autoindex_users_1",  # Auto-generated primary key index
            }
        )
    else:
        assert_never(db_backend)

    return _TableSchemaInfo(
        table_name="users",
        column_names=frozenset(column_names),
        index_names=frozenset(index_names),
        constraint_names=frozenset(constraint_names),
    )


def _get_expected_post_upgrade_schema(db_backend: DBBackend) -> _TableSchemaInfo:
    """Get the expected schema information after the auth_method migration.

    This function defines the expected schema state after running the auth_method migration.
    The schema differs from the pre-upgrade state in that:
    1. The auth_method column is added
    2. The auth_method CHECK constraint is added
    3. Legacy constraints (oauth2_client_id_and_user_id, exactly_one_auth_method) are removed

    The post-upgrade schema includes:
    1. All columns from pre-upgrade state plus auth_method
    2. All constraints from pre-upgrade state except legacy constraints
    3. New auth_method CHECK constraint
    4. Same indices as pre-upgrade state

    Args:
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Returns:
        _TableSchemaInfo: Expected schema information after the upgrade, with
                         backend-specific differences handled appropriately.
    """
    # Start with the pre-upgrade schema
    pre_upgrade = _get_expected_pre_upgrade_schema(db_backend)

    # Add the auth_method column
    column_names = set(pre_upgrade["column_names"])
    column_names.add("auth_method")

    # Add the auth_method CHECK constraint and remove legacy constraints
    constraint_names = set(pre_upgrade["constraint_names"])
    constraint_names.add("ck_users_`auth_method`")
    constraint_names.add("ck_users_`auth_method_password`")
    constraint_names.remove("ck_users_`exactly_one_auth_method`")
    constraint_names.remove("ck_users_`oauth2_client_id_and_user_id`")

    return _TableSchemaInfo(
        table_name=pre_upgrade["table_name"],
        column_names=frozenset(column_names),
        index_names=pre_upgrade["index_names"],
        constraint_names=frozenset(constraint_names),
    )


def _verify_post_upgrade_schema(
    conn: Connection,
    db_backend: DBBackend,
) -> None:
    """Verify that the schema matches the expected state after upgrade.

    This function verifies that:
    1. The schema matches the expected post-upgrade state
    2. The auth_method column exists
    3. The auth_method CHECK constraint exists
    4. Legacy constraints are removed

    Args:
        conn: Database connection to use
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Raises:
        AssertionError: If the schema doesn't match the expected state
    """
    # Get actual schema info
    actual_info = _get_table_schema_info(conn, "users", db_backend)

    # Get expected schema info
    expected_info = _get_expected_post_upgrade_schema(db_backend)

    # Verify schema matches
    assert expected_info == actual_info


def _verify_post_migration_state(
    conn: Connection,
    local_user_id: int,
    oauth_user_id: int,
    role_id: int,
) -> tuple[int, int]:
    """Verify the state after migration and test new user creation.

    This function:
    1. Verifies that existing users have correct auth_method values
    2. Creates new users with different auth methods
    3. Verifies the new users' properties
    4. Tests constraint enforcement for auth_method

    Args:
        conn: Database connection to use
        local_user_id: ID of the existing local authentication user
        oauth_user_id: ID of the existing OAuth2 user
        role_id: ID of the user role to assign to new users

    Returns:
        Tuple containing:
        - int: ID of the newly created local authentication user
        - int: ID of the newly created OAuth2 user

    Raises:
        AssertionError: If any verification checks fail
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    _verify_user_auth_methods(conn, local_user_id, oauth_user_id)
    return _create_and_verify_new_users(conn, role_id)


def _create_and_verify_new_users(
    conn: Connection,
    role_id: int,
) -> tuple[int, int]:
    """Create and verify new users with different authentication methods.

    This function:
    1. Creates a new local authentication user
    2. Creates a new OAuth2 user
    3. Verifies both users have correct properties
    4. Tests invalid auth_method cases

    Args:
        conn: Database connection to use
        role_id: ID of the user role to assign to new users

    Returns:
        Tuple containing:
        - int: ID of the newly created local authentication user
        - int: ID of the newly created OAuth2 user

    Raises:
        AssertionError: If any verification checks fail
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # Create new local auth user
    new_local_user_id = _create_local_user(conn, role_id)

    # Create new OAuth user
    new_oauth_user_id = _create_oauth_user(conn, role_id)

    # Verify new users
    _verify_new_users(conn, new_local_user_id, new_oauth_user_id)

    # Test invalid cases
    _test_invalid_auth_methods(conn, role_id)

    return new_local_user_id, new_oauth_user_id


def _create_local_user(
    conn: Connection,
    role_id: int,
) -> int:
    """Create a new local authentication user.

    Creates a user with:
    - Local authentication method
    - Password credentials
    - Randomly generated username and email
    - Assigned user role

    Args:
        conn: Database connection to use
        role_id: ID of the user role to assign

    Returns:
        int: ID of the created user

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
        AssertionError: If user creation fails
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
    - External authentication method
    - OAuth2 credentials
    - Randomly generated username, email, and OAuth IDs
    - Assigned user role

    Args:
        conn: Database connection to use
        role_id: ID of the user role to assign

    Returns:
        int: ID of the created user

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
        AssertionError: If user creation fails
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


def _verify_new_users(
    conn: Connection,
    local_user_id: int,
    oauth_user_id: int,
) -> None:
    """Verify that new users have correct authentication method properties.

    For the local authentication user, verifies:
    - auth_method is 'LOCAL'
    - password_hash is present
    - oauth2_client_id is not present

    For the OAuth2 user, verifies:
    - auth_method is 'OAUTH2'
    - password_hash is not present
    - oauth2_client_id is present

    Args:
        conn: Database connection to use
        local_user_id: ID of the local authentication user
        oauth_user_id: ID of the OAuth2 user

    Raises:
        AssertionError: If any verification checks fail
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    result = conn.execute(
        text(
            """
            SELECT id, auth_method, password_hash IS NOT NULL as has_password,
                   oauth2_client_id IS NOT NULL as has_oauth
            FROM users
            WHERE id IN (:local_id, :oauth_id)
            """
        ),
        {
            "local_id": local_user_id,
            "oauth_id": oauth_user_id,
        },
    ).fetchall()

    users = {u[0]: u for u in result}

    # Verify new local auth user
    local_user = users[local_user_id]
    assert local_user[1] == "LOCAL", "New local user should have auth_method 'LOCAL'"
    assert bool(local_user[2]), "New local user should have password_hash"
    assert not bool(local_user[3]), "New local user should not have oauth2_client_id"

    # Verify new OAuth user
    oauth_user = users[oauth_user_id]
    assert oauth_user[1] == "OAUTH2", "New OAuth user should have auth_method 'OAUTH2'"
    assert not bool(oauth_user[2]), "New OAuth user should not have password_hash"
    assert bool(oauth_user[3]), "New OAuth user should have oauth2_client_id"


def _test_invalid_auth_methods(
    conn: Connection,
    role_id: int,
) -> None:
    """Test that invalid authentication method values are rejected.

    Tests two invalid cases:
    1. Using an invalid auth_method value ('invalid')
    2. Omitting the auth_method column entirely

    Args:
        conn: Database connection to use
        role_id: ID of the user role to assign

    Raises:
        AssertionError: If invalid auth_method values are accepted
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # Test invalid auth_method value
    with pytest.raises(Exception):
        conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email, auth_method
                )
                VALUES (
                    :role_id, :username, :email, 'invalid'
                )
                """
            ),
            {
                "role_id": role_id,
                "username": f"invalid_user_{token_hex(4)}",
                "email": f"invalid_{token_hex(4)}@example.com",
            },
        )
        conn.commit()

    # Test missing auth_method
    with pytest.raises(Exception):
        conn.execute(
            text(
                """
                INSERT INTO users (
                    user_role_id, username, email
                )
                VALUES (
                    :role_id, :username, :email
                )
                """
            ),
            {
                "role_id": role_id,
                "username": f"missing_auth_{token_hex(4)}",
                "email": f"missing_{token_hex(4)}@example.com",
            },
        )
        conn.commit()


def _verify_downgrade_state(
    conn: Connection,
    db_backend: DBBackend,
) -> None:
    """Verify that the schema returns to its initial state after downgrade.

    This function verifies that:
    1. The schema matches the expected pre-upgrade state
    2. The auth_method column is removed
    3. Legacy constraints are restored

    Args:
        conn: Database connection to use
        db_backend: Type of database backend ('sqlite' or 'postgresql')

    Raises:
        AssertionError: If the schema does not match the initial state
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # Get actual schema info
    actual_info = _get_table_schema_info(conn, "users", db_backend)

    # Get expected schema info
    expected_info = _get_expected_pre_upgrade_schema(db_backend)

    # Verify schema matches
    assert expected_info == actual_info


def _create_test_users(
    conn: Connection,
    role_id: int,
) -> tuple[int, int]:
    """Create test users with different authentication methods.

    Creates two test users:
    1. A local authentication user with password credentials
    2. An OAuth2 user with client and user IDs

    Args:
        conn: Database connection to use for creating users
        role_id: ID of the user role to assign to the test users

    Returns:
        Tuple of (local_user_id, oauth_user_id) containing the IDs of the created users

    Raises:
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    # Create a local auth user
    local_user_result = conn.execute(
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
    ).scalar_one()
    assert isinstance(local_user_result, int)
    local_user_id = local_user_result

    # Create an OAuth2 user
    oauth_user_result = conn.execute(
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
    ).scalar_one()
    assert isinstance(oauth_user_result, int)
    oauth_user_id = oauth_user_result

    return local_user_id, oauth_user_id


def _verify_user_auth_methods(
    conn: Connection,
    local_user_id: int,
    oauth_user_id: int,
) -> None:
    """Verify that users have correct auth_method values after migration.

    Checks that:
    1. Local auth user has:
       - auth_method = 'LOCAL'
       - password_hash present
       - no OAuth2 credentials
    2. OAuth user has:
       - auth_method = 'OAUTH2'
       - no password_hash
       - OAuth2 credentials present

    Args:
        conn: Database connection to use for verification
        local_user_id: ID of the local authentication test user
        oauth_user_id: ID of the OAuth2 test user

    Raises:
        AssertionError: If any verification checks fail
        sqlalchemy.exc.SQLAlchemyError: If database operations fail
    """
    result = conn.execute(
        text(
            """
            SELECT id, auth_method, password_hash IS NOT NULL as has_password,
                   oauth2_client_id IS NOT NULL as has_oauth
            FROM users
            ORDER BY id
            """
        )
    ).fetchall()

    users = {u[0]: u for u in result}

    # Verify local auth user
    local_user = users[local_user_id]
    assert local_user[1] == "LOCAL", "Local user should have auth_method 'LOCAL'"
    assert bool(local_user[2]), "Local user should have password_hash"
    assert not bool(local_user[3]), "Local user should not have oauth2_client_id"

    # Verify OAuth user
    oauth_user = users[oauth_user_id]
    assert oauth_user[1] == "OAUTH2", "OAuth user should have auth_method 'OAUTH2'"
    assert not bool(oauth_user[2]), "OAuth user should not have password_hash"
    assert bool(oauth_user[3]), "OAuth user should have oauth2_client_id"
