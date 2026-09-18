# pyright: reportPrivateUsage=false
from __future__ import annotations

from secrets import token_hex
from typing import Any, Iterator, Literal, Optional, Union, cast

import httpx
import pytest
import smtpdfix
from phoenix.client.__generated__ import v1
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SYSTEM_EMAIL,
    DEFAULT_SYSTEM_USERNAME,
)
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.api.routers.v1.users import DEFAULT_PAGINATION_PAGE_LIMIT

from .._helpers import (
    _ADMIN,
    _DEFAULT_ADMIN,
    _MEMBER,
    _VIEWER,
    _AppInfo,
    _GetUser,
    _httpx_client,
    _initiate_password_reset,
    _log_in,
    _log_out,
    _server,
)


class _UsersApi:
    """Client for interacting with the Users API endpoints.

    This class provides methods for:
    - Creating users (both LOCAL and OAuth2)
    - Listing users with pagination
    - Deleting users
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def list(self) -> list[Union[v1.LocalUser, v1.OAuth2User, v1.LDAPUser]]:
        """List all users in the system.

        Returns:
            A list of all users, including LOCAL, OAuth2, and LDAP users.
            The list is automatically paginated to include all users.
        """
        all_users: list[Union[v1.LocalUser, v1.OAuth2User, v1.LDAPUser]] = []
        next_cursor: Optional[str] = None
        while True:
            url = "v1/users"
            params = {"cursor": next_cursor} if next_cursor else {}
            response = self._client.get(url, params=params)
            response.raise_for_status()
            data = cast(v1.GetUsersResponseBody, response.json())
            all_users.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_users

    def create(
        self,
        *,
        user: Union[v1.LocalUserData, v1.OAuth2UserData, v1.LDAPUserData],
        send_welcome_email: bool = True,
    ) -> Union[v1.LocalUser, v1.OAuth2User, v1.LDAPUser]:
        """Create a new user.

        Args:
            user: The user data to create. Can be LOCAL, OAuth2, or LDAP user.
            send_welcome_email: Whether to send a welcome email to the new user.

        Returns:
            The created user object.
        """
        url = "v1/users"
        json_ = v1.CreateUserRequestBody(user=user, send_welcome_email=send_welcome_email)
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateUserResponseBody, response.json())["data"]

    def delete(self, *, user_id: str) -> None:
        """Delete a user by their ID.

        Args:
            user_id: The ID of the user to delete.
        """
        url = f"v1/users/{user_id}"
        response = self._client.delete(url)
        response.raise_for_status()

    def patch(
        self,
        *,
        user_id: str,
        body: v1.PatchUserRequestBody,
    ) -> Union[v1.LocalUser, v1.OAuth2User, v1.LDAPUser]:
        """Patch a user by GlobalID."""
        url = f"v1/users/{user_id}"
        response = self._client.patch(url, json=body)
        response.raise_for_status()
        return cast(v1.GetUserResponseBody, response.json())["data"]


class TestClientForUsersAPI:
    """Integration tests for the REST API for users.

    These tests verify the functionality of the Users REST API, including:
    - User creation with different authentication methods (LOCAL/OAuth2) and roles (ADMIN/MEMBER)
    - User listing and pagination
    - User deletion
    - Access control and permissions
    - Data validation and error handling
    - Uniqueness constraints (username and email)
    - System user restrictions
    """

    async def test_crud_operations(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test CRUD operations for users via the REST API.

        This test verifies that:
        1. Users can be created with different auth methods and roles:
           - LOCAL users with/without password and password_needs_reset
           - OAuth2 users with various combinations of OAuth2 identifiers
        2. Users can be listed and verified (admin only)
        3. Users can be deleted (admin only)
        4. Username and email must be unique
        5. Cannot create users with SYSTEM role
        6. Cannot delete default admin or system users
        7. Password is never returned in user data
        8. OAuth2 specific fields are properly handled:
           - oauth2_client_id and oauth2_user_id are optional but at least one must be provided
           - OAuth2 users cannot have password-related fields
        """
        # Set up test environment using admin secret
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Create users with different auth methods and roles
        users_to_create: list[Union[v1.LocalUserData, v1.OAuth2UserData, v1.LDAPUserData]] = [
            # Local users with all fields
            v1.LocalUserData(
                email=f"test_local_member_{token_hex(8)}@example.com",
                username=f"test_user_local_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="LOCAL",
                password="some_password",  # Optional field
            ),
            # Local admin with password
            v1.LocalUserData(
                email=f"test_local_admin_pwd_{token_hex(8)}@example.com",
                username=f"test_user_local_admin_pwd_{token_hex(8)}",
                role="ADMIN",
                auth_method="LOCAL",
                password="admin_password",
            ),
            # Local user without optional password
            v1.LocalUserData(
                email=f"test_local_admin_{token_hex(8)}@example.com",
                username=f"test_user_local_admin_{token_hex(8)}",
                role="ADMIN",
                auth_method="LOCAL",
            ),
            # OAuth2 user with all optional fields
            v1.OAuth2UserData(
                email=f"test_oauth2_member_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="OAUTH2",
                oauth2_client_id=f"client_{token_hex(8)}",
                oauth2_user_id=f"user_{token_hex(8)}",
            ),
            # OAuth2 admin with all optional fields
            v1.OAuth2UserData(
                email=f"test_oauth2_admin_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_admin_{token_hex(8)}",
                role="ADMIN",
                auth_method="OAUTH2",
                oauth2_client_id=f"client_{token_hex(8)}",
                oauth2_user_id=f"user_{token_hex(8)}",
            ),
            # OAuth2 user with minimal fields (only client_id)
            v1.OAuth2UserData(
                email=f"test_oauth2_member2_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_member2_{token_hex(8)}",
                role="MEMBER",
                auth_method="OAUTH2",
                oauth2_client_id=f"client_{token_hex(8)}",
            ),
            # OAuth2 admin with only client_id
            v1.OAuth2UserData(
                email=f"test_oauth2_admin2_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_admin2_{token_hex(8)}",
                role="ADMIN",
                auth_method="OAUTH2",
                oauth2_client_id=f"client_{token_hex(8)}",
            ),
            # OAuth2 user with only user_id
            v1.OAuth2UserData(
                email=f"test_oauth2_member3_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_member3_{token_hex(8)}",
                role="MEMBER",
                auth_method="OAUTH2",
                oauth2_user_id=f"user_{token_hex(8)}",
            ),
            # OAuth2 admin with only user_id
            v1.OAuth2UserData(
                email=f"test_oauth2_admin3_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_admin3_{token_hex(8)}",
                role="ADMIN",
                auth_method="OAUTH2",
                oauth2_user_id=f"user_{token_hex(8)}",
            ),
            # OAuth2 user with no OAuth2 identifiers
            v1.OAuth2UserData(
                email=f"test_oauth2_member4_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_member4_{token_hex(8)}",
                role="MEMBER",
                auth_method="OAUTH2",
            ),
            # OAuth2 admin with no OAuth2 identifiers
            v1.OAuth2UserData(
                email=f"test_oauth2_admin4_{token_hex(8)}@example.com",
                username=f"test_user_oauth2_admin4_{token_hex(8)}",
                role="ADMIN",
                auth_method="OAUTH2",
            ),
            # LDAP users
            v1.LDAPUserData(
                email=f"test_ldap_member_{token_hex(8)}@example.com",
                username=f"test_user_ldap_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="LDAP",
            ),
            v1.LDAPUserData(
                email=f"test_ldap_admin_{token_hex(8)}@example.com",
                username=f"test_user_ldap_admin_{token_hex(8)}",
                role="ADMIN",
                auth_method="LDAP",
            ),
        ]

        # Create all users
        created_users: list[Union[v1.LocalUser, v1.OAuth2User, v1.LDAPUser]] = []
        for user_data in users_to_create:
            user = users_api.create(user=user_data)
            created_users.append(user)

        # List all users (READ operation)
        all_users = users_api.list()

        # Create a dictionary of all users indexed by email for easier lookup
        all_users_by_email = {user["email"]: user for user in all_users}

        # Verify all users were created with correct attributes
        for i, user_data in enumerate(users_to_create):
            created_user = all_users_by_email[user_data["email"]]
            assert created_user["id"], f"User {i} ID should be present after creation"
            assert created_user["username"] == user_data["username"], (
                f"User {i} username should match input after creation"
            )
            assert created_user["email"] == user_data["email"], (
                f"User {i} email should match input after creation"
            )
            assert created_user["role"] == user_data["role"], (
                f"User {i} role should match input after creation"
            )
            assert created_user["auth_method"] == user_data["auth_method"], (
                f"User {i} auth method should match input after creation"
            )

            # Verify auth method specific fields
            if created_user["auth_method"] == "OAUTH2":
                assert created_user.get("oauth2_client_id") == user_data.get("oauth2_client_id"), (
                    f"User {i} OAuth2 client ID should match input after creation"
                )
                assert created_user.get("oauth2_user_id") == user_data.get("oauth2_user_id"), (
                    f"User {i} OAuth2 user ID should match input after creation"
                )
            elif created_user["auth_method"] == "LOCAL":
                # Verify LOCAL auth method specific fields
                assert created_user["password_needs_reset"], (
                    f"User {i} should have password_needs_reset set"
                )
                assert "password" not in created_user, (
                    f"User {i} should not have password in response"
                )
            elif created_user["auth_method"] == "LDAP":
                # LDAP users should not have OAuth2 fields, ldap_unique_id, or password
                assert "oauth2_client_id" not in created_user, (
                    f"User {i} LDAP user should not expose oauth2_client_id"
                )
                assert "oauth2_user_id" not in created_user, (
                    f"User {i} LDAP user should not expose oauth2_user_id"
                )
                assert "ldap_unique_id" not in created_user, (
                    f"User {i} LDAP user should not expose ldap_unique_id"
                )
                assert "password" not in created_user, (
                    f"User {i} LDAP user should not have password in response"
                )
            else:
                assert_never(created_user["auth_method"])

        # Test username uniqueness (CREATE operation)
        duplicate_local_user_data = v1.LocalUserData(
            email=f"{token_hex(8)}@example.com",
            username=users_to_create[0]["username"],
            role="MEMBER",
            auth_method="LOCAL",
        )
        with pytest.raises(Exception):
            users_api.create(
                user=duplicate_local_user_data,
            )

        # Test email uniqueness (CREATE operation)
        duplicate_local_user_data = v1.LocalUserData(
            email=users_to_create[0]["email"],
            username=f"username_{token_hex(8)}",
            role="MEMBER",
            auth_method="LOCAL",
        )
        with pytest.raises(Exception):
            users_api.create(
                user=duplicate_local_user_data,
            )

        # Delete the users (DELETE operation)
        for user in created_users:
            users_api.delete(
                user_id=user["id"],
            )

        # Verify users were deleted by checking they're not in the list
        all_users_after_delete = users_api.list()
        all_users_by_id = {user["id"]: user for user in all_users_after_delete}

        # Verify none of our created users exist in the system anymore
        for i, created_user in enumerate(created_users):
            assert created_user["id"] not in all_users_by_id, (
                f"User {i} with ID {created_user['id']} should have been deleted"
            )

    async def test_cannot_delete_default_users(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test that users with default system/admin credentials cannot be deleted.

        This test verifies that:
        1. Cannot delete users with default system credentials
        2. Cannot delete users with default admin credentials
        3. Both attempts return 403 Forbidden
        """
        # Set up test environment with logged-in admin user
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Get all users to find default ones
        all_users = users_api.list()

        # Find users with default system/admin credentials that should be protected from deletion
        system_users = [
            u
            for u in all_users
            if u["email"] == DEFAULT_SYSTEM_EMAIL or u["username"] == DEFAULT_SYSTEM_USERNAME
        ]
        admin_users = [
            u
            for u in all_users
            if u["email"] == DEFAULT_ADMIN_EMAIL or u["username"] == DEFAULT_ADMIN_USERNAME
        ]

        assert len(system_users) == 1, (
            "Should have exactly one user with default system credentials"
        )
        assert len(admin_users) == 1, "Should have exactly one user with default admin credentials"

        # Get the users with default credentials
        system_user = system_users[0]
        admin_user = admin_users[0]

        # Try to delete a user with default system credentials
        with pytest.raises(Exception) as exc_info:
            users_api.delete(
                user_id=system_user["id"],
            )
        assert "403" in str(exc_info.value), (
            f"Should receive 403 Forbidden when attempting to delete user with default system credentials (ID: {system_user['id']})"
        )

        # Try to delete a user with default admin credentials
        with pytest.raises(Exception) as exc_info:
            users_api.delete(
                user_id=admin_user["id"],
            )
        assert "403" in str(exc_info.value), (
            f"Should receive 403 Forbidden when attempting to delete user with default admin credentials (ID: {admin_user['id']})"
        )

    @pytest.mark.parametrize("auth_method", ["LOCAL", "OAUTH2", "LDAP"])
    async def test_cannot_create_system_users(
        self,
        auth_method: Literal["LOCAL", "OAUTH2", "LDAP"],
        _app: _AppInfo,
    ) -> None:
        """Test that users with SYSTEM role cannot be created.

        This test verifies that:
        1. Cannot create users with SYSTEM role for LOCAL, OAuth2, and LDAP auth methods
        2. All attempts return 400 Bad Request
        """
        # Set up test environment with logged-in admin user
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Create test data based on auth method
        email = f"{token_hex(8)}@example.com"
        username = f"username_{token_hex(8)}"
        user_data: Union[v1.LocalUserData, v1.OAuth2UserData, v1.LDAPUserData]
        if auth_method == "LOCAL":
            user_data = v1.LocalUserData(
                email=email,
                username=username,
                role="SYSTEM",
                auth_method=auth_method,
            )
        elif auth_method == "OAUTH2":
            user_data = v1.OAuth2UserData(
                email=email,
                username=username,
                role="SYSTEM",
                auth_method=auth_method,
            )
        elif auth_method == "LDAP":
            user_data = v1.LDAPUserData(
                email=email,
                username=username,
                role="SYSTEM",
                auth_method=auth_method,
            )
        else:
            assert_never(auth_method)

        # Test that SYSTEM users cannot be created
        with pytest.raises(Exception) as exc_info:
            users_api.create(
                user=user_data,
            )
        assert "400" in str(exc_info.value), (
            f"Should receive 400 Bad Request when attempting to create {auth_method} SYSTEM user"
        )

    async def test_list_pagination(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test pagination functionality of the list users REST endpoint.

        This test verifies that:
        1. List endpoint returns all users across multiple pages
        2. Can verify user presence in list results
        3. Handles both LOCAL and OAuth2 users in pagination
        4. Respects the DEFAULT_PAGINATION_PAGE_LIMIT
        5. Returns correct next_cursor for pagination
        """
        # Set up test environment with logged-in admin user
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Create multiple users to test listing
        created_users: list[Union[v1.LocalUser, v1.OAuth2User, v1.LDAPUser]] = []
        for i in range(DEFAULT_PAGINATION_PAGE_LIMIT + 1):
            username = f"test_user_{i}_{token_hex(8)}"
            email = f"test_{i}_{token_hex(8)}@example.com"

            user = users_api.create(
                user=v1.LocalUserData(
                    email=email,
                    username=username,
                    role="MEMBER",
                    auth_method="LOCAL",
                ),
            )
            created_users.append(user)

        # Get all users
        all_users = users_api.list()

        # Verify all created users are present
        created_user_ids = {u["id"] for u in created_users}
        all_user_ids = {u["id"] for u in all_users}
        assert created_user_ids.issubset(all_user_ids), (
            "All created users should be present in list results"
        )

    @pytest.mark.parametrize("role", ["MEMBER", "ADMIN"])
    def test_new_local_user_can_login_with_assigned_password(
        self,
        role: Literal["MEMBER", "ADMIN"],
        _app: _AppInfo,
    ) -> None:
        """Test that a new local user can log in with the assigned password."""
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        password = token_hex(16)
        email = f"{token_hex(8)}@example.com"
        username = f"username_{token_hex(8)}"

        users_api.create(
            user=v1.LocalUserData(
                email=email,
                username=username,
                role=role,
                auth_method="LOCAL",
                password=password,
            ),
        )

        _log_in(_app, password, email=email)

    @pytest.mark.parametrize("send_welcome_email", [True, False])
    @pytest.mark.parametrize("role", ["MEMBER", "ADMIN"])
    @pytest.mark.parametrize("auth_method", ["LOCAL", "OAUTH2", "LDAP"])
    def test_welcome_email_is_sent(
        self,
        send_welcome_email: bool,
        role: Literal["MEMBER", "ADMIN"],
        auth_method: Literal["LOCAL", "OAUTH2", "LDAP"],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        """Test that welcome emails are sent correctly when creating users.

        This test verifies that:
        1. Welcome emails are sent when send_welcome_email=True for LOCAL, OAuth2, and LDAP users
        2. No welcome emails are sent when send_welcome_email=False for all user types
        """
        # Set up test environment with logged-in admin user
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Create user with specified welcome email setting
        email = f"{token_hex(8)}@example.com"
        username = f"username_{token_hex(8)}"
        user_data: Union[v1.LocalUserData, v1.OAuth2UserData, v1.LDAPUserData]
        if auth_method == "LOCAL":
            user_data = v1.LocalUserData(
                email=email,
                username=username,
                role=role,
                auth_method=auth_method,
            )
        elif auth_method == "OAUTH2":
            user_data = v1.OAuth2UserData(
                email=email,
                username=username,
                role=role,
                auth_method=auth_method,
            )
        elif auth_method == "LDAP":
            user_data = v1.LDAPUserData(
                email=email,
                username=username,
                role=role,
                auth_method=auth_method,
            )
        else:
            assert_never(auth_method)

        user = users_api.create(
            user=user_data,
            send_welcome_email=send_welcome_email,
        )

        # Verify email behavior
        welcome_emails_to_user = [msg for msg in _smtpd.messages if msg["to"] == user["email"]]
        if send_welcome_email:
            assert len(welcome_emails_to_user) == 1, "Welcome email should be sent"
        else:
            assert not welcome_emails_to_user, "No welcome email should be sent"


class TestEmailSanitization:
    """Test email sanitization for user creation via REST API.

    These tests verify that uppercase emails are properly sanitized and stored
    as lowercase in the database, fixing GitHub issue #8865.
    """

    async def test_rest_api_email_sanitization_local_user(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test that uppercase emails are sanitized when creating LOCAL users via REST API."""
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Test with uppercase email
        uppercase_email = f"TEST.USER.{token_hex(8).upper()}@EXAMPLE.COM"
        expected_lowercase_email = uppercase_email.lower()

        user_data = v1.LocalUserData(
            email=uppercase_email,
            username=f"test_sanitize_local_{token_hex(8)}",
            role="MEMBER",
            auth_method="LOCAL",
            password="test_password",
        )

        # Create user with uppercase email
        created_user = users_api.create(user=user_data)

        # Verify the response contains the lowercase email
        assert created_user["email"] == expected_lowercase_email, (
            f"Expected email to be sanitized to lowercase: {expected_lowercase_email}, "
            f"but got: {created_user['email']}"
        )

        # Verify in user list as well
        all_users = users_api.list()
        created_user_from_list = next(
            (user for user in all_users if user["id"] == created_user["id"]), None
        )
        assert created_user_from_list is not None
        assert created_user_from_list["email"] == expected_lowercase_email, (
            f"Email in user list should be lowercase: {expected_lowercase_email}, "
            f"but got: {created_user_from_list['email']}"
        )

        # Clean up
        users_api.delete(user_id=created_user["id"])

    async def test_rest_api_email_sanitization_oauth2_user(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test that uppercase emails are sanitized when creating OAuth2 users via REST API."""
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Test with uppercase email
        uppercase_email = f"OAUTH.USER.{token_hex(8).upper()}@DOMAIN.NET"
        expected_lowercase_email = uppercase_email.lower()

        user_data = v1.OAuth2UserData(
            email=uppercase_email,
            username=f"test_sanitize_oauth_{token_hex(8)}",
            role="ADMIN",
            auth_method="OAUTH2",
            oauth2_client_id="test_client",
            oauth2_user_id="test_oauth_user_id",
        )

        # Create user with uppercase email
        created_user = users_api.create(user=user_data)

        # Verify the response contains the lowercase email
        assert created_user["email"] == expected_lowercase_email, (
            f"Expected email to be sanitized to lowercase: {expected_lowercase_email}, "
            f"but got: {created_user['email']}"
        )

        # Verify in user list as well
        all_users = users_api.list()
        created_user_from_list = next(
            (user for user in all_users if user["id"] == created_user["id"]), None
        )
        assert created_user_from_list is not None
        assert created_user_from_list["email"] == expected_lowercase_email, (
            f"Email in user list should be lowercase: {expected_lowercase_email}, "
            f"but got: {created_user_from_list['email']}"
        )

        # Clean up
        users_api.delete(user_id=created_user["id"])

    async def test_rest_api_email_with_whitespace_sanitization(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test that emails with whitespace are trimmed and lowercased via REST API."""
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))

        # Test with whitespace and uppercase
        messy_email = f"  TRIM.ME.{token_hex(8).upper()}@WHITESPACE.COM  "
        expected_clean_email = messy_email.strip().lower()

        user_data = v1.LocalUserData(
            email=messy_email,
            username=f"test_sanitize_trim_{token_hex(8)}",
            role="MEMBER",
            auth_method="LOCAL",
            password="test_password",
        )

        # Create user with messy email
        created_user = users_api.create(user=user_data)

        # Verify the response contains the cleaned email
        assert created_user["email"] == expected_clean_email, (
            f"Expected email to be sanitized: {expected_clean_email}, "
            f"but got: {created_user['email']}"
        )

        # Clean up
        users_api.delete(user_id=created_user["id"])


class TestGetViewer:
    """Tests for the GET /v1/user endpoint."""

    async def test_returns_anonymous_user_when_auth_disabled(
        self,
        _ports: Iterator[int],
        _env_database: dict[str, str],
    ) -> None:
        """When auth is disabled, GET /v1/user returns an anonymous user."""
        from .._helpers import _server

        env = {
            **_env_database,
            "PHOENIX_PORT": str(next(_ports)),
            "PHOENIX_GRPC_PORT": str(next(_ports)),
        }
        with _server(_AppInfo(env)) as app:
            client = _httpx_client(app)
            response = client.get("v1/user")
            response.raise_for_status()
            data = response.json()["data"]
            assert data["auth_method"] == "ANONYMOUS"

    async def test_returns_authenticated_user_profile(
        self,
        _app: _AppInfo,
    ) -> None:
        """When auth is enabled, GET /v1/user returns the authenticated user's profile."""
        client = _httpx_client(_app, _app.admin_secret)
        response = client.get("v1/user")
        response.raise_for_status()
        data = response.json()["data"]
        assert data["auth_method"] in ("LOCAL", "OAUTH2", "LDAP")
        assert "username" in data
        assert "email" in data
        assert "id" in data
        assert "role" in data

    async def test_returns_401_without_credentials(
        self,
        _app: _AppInfo,
    ) -> None:
        """When auth is enabled and no token is provided, GET /v1/user returns 401."""
        client = _httpx_client(_app)
        response = client.get("v1/user")
        assert response.status_code == 401


class TestPatchUser:
    """Tests for PATCH /v1/users/{id}."""

    async def test_admin_can_patch_username(
        self,
        _app: _AppInfo,
    ) -> None:
        users_api = _UsersApi(_httpx_client(_app, _app.admin_secret))
        new_username = f"test_user_local_member_{token_hex(8)}"
        user_data = v1.LocalUserData(
            email=f"test_local_member_{token_hex(8)}@example.com",
            username=f"test_user_local_member_{token_hex(8)}",
            role="MEMBER",
            auth_method="LOCAL",
            password="some_password",
        )
        created = users_api.create(user=user_data)
        updated = users_api.patch(user_id=created["id"], body={"username": new_username})
        assert updated["username"] == new_username
        users_api.delete(user_id=created["id"])

    async def test_member_cannot_patch_another_user(
        self,
        _app: _AppInfo,
    ) -> None:
        admin_client = _UsersApi(_httpx_client(_app, _app.admin_secret))
        member_email = f"test_local_member_{token_hex(8)}@example.com"
        member_password = "some_password"
        member_user = admin_client.create(
            user=v1.LocalUserData(
                email=member_email,
                username=f"test_user_local_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="LOCAL",
                password=member_password,
            )
        )
        other = admin_client.create(
            user=v1.LocalUserData(
                email=f"test_local_member_{token_hex(8)}@example.com",
                username=f"test_user_local_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="LOCAL",
                password=member_password,
            )
        )
        tokens = _log_in(_app, member_password, email=member_email)
        member_http = _httpx_client(_app, tokens)
        response = member_http.patch(
            f"v1/users/{other['id']}",
            json={"username": "should_fail"},
        )
        assert response.status_code == 403
        # Log out so access/refresh tokens are cleared before admin deletes the member user.
        _log_out(_app, tokens)
        admin_client.delete(user_id=member_user["id"])
        admin_client.delete(user_id=other["id"])

    async def test_patch_empty_body_returns_422(
        self,
        _app: _AppInfo,
    ) -> None:
        admin_client = _UsersApi(_httpx_client(_app, _app.admin_secret))
        created = admin_client.create(
            user=v1.LocalUserData(
                email=f"test_local_member_{token_hex(8)}@example.com",
                username=f"test_user_local_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="LOCAL",
                password="some_password",
            )
        )
        client = _httpx_client(_app, _app.admin_secret)
        response = client.patch(f"v1/users/{created['id']}", json={})
        assert response.status_code == 422
        admin_client.delete(user_id=created["id"])

    @pytest.mark.parametrize("role", [_ADMIN, _MEMBER, _VIEWER])
    @pytest.mark.parametrize("use_api_key", [False, True], ids=["session", "api-key"])
    @pytest.mark.parametrize("self_update", [False, True], ids=["other", "self"])
    @pytest.mark.parametrize("field", ["username", "password", "role"])
    def test_role_and_credential_matrix(
        self,
        role: UserRoleInput,
        use_api_key: bool,
        self_update: bool,
        field: str,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        caller = _get_user(_app, role).log_in(_app)
        target = caller if self_update else _get_user(_app, _MEMBER)
        auth = caller.create_api_key(_app) if use_api_key else caller.tokens
        body = {
            "username": {"username": token_hex(12)},
            "password": {"password": token_hex(16), "current_password": caller.password},
            "role": {"role": "VIEWER"},
        }[field]
        allowed = not use_api_key and role == _ADMIN and not (self_update and field == "role")
        response = _httpx_client(_app, auth).patch(f"v1/users/{target.gid}", json=body)
        assert response.status_code == (200 if allowed else 403), response.text
        users = _UsersApi(_httpx_client(_app, _app.admin_secret)).list()
        stored = next(user for user in users if user["id"] == target.gid)
        assert stored["username"] == (
            body["username"] if allowed and field == "username" else target.username
        )
        assert stored["role"] == ("VIEWER" if allowed and field == "role" else target.role.value)
        if allowed:
            assert response.json()["data"] == stored
            assert "password" not in stored
            assert "password_hash" not in stored
        if field == "password":
            expected_password = body["password"] if allowed else target.password
            tokens = _log_in(_app, expected_password, email=target.email)
            _log_out(_app, tokens)

    @pytest.mark.parametrize("field", ["username", "password", "role"])
    def test_system_api_key_cannot_modify_accounts(
        self,
        field: str,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        admin = _get_user(_app, _ADMIN).log_in(_app)
        key = admin.create_api_key(_app, "System")
        try:
            body = {field: "MEMBER" if field == "role" else token_hex(16)}
            response = _httpx_client(_app, key).patch(f"v1/users/{admin.gid}", json=body)
            assert response.status_code == 403
        finally:
            admin.delete_api_key(_app, key)

    @pytest.mark.parametrize("field", ["username", "password", "role"])
    def test_admin_secret_cannot_modify_system_user(
        self,
        field: str,
        _app: _AppInfo,
    ) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        system = next(user for user in _UsersApi(client).list() if user["role"] == "SYSTEM")
        response = client.patch(
            f"v1/users/{system['id']}",
            json={field: "MEMBER" if field == "role" else token_hex(16)},
        )
        assert response.status_code == 403
        assert (
            next(user for user in _UsersApi(client).list() if user["id"] == system["id"]) == system
        )

    def test_default_admin_role_is_protected(self, _app: _AppInfo) -> None:
        response = _httpx_client(_app, _app.admin_secret).patch(
            f"v1/users/{_DEFAULT_ADMIN.gid}", json={"role": "MEMBER"}
        )
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "body",
        [
            {},
            {"username": ""},
            {"username": "  "},
            {"username": None},
            {"password": None},
            {"current_password": None},
            {"role": None},
            {"role": "SYSTEM"},
            {"role": "INVALID"},
            {"current_password": "unused"},
            {"username": "valid", "current_password": "unused"},
            {"username": "valid", "email": "other@example.com"},
            {"password": ""},
            {"password": "invalid password"},
        ],
    )
    def test_invalid_body_does_not_change_user(
        self,
        body: dict[str, Any],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        target = _get_user(_app, _MEMBER)
        client = _httpx_client(_app, _app.admin_secret)
        response = client.patch(f"v1/users/{target.gid}", json=body)
        assert response.status_code == 422, response.text
        stored = next(user for user in _UsersApi(client).list() if user["id"] == target.gid)
        assert stored["username"] == target.username
        assert stored["role"] == "MEMBER"

    @pytest.mark.parametrize("current_password", [None, "incorrect-password"])
    def test_self_password_requires_current_password(
        self,
        current_password: Optional[str],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        caller = _get_user(_app, _ADMIN).log_in(_app)
        body = {"password": token_hex(16), "username": token_hex(12)}
        if current_password is not None:
            body["current_password"] = current_password
        client = _httpx_client(_app, caller.tokens)
        response = client.patch(f"v1/users/{caller.gid}", json=body)
        assert response.status_code == (422 if current_password is None else 403)
        assert client.get("v1/user").json()["data"]["username"] == caller.username
        _log_out(_app, _log_in(_app, caller.password, email=caller.email))

    @pytest.mark.parametrize("field", ["password", "role"])
    def test_sensitive_update_revokes_sessions_and_api_keys(
        self,
        field: str,
        _get_user: _GetUser,
        _app: _AppInfo,
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        target = _get_user(_app, _ADMIN).log_in(_app)
        key = target.create_api_key(_app)
        reset_token = _initiate_password_reset(_app, target.email, _smtpd)
        assert reset_token is not None
        session_client = _httpx_client(_app, target.tokens)
        key_client = _httpx_client(_app, key)
        # Prime both authentication caches before changing the account.
        assert session_client.get("v1/users").status_code == 200
        assert key_client.get("v1/users").status_code == 200
        new_password = token_hex(16)
        body = {"password": new_password} if field == "password" else {"role": "MEMBER"}
        response = _httpx_client(_app, _app.admin_secret).patch(f"v1/users/{target.gid}", json=body)
        assert response.status_code == 200, response.text
        assert session_client.get("v1/user").status_code == 401
        assert key_client.get("v1/user").status_code == 401
        assert session_client.post("auth/refresh").status_code == 401
        reset_response = _httpx_client(_app).post(
            "auth/password-reset", json={"token": reset_token, "password": token_hex(16)}
        )
        assert reset_response.status_code == 401
        if field == "password":
            assert response.json()["data"]["password_needs_reset"] is True
            old_login = _httpx_client(_app).post(
                "auth/login", json={"email": target.email, "password": target.password}
            )
            assert old_login.status_code == 401
        tokens = _log_in(
            _app, new_password if field == "password" else target.password, email=target.email
        )
        fresh = _httpx_client(_app, tokens)
        assert fresh.get("v1/users").status_code == (200 if field == "password" else 403)
        _log_out(_app, tokens)

    def test_self_password_change_clears_cookies_and_reset_flag(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        caller = _get_user(_app, _ADMIN).log_in(_app)
        client = _httpx_client(_app, caller.tokens)
        response = client.patch(
            f"v1/users/{caller.gid}",
            json={"password": token_hex(16), "current_password": caller.password},
        )
        assert response.status_code == 200, response.text
        assert response.json()["data"]["password_needs_reset"] is False
        cookies = response.headers.get_list("set-cookie")
        assert len(cookies) == 2
        assert all("Max-Age=0" in cookie for cookie in cookies)
        assert _httpx_client(_app, caller.tokens).get("v1/user").status_code == 401

    def test_username_change_preserves_credentials(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        caller = _get_user(_app, _ADMIN).log_in(_app)
        key = caller.create_api_key(_app)
        client = _httpx_client(_app, caller.tokens)
        response = client.patch(f"v1/users/{caller.gid}", json={"username": f"  {token_hex(12)}  "})
        assert response.status_code == 200
        assert response.json()["data"]["username"] == response.json()["data"]["username"].strip()
        assert client.get("v1/user").status_code == 200
        assert _httpx_client(_app, key).get("v1/user").status_code == 200

    def test_conflicting_username_rolls_back_role_and_password(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        target = _get_user(_app, _MEMBER).log_in(_app)
        other = _get_user(_app, _MEMBER)
        client = _httpx_client(_app, _app.admin_secret)
        response = client.patch(
            f"v1/users/{target.gid}",
            json={"username": other.username, "role": "ADMIN", "password": token_hex(16)},
        )
        assert response.status_code == 409, response.text
        stored = _httpx_client(_app, target.tokens).get("v1/user").json()["data"]
        assert stored["username"] == target.username
        assert stored["role"] == "MEMBER"
        _log_out(_app, _log_in(_app, target.password, email=target.email))

    @pytest.mark.parametrize("auth_method", ["OAUTH2", "LDAP"])
    def test_external_users_cannot_receive_local_passwords(
        self,
        auth_method: Literal["OAUTH2", "LDAP"],
        _app: _AppInfo,
    ) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        users_api = _UsersApi(client)
        user_data: Union[v1.OAuth2UserData, v1.LDAPUserData]
        if auth_method == "OAUTH2":
            user_data = v1.OAuth2UserData(
                auth_method="OAUTH2",
                email=f"{token_hex(8)}@example.com",
                username=token_hex(12),
                role="MEMBER",
            )
        else:
            user_data = v1.LDAPUserData(
                auth_method="LDAP",
                email=f"{token_hex(8)}@example.com",
                username=token_hex(12),
                role="MEMBER",
            )
        created = users_api.create(user=user_data)
        try:
            response = client.patch(
                f"v1/users/{created['id']}", json={"password": token_hex(16), "role": "ADMIN"}
            )
            assert response.status_code == 409
            stored = next(user for user in users_api.list() if user["id"] == created["id"])
            assert stored["role"] == "MEMBER"
            response = client.patch(
                f"v1/users/{created['id']}", json={"username": token_hex(12), "role": "ADMIN"}
            )
            assert response.status_code == 200
            assert response.json()["data"]["auth_method"] == auth_method
        finally:
            users_api.delete(user_id=created["id"])

    @pytest.mark.parametrize(
        "user_id", ["bad-id", str(GlobalID("Project", "1")), str(GlobalID("User", "not-an-int"))]
    )
    def test_invalid_global_id(self, user_id: str, _app: _AppInfo) -> None:
        response = _httpx_client(_app, _app.admin_secret).patch(
            f"v1/users/{user_id}", json={"username": "valid"}
        )
        assert response.status_code == 422

    def test_missing_user(self, _app: _AppInfo) -> None:
        response = _httpx_client(_app, _app.admin_secret).patch(
            f"v1/users/{GlobalID('User', '999999999')}", json={"username": "valid"}
        )
        assert response.status_code == 404

    def test_no_auth_cannot_change_credentials(
        self,
        _ports: Iterator[int],
        _env_database: dict[str, str],
    ) -> None:
        env = {
            **_env_database,
            "PHOENIX_PORT": str(next(_ports)),
            "PHOENIX_GRPC_PORT": str(next(_ports)),
        }
        with _server(_AppInfo(env)) as app:
            client = _httpx_client(app)
            for body in ({"username": "changed"}, {"password": token_hex(16)}, {"role": "ADMIN"}):
                response = client.patch(f"v1/users/{GlobalID('User', '1')}", json=body)
                assert response.status_code == 403
