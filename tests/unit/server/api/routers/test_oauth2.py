from secrets import token_hex
from typing import Optional

import httpx
import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.api.routers.oauth2 import (
    SignInNotAllowed,
    UserInfo,
    _get_existing_oauth2_user,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.parametrize(
    "user,oauth2_client_id,user_info,allowed",
    [
        # User with password hash cannot sign in with OAuth2
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=b"password_hash",
                password_salt=b"password_salt",
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id=None,
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="user_with_password_hash",
        ),
        # User with matching OAuth2 credentials can sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_matching_oauth2_credentials",
        ),
        # User with different OAuth2 client ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="user_with_different_oauth2_client_id",
        ),
        # User with different OAuth2 user ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890987654321",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="user_with_different_oauth2_user_id",
        ),
        # User with placeholder OAuth2 client ID can sign in with any client ID
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="TBD_OAUTH2_CLIENT_ID_123456",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_placeholder_client_id",
        ),
        # User with placeholder OAuth2 user ID can sign in with any user ID
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="TBD_OAUTH2_USER_ID_123456",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_placeholder_user_id",
        ),
        # User with placeholder OAuth2 client ID but different user ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="TBD_OAUTH2_CLIENT_ID_123456",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890987654321",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="user_with_placeholder_client_id_and_different_user_id",
        ),
        # User with placeholder OAuth2 user ID but different client ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id="TBD_OAUTH2_USER_ID_123456",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="user_with_placeholder_user_id_and_different_client_id",
        ),
        # Non-existent user cannot sign in
        pytest.param(
            None,
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="non_existent_user",
        ),
    ],
)
async def test_get_existing_oauth2_user(
    httpx_client: httpx.AsyncClient,  # include this fixture to initialize the app
    db: DbSessionFactory,
    user: Optional[models.User],
    oauth2_client_id: str,
    user_info: UserInfo,
    allowed: bool,
) -> None:
    if user:
        async with db() as session:
            # For some strange reason PostgreSQL insists on UPDATE instead of
            # INSERT when using session.add(user), so we INSERT manually.
            await session.execute(
                insert(models.User).values(
                    email=user_info.email,
                    user_role_id=user.user_role_id,
                    username=user.username,
                    password_hash=user.password_hash,
                    password_salt=user.password_salt,
                    reset_password=user.reset_password,
                    oauth2_client_id=user.oauth2_client_id,
                    oauth2_user_id=user.oauth2_user_id,
                )
            )
    async with db() as session:
        if not user or not allowed:
            with pytest.raises(SignInNotAllowed):
                await _get_existing_oauth2_user(
                    session,
                    oauth2_client_id=oauth2_client_id,
                    user_info=user_info,
                )
            return
        db_user = await _get_existing_oauth2_user(
            session,
            oauth2_client_id=oauth2_client_id,
            user_info=user_info,
        )
    assert db_user
    assert db_user.oauth2_client_id == oauth2_client_id
    assert db_user.oauth2_user_id == user_info.idp_user_id

    # Check that the user in the database has matching credentials
    async with db() as session:
        db_user = await session.scalar(select(models.User).filter_by(email=user_info.email))
    assert db_user
    assert db_user.oauth2_client_id == oauth2_client_id
    assert db_user.oauth2_user_id == user_info.idp_user_id
