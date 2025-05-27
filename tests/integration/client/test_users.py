# pyright: reportPrivateUsage=false
from __future__ import annotations

from secrets import token_hex
from typing import Union

import pytest
from phoenix.client.__generated__ import v1
from phoenix.server.api.routers.v1.users import DEFAULT_PAGINATION_PAGE_LIMIT
from strawberry.relay import GlobalID

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser


class TestClientForUsersAPI:
    """Integration tests for the Users client REST endpoints."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_crud_operations(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test CRUD operations for users.

        This test verifies that:
        1. Users can be created with different auth methods (LOCAL/OAuth2) and roles (ADMIN/MEMBER)
        2. Users can be created with various combinations of optional fields
        3. Users can be listed and verified (admin only)
        4. Users can be deleted (admin only)
        5. Username and email must be unique
        6. Cannot create users with SYSTEM role (both LOCAL and OAuth2)
        7. Cannot delete default admin or system users
        8. Password is never returned in user data
        9. OAuth2 specific fields are properly handled
        """
        # Set up test environment with logged-in user
        u = _get_user(_ADMIN).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Create users with different auth methods and roles
        users_to_create: list[Union[v1.LocalUserData, v1.OAuth2UserData]] = [
            # Local users with all fields
            v1.LocalUserData(
                username=f"test_user_local_member_{token_hex(8)}",
                email=f"test_local_member_{token_hex(8)}@example.com",
                role="MEMBER",
                auth_method="LOCAL",
                password_needs_reset=True,
                password="some_password",  # Optional field
            ),
            # Local user without optional password
            v1.LocalUserData(
                username=f"test_user_local_admin_{token_hex(8)}",
                email=f"test_local_admin_{token_hex(8)}@example.com",
                role="ADMIN",
                auth_method="LOCAL",
                password_needs_reset=True,
            ),
            # OAuth2 user with all optional fields
            v1.OAuth2UserData(
                username=f"test_user_oauth2_member_{token_hex(8)}",
                email=f"test_oauth2_member_{token_hex(8)}@example.com",
                role="MEMBER",
                auth_method="OAUTH2",
                oauth2_client_id=f"client_{token_hex(8)}",
                oauth2_user_id=f"user_{token_hex(8)}",
                profile_picture_url=f"https://example.com/avatar_{token_hex(8)}.png",
            ),
            # OAuth2 user with minimal fields
            v1.OAuth2UserData(
                username=f"test_user_oauth2_admin_{token_hex(8)}",
                email=f"test_oauth2_admin_{token_hex(8)}@example.com",
                role="ADMIN",
                auth_method="OAUTH2",
            ),
            # OAuth2 user with only client_id
            v1.OAuth2UserData(
                username=f"test_user_oauth2_member2_{token_hex(8)}",
                email=f"test_oauth2_member2_{token_hex(8)}@example.com",
                role="MEMBER",
                auth_method="OAUTH2",
                oauth2_client_id=f"client_{token_hex(8)}",
            ),
            # OAuth2 user with only user_id
            v1.OAuth2UserData(
                username=f"test_user_oauth2_member3_{token_hex(8)}",
                email=f"test_oauth2_member3_{token_hex(8)}@example.com",
                role="MEMBER",
                auth_method="OAUTH2",
                oauth2_user_id=f"user_{token_hex(8)}",
            ),
            # OAuth2 user with only profile picture
            v1.OAuth2UserData(
                username=f"test_user_oauth2_member4_{token_hex(8)}",
                email=f"test_oauth2_member4_{token_hex(8)}@example.com",
                role="MEMBER",
                auth_method="OAUTH2",
                profile_picture_url=f"https://example.com/avatar_{token_hex(8)}.png",
            ),
        ]

        # Create all users
        created_users: list[Union[v1.LocalUser, v1.OAuth2User]] = []
        for user_data in users_to_create:
            user: Union[v1.LocalUser, v1.OAuth2User] = await _await_or_return(
                Client().users.create(
                    user=user_data,
                )
            )
            created_users.append(user)

        # List all users (READ operation)
        all_users = await _await_or_return(Client().users.list())

        # Create a dictionary of all users indexed by email for easier lookup
        all_users_by_email = {user["email"]: user for user in all_users}

        # Verify all users were created with correct attributes
        for user_data in users_to_create:
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
        with pytest.raises(Exception):
            await _await_or_return(
                Client().users.create(
                    user=users_to_create[0],
                )
            )

        # Test email uniqueness (CREATE operation)
        duplicate_user = v1.LocalUserData(
            username=f"different_{token_hex(8)}",
            email=users_to_create[0]["email"],
            role="MEMBER",
            auth_method="LOCAL",
            password_needs_reset=True,
        )
        with pytest.raises(Exception):
            await _await_or_return(
                Client().users.create(
                    user=duplicate_user,
                )
            )

        # Test that SYSTEM users cannot be created (both LOCAL and OAuth2)
        system_user_data_local = v1.LocalUserData(
            username=f"test_user_local_system_{token_hex(8)}",
            email=f"test_local_system_{token_hex(8)}@example.com",
            role="SYSTEM",
            auth_method="LOCAL",
            password_needs_reset=True,
        )
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    user=system_user_data_local,
                )
            )
        assert "400" in str(
            exc_info.value
        ), "Should receive 400 Bad Request when attempting to create LOCAL SYSTEM user"

        system_user_data_oauth2 = v1.OAuth2UserData(
            username=f"test_user_oauth2_system_{token_hex(8)}",
            email=f"test_oauth2_system_{token_hex(8)}@example.com",
            role="SYSTEM",
            auth_method="OAUTH2",
        )
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    user=system_user_data_oauth2,
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
            user_data: Union[v1.LocalUserData, v1.OAuth2UserData]

            # Alternate between local and OAuth2 users
            if i % 2 == 0:
                user_data = v1.LocalUserData(
                    username=username,
                    email=email,
                    role="MEMBER",
                    auth_method="LOCAL",
                    password_needs_reset=True,
                )
            else:
                user_data = v1.OAuth2UserData(
                    username=username,
                    email=email,
                    role="MEMBER",
                    auth_method="OAUTH2",
                    oauth2_client_id=f"client_{token_hex(8)}",
                    oauth2_user_id=f"user_{token_hex(8)}",
                )

            user: Union[v1.LocalUser, v1.OAuth2User]
            user = await _await_or_return(
                Client().users.create(
                    user=user_data,
                )
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
        1. MEMBER users cannot create new users
        2. MEMBER users cannot list users
        3. MEMBER users cannot delete users
        4. All operations return 403 Forbidden
        """
        # Set up test environment with logged-in member user
        u = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Test that member cannot create users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.create(
                    user=v1.LocalUserData(
                        username=f"test_user_{token_hex(8)}",
                        email=f"test_{token_hex(8)}@example.com",
                        role="MEMBER",
                        auth_method="LOCAL",
                        password_needs_reset=True,
                    ),
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Member users should receive 403 Forbidden when attempting to create users"

        # Test that member cannot list users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(Client().users.list())
        assert "403" in str(
            exc_info.value
        ), "Member users should receive 403 Forbidden when attempting to list users"

        # Test that member cannot delete users
        with pytest.raises(Exception) as exc_info:
            await _await_or_return(
                Client().users.delete(
                    user_id="some_user_id",
                )
            )
        assert "403" in str(
            exc_info.value
        ), "Member users should receive 403 Forbidden when attempting to delete users"
