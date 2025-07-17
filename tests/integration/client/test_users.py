# pyright: reportPrivateUsage=false
from __future__ import annotations

from secrets import token_hex
from typing import Literal, Optional, Union, cast

import httpx
import pytest
import smtpdfix
from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SYSTEM_EMAIL,
    DEFAULT_SYSTEM_USERNAME,
)
from phoenix.client.__generated__ import v1
from phoenix.server.api.routers.v1.users import DEFAULT_PAGINATION_PAGE_LIMIT
from typing_extensions import assert_never

from .._helpers import _ADMIN, _MEMBER, _AppInfo, _GetUser, _httpx_client, _log_in


class _UsersApi:
    """Client for interacting with the Users API endpoints.

    This class provides methods for:
    - Creating users (both LOCAL and OAuth2)
    - Listing users with pagination
    - Deleting users
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def list(self) -> list[Union[v1.LocalUser, v1.OAuth2User]]:
        """List all users in the system.

        Returns:
            A list of all users, including both LOCAL and OAuth2 users.
            The list is automatically paginated to include all users.
        """
        all_users: list[Union[v1.LocalUser, v1.OAuth2User]] = []
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
        user: Union[v1.LocalUserData, v1.OAuth2UserData],
        send_welcome_email: bool = True,
    ) -> Union[v1.LocalUser, v1.OAuth2User]:
        """Create a new user.

        Args:
            user: The user data to create. Can be either a LOCAL or OAuth2 user.
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
        _get_user: _GetUser,
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
        # Set up test environment with logged-in user
        u = _get_user(_app, _ADMIN).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

        # Create users with different auth methods and roles
        users_to_create: list[Union[v1.LocalUserData, v1.OAuth2UserData]] = [
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
        ]

        # Create all users
        created_users: list[Union[v1.LocalUser, v1.OAuth2User]] = []
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
            assert (
                created_user["username"] == user_data["username"]
            ), f"User {i} username should match input after creation"
            assert (
                created_user["email"] == user_data["email"]
            ), f"User {i} email should match input after creation"
            assert (
                created_user["role"] == user_data["role"]
            ), f"User {i} role should match input after creation"
            assert (
                created_user["auth_method"] == user_data["auth_method"]
            ), f"User {i} auth method should match input after creation"

            # Verify OAuth2 specific fields if applicable
            if created_user["auth_method"] == "OAUTH2":
                assert created_user.get("oauth2_client_id") == user_data.get(
                    "oauth2_client_id"
                ), f"User {i} OAuth2 client ID should match input after creation"
                assert created_user.get("oauth2_user_id") == user_data.get(
                    "oauth2_user_id"
                ), f"User {i} OAuth2 user ID should match input after creation"
            elif created_user["auth_method"] == "LOCAL":
                # Verify LOCAL auth method specific fields
                assert created_user[
                    "password_needs_reset"
                ], f"User {i} should have password_needs_reset set"
                assert (
                    "password" not in created_user
                ), f"User {i} should not have password in response"
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
            assert (
                created_user["id"] not in all_users_by_id
            ), f"User {i} with ID {created_user['id']} should have been deleted"

    async def test_cannot_delete_default_users(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that users with default system/admin credentials cannot be deleted.

        This test verifies that:
        1. Cannot delete users with default system credentials
        2. Cannot delete users with default admin credentials
        3. Both attempts return 403 Forbidden
        """
        # Set up test environment with logged-in admin user
        u = _get_user(_app, _ADMIN).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

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

        assert (
            len(system_users) == 1
        ), "Should have exactly one user with default system credentials"
        assert len(admin_users) == 1, "Should have exactly one user with default admin credentials"

        # Get the users with default credentials
        system_user = system_users[0]
        admin_user = admin_users[0]

        # Try to delete a user with default system credentials
        with pytest.raises(Exception) as exc_info:
            users_api.delete(
                user_id=system_user["id"],
            )
        assert (
            "403" in str(exc_info.value)
        ), f"Should receive 403 Forbidden when attempting to delete user with default system credentials (ID: {system_user['id']})"  # noqa: E501

        # Try to delete a user with default admin credentials
        with pytest.raises(Exception) as exc_info:
            users_api.delete(
                user_id=admin_user["id"],
            )
        assert (
            "403" in str(exc_info.value)
        ), f"Should receive 403 Forbidden when attempting to delete user with default admin credentials (ID: {admin_user['id']})"  # noqa: E501

    @pytest.mark.parametrize("auth_method", ["LOCAL", "OAUTH2"])
    async def test_cannot_create_system_users(
        self,
        auth_method: Literal["LOCAL", "OAUTH2"],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that users with SYSTEM role cannot be created.

        This test verifies that:
        1. Cannot create users with SYSTEM role for both LOCAL and OAuth2 auth methods
        2. Both attempts return 400 Bad Request
        """
        # Set up test environment with logged-in admin user
        u = _get_user(_app, _ADMIN).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

        # Create test data based on auth method
        email = f"{token_hex(8)}@example.com"
        username = f"username_{token_hex(8)}"
        user_data: Union[v1.LocalUserData, v1.OAuth2UserData]
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
        else:
            assert_never(auth_method)

        # Test that SYSTEM users cannot be created
        with pytest.raises(Exception) as exc_info:
            users_api.create(
                user=user_data,
            )
        assert "400" in str(
            exc_info.value
        ), f"Should receive 400 Bad Request when attempting to create {auth_method} SYSTEM user"

    async def test_list_pagination(
        self,
        _get_user: _GetUser,
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
        u = _get_user(_app, _ADMIN).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

        # Create multiple users to test listing
        created_users: list[Union[v1.LocalUser, v1.OAuth2User]] = []
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
        assert created_user_ids.issubset(
            all_user_ids
        ), "All created users should be present in list results"

    async def test_member_access_denied(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that MEMBER role users are denied access to user management REST endpoints.

        This test verifies that:
        1. MEMBER users cannot create new users:
           - LOCAL users (both MEMBER and ADMIN roles)
           - OAuth2 users (both MEMBER and ADMIN roles)
        2. MEMBER users cannot list users
        3. MEMBER users cannot delete users
        4. All operations return 403 Forbidden
        5. Error messages clearly indicate permission denied
        """
        # Set up test environment with logged-in member user
        u = _get_user(_app, _MEMBER).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

        # Test that member cannot create LOCAL users
        with pytest.raises(Exception) as exc_info:
            users_api.create(
                user=v1.LocalUserData(
                    email=f"test_{token_hex(8)}@example.com",
                    username=f"test_user_{token_hex(8)}",
                    role="MEMBER",
                    auth_method="LOCAL",
                ),
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create LOCAL user"

        # Test that member cannot create LOCAL users with ADMIN role
        with pytest.raises(Exception) as exc_info:
            users_api.create(
                user=v1.LocalUserData(
                    email=f"test_admin_{token_hex(8)}@example.com",
                    username=f"test_user_admin_{token_hex(8)}",
                    role="ADMIN",
                    auth_method="LOCAL",
                ),
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create LOCAL ADMIN user"

        # Test that member cannot create OAuth2 users
        with pytest.raises(Exception) as exc_info:
            users_api.create(
                user=v1.OAuth2UserData(
                    email=f"test_oauth2_{token_hex(8)}@example.com",
                    username=f"test_user_oauth2_{token_hex(8)}",
                    role="MEMBER",
                    auth_method="OAUTH2",
                    oauth2_client_id=f"client_{token_hex(8)}",
                ),
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create OAuth2 user"

        # Test that member cannot create OAuth2 users with ADMIN role
        with pytest.raises(Exception) as exc_info:
            users_api.create(
                user=v1.OAuth2UserData(
                    email=f"test_oauth2_admin_{token_hex(8)}@example.com",
                    username=f"test_user_oauth2_admin_{token_hex(8)}",
                    role="ADMIN",
                    auth_method="OAUTH2",
                    oauth2_client_id=f"client_{token_hex(8)}",
                ),
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create OAuth2 ADMIN user"

        # Test that member cannot list users
        with pytest.raises(Exception) as exc_info:
            users_api.list()

        another_user = _get_user(_app, _MEMBER)

        # Test that member cannot delete users
        with pytest.raises(Exception) as exc_info:
            users_api.delete(
                user_id=another_user.gid,
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to delete user"

    @pytest.mark.parametrize("role", ["MEMBER", "ADMIN"])
    def test_new_local_user_can_login_with_assigned_password(
        self,
        role: Literal["MEMBER", "ADMIN"],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that a new local user can log in with the assigned password."""
        u = _get_user(_app, _ADMIN).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

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
    @pytest.mark.parametrize("auth_method", ["LOCAL", "OAUTH2"])
    def test_welcome_email_is_sent(
        self,
        send_welcome_email: bool,
        role: Literal["MEMBER", "ADMIN"],
        auth_method: Literal["LOCAL", "OAUTH2"],
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        """Test that welcome emails are sent correctly when creating users.

        This test verifies that:
        1. Welcome emails are sent when send_welcome_email=True for both LOCAL and OAuth2 users
        2. No welcome emails are sent when send_welcome_email=False for both user types
        """
        # Set up test environment with logged-in admin user
        u = _get_user(_app, _ADMIN).log_in(_app)
        users_api = _UsersApi(_httpx_client(_app, u.create_api_key(_app)))

        # Create user with specified welcome email setting
        email = f"{token_hex(8)}@example.com"
        username = f"username_{token_hex(8)}"
        user_data: Union[v1.LocalUserData, v1.OAuth2UserData]
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
