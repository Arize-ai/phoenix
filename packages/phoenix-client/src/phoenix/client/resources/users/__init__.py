from __future__ import annotations

import logging
from typing import List, Literal, Optional, Union, cast

import httpx
from typing_extensions import assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.utils.encode_path_param import encode_path_param

logger = logging.getLogger(__name__)


class Users:
    """Client for interacting with the Users API endpoints.

    This class provides synchronous methods for creating, retrieving, and deleting users.

    Authentication Methods:
        - LOCAL: Users authenticate with a username and password. These users can have an optional
          password set during creation, and can be configured to require a password reset on first login.
        - OAUTH2: Users authenticate through an OAuth2 provider. These users must have either an
          OAuth2 client ID or user ID (or both) from their OAuth2 provider. They cannot have passwords.

    Example:
        ```python
        from phoenix.client import Client

        client = Client()
        # List all users
        users = client.users.list()
        # Create a new user
        new_user = client.users.create(
            email="user@example.com",
            username="user",
            role="MEMBER",
            auth_method="LOCAL",
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
        email: str,
        username: str,
        role: Literal["ADMIN", "MEMBER"],
        auth_method: Literal["LOCAL", "OAUTH2"],
        password_needs_reset: bool = True,
        password: Optional[str] = None,
        oauth2_client_id: Optional[str] = None,
        oauth2_user_id: Optional[str] = None,
        send_welcome_email: bool = True,
    ) -> Union[v1.LocalUser, v1.OAuth2User]:
        """Create a new user.

        Args:
            email: The user's email address.
            username: The user's username.
            role: The user's role. Must be either "ADMIN" or "MEMBER".
            auth_method: The authentication method:
                - "LOCAL": User authenticates with username/password. Can have an optional password
                  set during creation. If no password is provided, user will need to set one on first login.
                - "OAUTH2": User authenticates through an OAuth2 provider. Must have either oauth2_client_id
                  or oauth2_user_id (or both). Cannot have a password.
            password_needs_reset: Whether the user needs to reset their password (LOCAL only).
                If True, user will be required to set a new password on first login.
            password: Optional password for LOCAL users. If not provided, user will need to set one
                on first login.
            oauth2_client_id: Optional OAuth2 client ID for OAUTH2 users. Must be provided if
                oauth2_user_id is not provided.
            oauth2_user_id: Optional OAuth2 user ID for OAUTH2 users. Must be provided if
                oauth2_client_id is not provided.
            send_welcome_email: Whether to send a welcome email to the new user.

        Returns:
            The newly created user.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if invalid parameter combinations are provided.
                For example:
                - Providing OAuth2 fields for LOCAL users
                - Providing password fields for OAUTH2 users
                - Not providing either oauth2_client_id or oauth2_user_id for OAUTH2 users

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            # Create a local user
            local_user = client.users.create(
                email="user@example.com",
                username="user",
                role="MEMBER",
                auth_method="LOCAL",
            )
            # Create an OAuth2 user
            oauth2_user = client.users.create(
                email="oauth2@example.com",
                username="oauth2user",
                role="ADMIN",
                auth_method="OAUTH2",
            )
            print(f"Created user with ID: {local_user['id']}")
            ```
        """  # noqa: E501
        user: Union[v1.LocalUserData, v1.OAuth2UserData]
        if auth_method == "LOCAL":
            if oauth2_client_id is not None or oauth2_user_id is not None:
                raise ValueError("OAuth2 fields should not be provided for LOCAL users")
            user = v1.LocalUserData(
                email=email,
                username=username,
                role=role,
                auth_method="LOCAL",
                password_needs_reset=password_needs_reset,
            )
            if password:
                user["password"] = password
        elif auth_method == "OAUTH2":
            if password is not None:
                raise ValueError("Password fields should not be provided for OAUTH2 users")
            user = v1.OAuth2UserData(
                email=email,
                username=username,
                role=role,
                auth_method="OAUTH2",
            )
            if oauth2_client_id:
                user["oauth2_client_id"] = oauth2_client_id
            if oauth2_user_id:
                user["oauth2_user_id"] = oauth2_user_id
        else:
            assert_never(auth_method)

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
            client.users.delete(user_id="UHJvamVjdDoy")
            ```
        """  # noqa: E501
        url = f"v1/users/{encode_path_param(user_id)}"
        response = self._client.delete(url)
        response.raise_for_status()


class AsyncUsers:
    """Asynchronous client for interacting with the Users API endpoints.

    This class provides asynchronous methods for creating, retrieving, and deleting users.

    Authentication Methods:
        - LOCAL: Users authenticate with a username and password. These users can have an optional
          password set during creation, and can be configured to require a password reset on first login.
        - OAUTH2: Users authenticate through an OAuth2 provider. These users must have either an
          OAuth2 client ID or user ID (or both) from their OAuth2 provider. They cannot have passwords.

    Example:
        ```python
        from phoenix.client import AsyncClient

        async_client = AsyncClient()
        # List all users
        users = await async_client.users.list()
        # Create a new user
        new_user = await async_client.users.create(
            email="user@example.com",
            username="user",
            role="MEMBER",
            auth_method="LOCAL",
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
        email: str,
        username: str,
        role: Literal["ADMIN", "MEMBER"],
        auth_method: Literal["LOCAL", "OAUTH2"],
        password_needs_reset: bool = True,
        password: Optional[str] = None,
        oauth2_client_id: Optional[str] = None,
        oauth2_user_id: Optional[str] = None,
        send_welcome_email: bool = True,
    ) -> Union[v1.LocalUser, v1.OAuth2User]:
        """Create a new user.

        Args:
            email: The user's email address.
            username: The user's username.
            role: The user's role. Must be either "ADMIN" or "MEMBER".
            auth_method: The authentication method:
                - "LOCAL": User authenticates with username/password. Can have an optional password
                  set during creation. If no password is provided, user will need to set one on first login.
                - "OAUTH2": User authenticates through an OAuth2 provider. Must have either oauth2_client_id
                  or oauth2_user_id (or both). Cannot have a password.
            password_needs_reset: Whether the user needs to reset their password (LOCAL only).
                If True, user will be required to set a new password on first login.
            password: Optional password for LOCAL users. If not provided, user will need to set one
                on first login.
            oauth2_client_id: Optional OAuth2 client ID for OAUTH2 users. Must be provided if
                oauth2_user_id is not provided.
            oauth2_user_id: Optional OAuth2 user ID for OAUTH2 users. Must be provided if
                oauth2_client_id is not provided.
            send_welcome_email: Whether to send a welcome email to the new user.

        Returns:
            The newly created user.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if invalid parameter combinations are provided.
                For example:
                - Providing OAuth2 fields for LOCAL users
                - Providing password fields for OAUTH2 users
                - Not providing either oauth2_client_id or oauth2_user_id for OAUTH2 users

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            # Create a local user
            local_user = await async_client.users.create(
                email="user@example.com",
                username="user",
                role="MEMBER",
                auth_method="LOCAL",
            )
            # Create an OAuth2 user
            oauth2_user = await async_client.users.create(
                email="oauth2@example.com",
                username="oauth2user",
                role="ADMIN",
                auth_method="OAUTH2",
            )
            print(f"Created user with ID: {local_user['id']}")
            ```
        """  # noqa: E501
        user: Union[v1.LocalUserData, v1.OAuth2UserData]
        if auth_method == "LOCAL":
            if oauth2_client_id is not None or oauth2_user_id is not None:
                raise ValueError("OAuth2 fields should not be provided for LOCAL users")
            user = v1.LocalUserData(
                email=email,
                username=username,
                role=role,
                auth_method="LOCAL",
                password_needs_reset=password_needs_reset,
            )
            if password:
                user["password"] = password
        elif auth_method == "OAUTH2":
            if password is not None:
                raise ValueError("Password fields should not be provided for OAUTH2 users")
            user = v1.OAuth2UserData(
                email=email,
                username=username,
                role=role,
                auth_method="OAUTH2",
            )
            if oauth2_client_id:
                user["oauth2_client_id"] = oauth2_client_id
            if oauth2_user_id:
                user["oauth2_user_id"] = oauth2_user_id
        else:
            assert_never(auth_method)

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
            await async_client.users.delete(user_id="UHJvamVjdDoy")
            ```
        """  # noqa: E501
        url = f"v1/users/{encode_path_param(user_id)}"
        response = await self._client.delete(url)
        response.raise_for_status()
