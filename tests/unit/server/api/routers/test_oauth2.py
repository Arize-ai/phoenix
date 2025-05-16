from secrets import token_hex
from typing import Optional

import pytest
from sqlalchemy import insert, select
from starlette.types import ASGIApp

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
        # User with password hash cannot sign in with OAuth2 (must use password auth)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=b"password_hash",
                password_salt=b"password_salt",
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id=None,
                auth_method="LOCAL",
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
        # User with matching OAuth2 credentials can sign in (direct OAuth2 lookup)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
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
        # User with different OAuth2 client ID can sign in (found by email,
        # credentials updated)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_different_oauth2_client_id",
        ),
        # User with different OAuth2 user ID cannot sign in (client IDs match,
        # user IDs must match)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
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
        # User with missing OAuth2 client ID can sign in (found by email,
        # credentials updated)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_missing_oauth2_client_id",
        ),
        # User with missing OAuth2 user ID cannot sign in (client IDs match,
        # user IDs required)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id=None,
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            False,
            id="user_with_missing_oauth2_user_id",
        ),
        # User with missing OAuth2 client ID but different user ID can sign in
        # (found by email, all credentials updated)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890987654321",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_missing_oauth2_client_id_and_different_user_id",
        ),
        # User with missing OAuth2 user ID but different client ID can sign in
        # (found by email, all credentials updated)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id=None,
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_with_missing_oauth2_user_id_and_different_client_id",
        ),
        # User found by email with no OAuth2 credentials can sign in
        # (credentials will be set)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id=None,
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_found_by_email_no_oauth2_credentials",
        ),
        # User found by email with matching OAuth2 credentials can sign in
        # (no updates needed)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_found_by_email_matching_oauth2_credentials",
        ),
        # User found by email with different OAuth2 credentials can sign in
        # (credentials will be updated)
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890987654321",
                auth_method="OAUTH2",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url=None,
            ),
            True,
            id="user_found_by_email_different_oauth2_credentials",
        ),
        # Non-existent user cannot sign in (no user found by OAuth2 or email)
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
    app: ASGIApp,
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
                    auth_method=user.auth_method,
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
        oauth2_user = await _get_existing_oauth2_user(
            session,
            oauth2_client_id=oauth2_client_id,
            user_info=user_info,
        )
    assert oauth2_user
    assert oauth2_user.oauth2_client_id == oauth2_client_id
    assert oauth2_user.oauth2_user_id == user_info.idp_user_id

    # Check that the user in the database has matching credentials
    async with db() as session:
        db_user = await session.scalar(select(models.User).filter_by(email=user_info.email))
    assert db_user
    assert db_user.oauth2_client_id == oauth2_client_id
    assert db_user.oauth2_user_id == user_info.idp_user_id
