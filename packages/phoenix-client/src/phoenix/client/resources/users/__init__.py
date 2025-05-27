from __future__ import annotations

import logging
from typing import List, Optional, Union, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.encode_path_param import encode_path_param

logger = logging.getLogger(__name__)


class Users:
    """Client for interacting with the Users API endpoints.

    This class provides synchronous methods for creating, retrieving, and deleting users.

    Example:
        ```python
        from phoenix.client import Client
        from phoenix.client.__generated__ import v1

        client = Client()
        # List all users
        users = client.users.list()
        # Create a new user
        new_user = client.users.create(
            user=v1.LocalUserData(
                email="user@example.com",
                username="user",
                role="USER",
                auth_method="LOCAL",
                password_needs_reset=True,
            )
        )
        ```
    """  # noqa: E501

    def __init__(self, client: httpx.Client) -> None:
        """Initialize the Users client.

        Args:
            client: The httpx client to use for making requests.
        """
        self._client = client

    def list(
        self,
    ) -> List[Union[v1.LocalUser, v1.OAuth2User]]:
        """List all users.

        Returns:
            A list of all users.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            users = client.users.list()
            for user in users:
                print(f"User email: {user['email']}")
            ```
        """  # noqa: E501
        all_users: List[Union[v1.LocalUser, v1.OAuth2User]] = []
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
            user: The user data to create. Can be either LocalUserData or OAuth2UserData.
            send_welcome_email: Whether to send a welcome email to the new user.

        Returns:
            The newly created user.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import Client
            from phoenix.client.__generated__ import v1

            client = Client()
            # Create a local user
            local_user = client.users.create(
                user=v1.LocalUserData(
                    email="user@example.com",
                    username="user",
                    role="USER",
                    auth_method="LOCAL",
                    password_needs_reset=True,
                )
            )
            # Create an OAuth2 user
            oauth2_user = client.users.create(
                user=v1.OAuth2UserData(
                    email="oauth2@example.com",
                    username="oauth2user",
                    role="USER",
                    auth_method="OAUTH2",
                    oauth2_client_id="test-client",
                    oauth2_user_id="test-user",
                )
            )
            print(f"Created user with ID: {local_user['id']}")
            ```
        """  # noqa: E501
        url = "v1/users"
        json_ = v1.CreateUserRequestBody(user=user, send_welcome_email=send_welcome_email)
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateUserResponseBody, response.json())["data"]

    def delete(
        self,
        *,
        user_id: str,
    ) -> None:
        """Delete a user by ID.

        Args:
            user_id: The ID of the user to delete.

        Raises:
            httpx.HTTPError: If the request fails.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            # Delete by ID
            client.users.delete(user_id="UHJvamVjdDoy")
            ```
        """  # noqa: E501
        url = f"v1/users/{encode_path_param(user_id)}"
        response = self._client.delete(url)
        response.raise_for_status()


class AsyncUsers:
    """Asynchronous client for interacting with the Users API endpoints.

    This class provides asynchronous methods for creating, retrieving, and deleting users.

    Example:
        ```python
        from phoenix.client import AsyncClient
        from phoenix.client.__generated__ import v1

        async_client = AsyncClient()
        # List all users
        users = await async_client.users.list()
        # Create a new user
        new_user = await async_client.users.create(
            user=v1.LocalUserData(
                email="user@example.com",
                username="user",
                role="USER",
                auth_method="LOCAL",
                password_needs_reset=True,
            )
        )
        ```
    """  # noqa: E501

    def __init__(self, client: httpx.AsyncClient) -> None:
        """Initialize the AsyncUsers client.

        Args:
            client: The httpx async client to use for making requests.
        """
        self._client = client

    async def list(
        self,
    ) -> List[Union[v1.LocalUser, v1.OAuth2User]]:
        """List all users.

        Returns:
            A list of all users.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            users = await async_client.users.list()
            for user in users:
                print(f"User email: {user['email']}")
            ```
        """  # noqa: E501
        all_users: List[Union[v1.LocalUser, v1.OAuth2User]] = []
        next_cursor: Optional[str] = None
        while True:
            url = "v1/users"
            params = {"cursor": next_cursor} if next_cursor else {}
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            data = cast(v1.GetUsersResponseBody, response.json())
            all_users.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_users

    async def create(
        self,
        *,
        user: Union[v1.LocalUserData, v1.OAuth2UserData],
        send_welcome_email: bool = True,
    ) -> Union[v1.LocalUser, v1.OAuth2User]:
        """Create a new user.

        Args:
            user: The user data to create. Can be either LocalUserData or OAuth2UserData.
            send_welcome_email: Whether to send a welcome email to the new user.

        Returns:
            The newly created user.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient
            from phoenix.client.__generated__ import v1

            async_client = AsyncClient()
            # Create a local user
            local_user = await async_client.users.create(
                user=v1.LocalUserData(
                    email="user@example.com",
                    username="user",
                    role="USER",
                    auth_method="LOCAL",
                    password_needs_reset=True,
                )
            )
            # Create an OAuth2 user
            oauth2_user = await async_client.users.create(
                user=v1.OAuth2UserData(
                    email="oauth2@example.com",
                    username="oauth2user",
                    role="USER",
                    auth_method="OAUTH2",
                    oauth2_client_id="test-client",
                    oauth2_user_id="test-user",
                )
            )
            print(f"Created user with ID: {local_user['id']}")
            ```
        """  # noqa: E501
        url = "v1/users"
        json_ = v1.CreateUserRequestBody(user=user, send_welcome_email=send_welcome_email)
        response = await self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateUserResponseBody, response.json())["data"]

    async def delete(
        self,
        *,
        user_id: str,
    ) -> None:
        """Delete a user by ID.

        Args:
            user_id: The ID of the user to delete.

        Raises:
            httpx.HTTPError: If the request fails.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            # Delete by ID
            await async_client.users.delete(user_id="UHJvamVjdDoy")
            ```
        """  # noqa: E501
        url = f"v1/users/{encode_path_param(user_id)}"
        response = await self._client.delete(url)
        response.raise_for_status()
