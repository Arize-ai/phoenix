from secrets import token_hex

import pytest

from phoenix.db import models
from phoenix.server.api.routers.oauth2 import _cannot_sign_in


@pytest.mark.parametrize(
    "user,oauth2_client_id,oauth2_user_id,expected",
    [
        # User with password hash cannot sign in with OAuth2
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=b"password_hash",
                password_salt=b"password_salt",
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id=None,
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            True,
            id="user_with_password_hash",
        ),
        # User with matching OAuth2 credentials can sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            False,
            id="user_with_matching_oauth2_credentials",
        ),
        # User with None OAuth2 credentials cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id=None,
                oauth2_user_id=None,
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            True,
            id="user_with_none_oauth2_credentials",
        ),
        # User with different OAuth2 client ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            True,
            id="user_with_different_oauth2_client_id",
        ),
        # User with different OAuth2 user ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890987654321",
            True,
            id="user_with_different_oauth2_user_id",
        ),
        # User with placeholder OAuth2 client ID can sign in with any client ID
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="TBD_OAUTH2_CLIENT_ID_123456",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            False,
            id="user_with_placeholder_client_id",
        ),
        # User with placeholder OAuth2 user ID can sign in with any user ID
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="123456789012-abcdef.apps.googleusercontent.com",
                oauth2_user_id="TBD_OAUTH2_USER_ID_123456",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            False,
            id="user_with_placeholder_user_id",
        ),
        # User with placeholder OAuth2 client ID but different user ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="TBD_OAUTH2_CLIENT_ID_123456",
                oauth2_user_id="118234567890123456789",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890987654321",
            True,
            id="user_with_placeholder_client_id_and_different_user_id",
        ),
        # User with placeholder OAuth2 user ID but different client ID cannot sign in
        pytest.param(
            models.User(
                user_role_id=1,
                username=token_hex(8),
                email=f"{token_hex(8)}@example.com",
                password_hash=None,
                password_salt=None,
                reset_password=False,
                oauth2_client_id="987654321098-xyzdef.apps.googleusercontent.com",
                oauth2_user_id="TBD_OAUTH2_USER_ID_123456",
            ),
            "123456789012-abcdef.apps.googleusercontent.com",
            "118234567890123456789",
            True,
            id="user_with_placeholder_user_id_and_different_client_id",
        ),
    ],
)
async def test_cannot_sign_in(
    user: models.User,
    oauth2_client_id: str,
    oauth2_user_id: str,
    expected: bool,
) -> None:
    """Test the _cannot_sign_in function with various user configurations.

    Args:
        user: The user object to test with
        oauth2_client_id: The OAuth2 client ID to check against
        oauth2_user_id: The OAuth2 user ID to check against
        expected: The expected result of the _cannot_sign_in function
    """
    actual = _cannot_sign_in(user, oauth2_client_id, oauth2_user_id)
    assert actual == expected
