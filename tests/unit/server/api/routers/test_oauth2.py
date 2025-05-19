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
        # Test Case: User with password hash cannot sign in with OAuth2
        # Verifies that users who have set a password must use password authentication
        # and cannot switch to OAuth2 authentication.
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
        # Test Case: User with matching OAuth2 credentials can sign in
        # Verifies that users with matching OAuth2 credentials can successfully sign in
        # without any credential updates needed.
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
        # Test Case: User with different OAuth2 client ID can sign in
        # Verifies that users found by email can have their OAuth2 client ID updated
        # when signing in with a different client ID.
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
        # Test Case: User with different OAuth2 user ID cannot sign in
        # Verifies that users cannot sign in when their OAuth2 user ID doesn't match,
        # even if the client ID matches.
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
        # Test Case: User with missing OAuth2 client ID can sign in
        # Verifies that users found by email can have their OAuth2 client ID set
        # when signing in for the first time with OAuth2.
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
        # Test Case: User with missing OAuth2 user ID can sign in
        # Verifies that users can sign in when their OAuth2 user ID is missing,
        # if the client ID matches.
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
            True,
            id="user_with_missing_oauth2_user_id",
        ),
        # Test Case: User with missing OAuth2 client ID but different user ID can sign in
        # Verifies that users found by email can have both their OAuth2 client ID and user ID
        # updated when signing in for the first time with OAuth2.
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
        # Test Case: User with missing OAuth2 user ID but different client ID can sign in
        # Verifies that users found by email can have both their OAuth2 client ID and user ID
        # updated when signing in with different credentials.
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
        # Test Case: User found by email with no OAuth2 credentials can sign in
        # Verifies that users found by email can have their OAuth2 credentials set
        # when signing in for the first time with OAuth2.
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
        # Test Case: User found by email with matching OAuth2 credentials can sign in
        # Verifies that users found by email with matching OAuth2 credentials
        # can sign in without any credential updates.
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
        # Test Case: User found by email with different OAuth2 credentials can sign in
        # Verifies that users found by email can have their OAuth2 credentials updated
        # when signing in with different credentials.
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
        # Test Case: User with updated profile picture can sign in
        # Verifies that users can have their profile picture URL updated
        # when signing in with a new URL.
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
                profile_picture_url="https://old-picture.com/avatar.jpg",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url="https://new-picture.com/avatar.jpg",
            ),
            True,
            id="user_with_updated_profile_picture",
        ),
        # Test Case: User with changed OAuth2 client ID and profile picture can sign in
        # Verifies that users can have both their OAuth2 client ID and profile picture
        # updated simultaneously when signing in.
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
                profile_picture_url="https://old-picture.com/avatar.jpg",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url="https://new-picture.com/avatar.jpg",
            ),
            True,
            id="user_with_changed_client_id_and_profile_picture",
        ),
        # Test Case: User with updated username can sign in
        # Verifies that users can have their username updated
        # when signing in with a new username.
        pytest.param(
            models.User(
                user_role_id=1,
                username=f"old_username{token_hex(8)}",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
                profile_picture_url="https://example.com/avatar.jpg",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=f"new_username{token_hex(8)}",
                profile_picture_url="https://example.com/avatar.jpg",
            ),
            True,
            id="user_with_updated_username",
        ),
        # Test Case: User with removed username can sign in
        # Verifies that users cannot have their username removed (set to None)
        # when signing in with no username provided.
        pytest.param(
            models.User(
                user_role_id=1,
                username=f"old_username{token_hex(8)}",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
                profile_picture_url="https://example.com/avatar.jpg",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=None,
                profile_picture_url="https://example.com/avatar.jpg",
            ),
            True,
            id="user_with_removed_username",
        ),
        # Test Case: User with removed profile picture can sign in
        # Verifies that users can have their profile picture URL removed (set to None)
        # when signing in with no profile picture URL provided.
        pytest.param(
            models.User(
                user_role_id=1,
                username=f"test_username{token_hex(8)}",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
                auth_method="OAUTH2",
                profile_picture_url="https://example.com/avatar.jpg",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            UserInfo(
                idp_user_id="118234567890123456789",
                email=f"{token_hex(8)}@example.com",
                username=f"test_username{token_hex(8)}",
                profile_picture_url=None,
            ),
            True,
            id="user_with_removed_profile_picture",
        ),
        # Test Case: Non-existent user cannot sign in
        # Verifies that sign-in is rejected when no user is found
        # by either OAuth2 credentials or email.
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
    """Test the OAuth2 user sign-in and update process.

    This test verifies the behavior of _get_existing_oauth2_user function, which handles:
    1. OAuth2 user authentication
    2. User profile updates (username, profile picture)
    3. OAuth2 credential updates (client_id, user_id)
    4. Error cases and rejections

    The test covers various scenarios:
    - Users with/without passwords
    - Users with matching/different OAuth2 credentials
    - Users found by OAuth2 credentials or email
    - Profile information updates
    - Error conditions

    Args:
        app: The FastAPI application instance
        db: Database session factory
        user: Optional existing user in the database
        oauth2_client_id: OAuth2 client ID to use for sign-in
        user_info: User information from the OAuth2 provider
        allowed: Whether the sign-in should be allowed
    """
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
    # Verify the returned user object has the correct OAuth2 credentials
    assert oauth2_user
    assert oauth2_user.oauth2_client_id == oauth2_client_id
    assert oauth2_user.oauth2_user_id == user_info.idp_user_id

    # Verify the database state after the update
    async with db() as session:
        db_user = await session.scalar(select(models.User).filter_by(email=user_info.email))
    assert db_user
    # Verify OAuth2 credentials are correctly updated
    assert db_user.oauth2_client_id == oauth2_client_id
    assert db_user.oauth2_user_id == user_info.idp_user_id
    # Verify profile picture URL is updated if provided in user_info
    if user_info.profile_picture_url is not None:
        assert db_user.profile_picture_url == user_info.profile_picture_url
    # Verify username is updated if provided in user_info, otherwise remains unchanged
    if user_info.username is not None:
        assert db_user.username == user_info.username
    elif user is not None:  # If user_info.username is None, username should remain unchanged
        assert user.username
