# pyright: reportPrivateUsage=false
from __future__ import annotations

from secrets import token_hex
from typing import Literal, Union, cast

import pytest
from phoenix.client.__generated__ import v1
from phoenix.server.api.routers.v1.users import DEFAULT_PAGINATION_PAGE_LIMIT
from strawberry.relay import GlobalID

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser


class TestClientForUsersAPI:
    """Integration tests for the Users client REST endpoints.

    These tests verify the functionality of the Users API client, including:
    - User creation with different authentication methods (LOCAL/OAuth2) and roles (ADMIN/MEMBER)
    - User listing and pagination
    - User deletion
    - Access control and permissions
    - Data validation and error handling
    - Uniqueness constraints (username and email)
    - System user restrictions
    """

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_crud_operations(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test CRUD operations for users.

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
        u = _get_user(_ADMIN).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Create users with different auth methods and roles
        local_users_to_create: list[v1.LocalUserData] = [
            # Local users with all fields
            v1.LocalUserData(
                email=f"test_local_member_{token_hex(8)}@example.com",
                username=f"test_user_local_member_{token_hex(8)}",
                role="MEMBER",
                auth_method="LOCAL",
                password_needs_reset=True,
                password="some_password",  # Optional field
            ),
            # Local admin with password
            v1.LocalUserData(
                email=f"test_local_admin_pwd_{token_hex(8)}@example.com",
                username=f"test_user_local_admin_pwd_{token_hex(8)}",
                role="ADMIN",
                auth_method="LOCAL",
                password_needs_reset=True,
                password="admin_password",
            ),
            # Local user without optional password
            v1.LocalUserData(
                email=f"test_local_admin_{token_hex(8)}@example.com",
                username=f"test_user_local_admin_{token_hex(8)}",
                role="ADMIN",
                auth_method="LOCAL",
                password_needs_reset=True,
            ),
            # Local user without password_needs_reset
            v1.LocalUserData(
                email=f"test_local_member_no_reset_{token_hex(8)}@example.com",
                username=f"test_user_local_member_no_reset_{token_hex(8)}",
                role="MEMBER",
                auth_method="LOCAL",
                password_needs_reset=False,
                password="no_reset_password",
            ),
        ]

        oauth2_users_to_create: list[v1.OAuth2UserData] = [
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

        # Create LOCAL users
        for local_user_data in local_users_to_create:
            local_user = cast(
                v1.LocalUser,
                await _await_or_return(
                    Client().users.create(
                        email=local_user_data["email"],
                        username=local_user_data["username"],
                        role=cast(Literal["ADMIN", "MEMBER"], local_user_data["role"]),
                        auth_method=local_user_data["auth_method"],
                        password_needs_reset=local_user_data.get("password_needs_reset", True),
                        password=local_user_data.get("password"),
                    )
                ),
            )
            created_users.append(local_user)

        # Create OAuth2 users
        for oauth2_user_data in oauth2_users_to_create:
            oauth2_user = cast(
                v1.OAuth2User,
                await _await_or_return(
                    Client().users.create(
                        email=oauth2_user_data["email"],
                        username=oauth2_user_data["username"],
                        role=cast(Literal["ADMIN", "MEMBER"], oauth2_user_data["role"]),
                        auth_method=oauth2_user_data["auth_method"],
                        oauth2_client_id=oauth2_user_data.get("oauth2_client_id"),
                        oauth2_user_id=oauth2_user_data.get("oauth2_user_id"),
                    )
                ),
            )
            created_users.append(oauth2_user)

        # List all users (READ operation)
        all_users = await _await_or_return(Client().users.list())

        # Create a dictionary of all users indexed by email for easier lookup
        all_users_by_email = {user["email"]: user for user in all_users}

        # Verify all users were created with correct attributes
        for user_data in local_users_to_create + oauth2_users_to_create:
            created_user = all_users_by_email[user_data["email"]]
            assert created_user["id"], "User ID should be present after creation"
            assert (
                created_user["username"] == user_data["username"]
            ), "Username should match input after creation"
            assert (
                created_user["email"] == user_data["email"]
            ), "Email should match input after creation"
            assert (
                created_user["role"] == user_data["role"]
            ), "Role should match input after creation"
            assert (
                created_user["auth_method"] == user_data["auth_method"]
            ), "Auth method should match input after creation"

            # Verify OAuth2 specific fields if applicable
            if user_data["auth_method"] == "OAUTH2":
                assert created_user.get("oauth2_client_id") == user_data.get("oauth2_client_id")
                assert created_user.get("oauth2_user_id") == user_data.get("oauth2_user_id")
            else:
                # Verify LOCAL auth method specific fields
                assert created_user.get("password_needs_reset")
                assert "password" not in created_user

        # Test username uniqueness (CREATE operation)
        duplicate_local_user = local_users_to_create[0]
        with pytest.raises(Exception):
            await _await_or_return(
                Client().users.create(
                    email=duplicate_local_user["email"],
                    username=duplicate_local_user["username"],
                    role=cast(Literal["ADMIN", "MEMBER"], duplicate_local_user["role"]),
                    auth_method=duplicate_local_user["auth_method"],
                    password_needs_reset=duplicate_local_user.get("password_needs_reset", True),
                    password=duplicate_local_user.get("password"),
                )
            )

        # Test email uniqueness (CREATE operation)
        duplicate_local_user_data = v1.LocalUserData(
            email=local_users_to_create[0]["email"],
            username=f"different_{token_hex(8)}",
            role="MEMBER",
            auth_method="LOCAL",
            password_needs_reset=True,
        )
        with pytest.raises(Exception):
            await _await_or_return(
                Client().users.create(
                    email=duplicate_local_user_data["email"],
                    username=duplicate_local_user_data["username"],
                    role=cast(Literal["ADMIN", "MEMBER"], duplicate_local_user_data["role"]),
                    auth_method=duplicate_local_user_data["auth_method"],
                    password_needs_reset=duplicate_local_user_data.get(
                        "password_needs_reset", True
                    ),
                    password=duplicate_local_user_data.get("password"),
                )
            )

        # Test that SYSTEM users cannot be created (both LOCAL and OAuth2)
        system_user_data_local = v1.LocalUserData(
            email=f"test_local_system_{token_hex(8)}@example.com",
            username=f"test_user_local_system_{token_hex(8)}",
            role="SYSTEM",
            auth_method="LOCAL",
            password_needs_reset=True,
        )
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    email=system_user_data_local["email"],
                    username=system_user_data_local["username"],
                    role=cast(Literal["ADMIN", "MEMBER"], system_user_data_local["role"]),
                    auth_method=system_user_data_local["auth_method"],
                    password_needs_reset=system_user_data_local.get("password_needs_reset", True),
                )
            )
        assert "400" in str(
            exc_info.value
        ), "Should receive 400 Bad Request when attempting to create LOCAL SYSTEM user"

        system_user_data_oauth2 = v1.OAuth2UserData(
            email=f"test_oauth2_system_{token_hex(8)}@example.com",
            username=f"test_user_oauth2_system_{token_hex(8)}",
            role="SYSTEM",
            auth_method="OAUTH2",
            oauth2_client_id=f"client_{token_hex(8)}",
        )
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    email=system_user_data_oauth2["email"],
                    username=system_user_data_oauth2["username"],
                    role=cast(Literal["ADMIN", "MEMBER"], system_user_data_oauth2["role"]),
                    auth_method=system_user_data_oauth2["auth_method"],
                    oauth2_client_id=system_user_data_oauth2.get("oauth2_client_id"),
                    oauth2_user_id=system_user_data_oauth2.get("oauth2_user_id"),
                )
            )
        assert "400" in str(
            exc_info.value
        ), "Should receive 400 Bad Request when attempting to create OAuth2 SYSTEM user"

        # Delete the users (DELETE operation)
        for user in created_users:
            await _await_or_return(
                Client().users.delete(
                    user_id=user["id"],
                )
            )

        # Verify users were deleted by checking they're not in the list
        all_users_after_delete = await _await_or_return(Client().users.list())
        all_users_by_id = {user["id"]: user for user in all_users_after_delete}

        # Verify none of our created users exist in the system anymore
        for created_user in created_users:
            assert (
                created_user["id"] not in all_users_by_id
            ), f"User {created_user['id']} should have been deleted"

        # Find the first system user and admin user by ID
        system_users = [u for u in all_users if u["role"] == "SYSTEM"]
        admin_users = [u for u in all_users if u["role"] == "ADMIN"]

        assert system_users, "Should have at least one system user"
        assert admin_users, "Should have at least one admin user"

        # Sort by ID to find the smallest ones
        first_system_user = min(system_users, key=lambda u: int(GlobalID.from_id(u["id"]).node_id))
        first_admin_user = min(admin_users, key=lambda u: int(GlobalID.from_id(u["id"]).node_id))

        # Try to delete the first system user
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.delete(
                    user_id=first_system_user["id"],
                )
            )
        assert "409" in str(
            exc_info.value
        ), "Should receive 409 Conflict when attempting to delete first system user"

        # Try to delete the first admin user
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.delete(
                    user_id=first_admin_user["id"],
                )
            )
        assert "409" in str(
            exc_info.value
        ), "Should receive 409 Conflict when attempting to delete first admin user"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_list_pagination(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test pagination functionality of the list method.

        This test verifies that:
        1. List method returns all users across multiple pages
        2. Can verify user presence in list results
        3. Handles both LOCAL and OAuth2 users in pagination
        4. Respects the DEFAULT_PAGINATION_PAGE_LIMIT
        5. Returns correct next_cursor for pagination
        """
        # Set up test environment with logged-in admin user
        u = _get_user(_ADMIN).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Create multiple users to test listing
        created_users: list[Union[v1.LocalUser, v1.OAuth2User]] = []
        for i in range(DEFAULT_PAGINATION_PAGE_LIMIT + 1):
            username = f"test_user_{i}_{token_hex(8)}"
            email = f"test_{i}_{token_hex(8)}@example.com"

            user = cast(
                v1.LocalUser,
                await _await_or_return(
                    Client().users.create(
                        email=email,
                        username=username,
                        role="MEMBER",
                        auth_method="LOCAL",
                        password_needs_reset=True,
                    )
                ),
            )
            created_users.append(user)

        # Get all users
        all_users = await _await_or_return(Client().users.list())

        # Verify all created users are present
        created_user_ids = {u["id"] for u in created_users}
        all_user_ids = {u["id"] for u in all_users}
        assert created_user_ids.issubset(
            all_user_ids
        ), "All created users should be present in list results"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_member_access_denied(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that MEMBER role users are denied access to user management operations.

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
        u = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test that member cannot create LOCAL users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    email=f"test_{token_hex(8)}@example.com",
                    username=f"test_user_{token_hex(8)}",
                    role="MEMBER",
                    auth_method="LOCAL",
                    password_needs_reset=True,
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create LOCAL user"

        # Test that member cannot create LOCAL users with ADMIN role
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    email=f"test_admin_{token_hex(8)}@example.com",
                    username=f"test_user_admin_{token_hex(8)}",
                    role="ADMIN",
                    auth_method="LOCAL",
                    password_needs_reset=True,
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create LOCAL ADMIN user"

        # Test that member cannot create OAuth2 users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    email=f"test_oauth2_{token_hex(8)}@example.com",
                    username=f"test_user_oauth2_{token_hex(8)}",
                    role="MEMBER",
                    auth_method="OAUTH2",
                    oauth2_client_id=f"client_{token_hex(8)}",
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create OAuth2 user"

        # Test that member cannot create OAuth2 users with ADMIN role
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    email=f"test_oauth2_admin_{token_hex(8)}@example.com",
                    username=f"test_user_oauth2_admin_{token_hex(8)}",
                    role="ADMIN",
                    auth_method="OAUTH2",
                    oauth2_client_id=f"client_{token_hex(8)}",
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to create OAuth2 ADMIN user"

        # Test that member cannot list users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(Client().users.list())

        another_user = _get_user(_MEMBER)

        # Test that member cannot delete users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.delete(
                    user_id=another_user.gid,
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Should receive 403 Forbidden when attempting to delete user"
