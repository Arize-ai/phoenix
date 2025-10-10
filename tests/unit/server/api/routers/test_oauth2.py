from secrets import token_hex
from typing import Any, Optional

import pytest
from sqlalchemy import insert, select
from starlette.types import ASGIApp

from phoenix.db import models
from phoenix.server.api.routers.oauth2 import (
    InvalidUserInfo,
    MissingEmailScope,
    SignInNotAllowed,
    UserInfo,
    _get_existing_oauth2_user,
    _parse_user_info,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.parametrize(
    "user,oauth2_client_id,user_info,allowed",
    [
        # Test Case: User with password hash cannot sign in with OAuth2
        # Verifies that users who have set a password must use password authentication
        # and cannot switch to OAuth2 authentication.
        pytest.param(
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
            dict(
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
        # Test Case: User with removed profile picture can sign in
        # Verifies that users can have their profile picture URL removed (set to None)
        # when signing in with no profile picture URL provided.
        pytest.param(
            dict(
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
    user: Optional[dict[str, Any]],
    oauth2_client_id: str,
    user_info: UserInfo,
    allowed: bool,
) -> None:
    """Test the OAuth2 user sign-in and update process.

    This test verifies the behavior of _get_existing_oauth2_user function, which handles:
    1. OAuth2 user authentication
    2. User profile updates (profile picture)
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
                    user_role_id=user.get("user_role_id"),
                    username=user.get("username"),
                    password_hash=user.get("password_hash"),
                    password_salt=user.get("password_salt"),
                    reset_password=user.get("reset_password"),
                    oauth2_client_id=user.get("oauth2_client_id"),
                    oauth2_user_id=user.get("oauth2_user_id"),
                    auth_method=user.get("auth_method"),
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
    # Verify username remains unchanged
    assert db_user.username == user.get("username")


class TestParseUserInfo:
    """Test suite for _parse_user_info with real-world IDP examples."""

    def test_google_id_token(self) -> None:
        """Test parsing a typical Google ID token."""
        google_token = {
            "sub": "118234567890123456789",
            "email": "user@example.com",
            "email_verified": True,
            "name": "John Doe",
            "picture": "https://lh3.googleusercontent.com/a/default-user",
            "given_name": "John",
            "family_name": "Doe",
            "locale": "en",
            "iat": 1700000000,
            "exp": 1700003600,
        }

        result = _parse_user_info(google_token)

        assert result.idp_user_id == "118234567890123456789"
        assert result.email == "user@example.com"
        assert result.username == "John Doe"
        assert result.profile_picture_url == "https://lh3.googleusercontent.com/a/default-user"
        assert result.claims["email_verified"] is True
        assert result.claims["given_name"] == "John"

    def test_auth0_id_token(self) -> None:
        """Test parsing an Auth0 ID token with custom namespace claims."""
        auth0_token = {
            "sub": "auth0|507f1f77bcf86cd799439011",
            "email": "user@example.com",
            "email_verified": True,
            "name": "Jane Smith",
            "picture": "https://s.gravatar.com/avatar/example.png",
            "nickname": "jane",
            "https://myapp.com/groups": ["admin", "users"],
            "https://myapp.com/roles": ["editor"],
            "iss": "https://tenant.auth0.com/",
            "aud": "client_id_here",
        }

        result = _parse_user_info(auth0_token)

        assert result.idp_user_id == "auth0|507f1f77bcf86cd799439011"
        assert result.email == "user@example.com"
        assert result.username == "Jane Smith"
        assert result.claims["https://myapp.com/groups"] == ["admin", "users"]
        assert result.claims["nickname"] == "jane"

    def test_okta_id_token(self) -> None:
        """Test parsing an Okta ID token."""
        okta_token = {
            "sub": "00u1234567890abcdef",
            "email": "employee@company.com",
            "email_verified": True,
            "name": "Alice Johnson",
            "preferred_username": "alice.johnson@company.com",
            "given_name": "Alice",
            "family_name": "Johnson",
            "zoneinfo": "America/Los_Angeles",
            "locale": "en-US",
            "groups": ["Everyone", "Developers", "Engineering"],
        }

        result = _parse_user_info(okta_token)

        assert result.idp_user_id == "00u1234567890abcdef"
        assert result.email == "employee@company.com"
        assert result.username == "Alice Johnson"
        assert result.claims["groups"] == ["Everyone", "Developers", "Engineering"]
        assert result.claims["preferred_username"] == "alice.johnson@company.com"

    def test_azure_ad_id_token(self) -> None:
        """Test parsing a Microsoft Azure AD ID token."""
        azure_token = {
            "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
            "email": "user@contoso.com",
            "name": "Bob Williams",
            "oid": "00000000-0000-0000-66f3-3332eca7ea81",
            "preferred_username": "user@contoso.com",
            "tid": "9188040d-6c67-4c5b-b112-36a304b66dad",
            "unique_name": "user@contoso.com",
            "roles": ["Admin", "User"],
        }

        result = _parse_user_info(azure_token)

        assert result.idp_user_id == "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ"
        assert result.email == "user@contoso.com"
        assert result.username == "Bob Williams"
        assert result.claims["oid"] == "00000000-0000-0000-66f3-3332eca7ea81"
        assert result.claims["roles"] == ["Admin", "User"]

    def test_keycloak_id_token(self) -> None:
        """Test parsing a Keycloak ID token."""
        keycloak_token = {
            "sub": "f:1234abcd-56ef-78gh-90ij-klmnopqrstuv:john",
            "email": "john@keycloak.local",
            "email_verified": True,
            "name": "John Keycloak",
            "preferred_username": "john",
            "given_name": "John",
            "family_name": "Keycloak",
            "resource_access": {
                "phoenix": {"roles": ["admin", "developer"]},
                "account": {"roles": ["view-profile"]},
            },
            "realm_access": {"roles": ["offline_access", "uma_authorization"]},
        }

        result = _parse_user_info(keycloak_token)

        assert result.idp_user_id == "f:1234abcd-56ef-78gh-90ij-klmnopqrstuv:john"
        assert result.email == "john@keycloak.local"
        assert result.username == "John Keycloak"
        assert result.claims["resource_access"]["phoenix"]["roles"] == ["admin", "developer"]

    def test_aws_cognito_id_token(self) -> None:
        """Test parsing an AWS Cognito ID token."""
        cognito_token = {
            "sub": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "email": "user@cognito.local",
            "email_verified": True,
            "cognito:username": "user123",
            "cognito:groups": ["Administrators", "PowerUsers"],
            "given_name": "Cognito",
            "family_name": "User",
            "name": "Cognito User",
        }

        result = _parse_user_info(cognito_token)

        assert result.idp_user_id == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        assert result.email == "user@cognito.local"
        assert result.username == "Cognito User"
        assert result.claims["cognito:groups"] == ["Administrators", "PowerUsers"]

    def test_gitlab_id_token(self) -> None:
        """Test parsing a GitLab ID token."""
        gitlab_token = {
            "sub": "1234567",
            "email": "developer@gitlab.com",
            "email_verified": True,
            "name": "GitLab Developer",
            "nickname": "gitdev",
            "picture": "https://gitlab.com/uploads/-/system/user/avatar/1234567/avatar.png",
            "groups_direct": ["engineering/platform", "engineering/backend"],
        }

        result = _parse_user_info(gitlab_token)

        assert result.idp_user_id == "1234567"
        assert result.email == "developer@gitlab.com"
        assert result.username == "GitLab Developer"
        assert result.claims["groups_direct"] == ["engineering/platform", "engineering/backend"]

    def test_integer_sub_claim(self) -> None:
        """Test that integer sub claims are converted to strings (pragmatic compatibility)."""
        token_with_int_sub = {
            "sub": 123456789,  # Some IDPs might send this as an integer
            "email": "user@example.com",
            "name": "Test User",
        }

        result = _parse_user_info(token_with_int_sub)

        assert result.idp_user_id == "123456789"
        assert isinstance(result.idp_user_id, str)

    def test_minimal_valid_token(self) -> None:
        """Test parsing a minimal valid token (only required fields)."""
        minimal_token = {
            "sub": "minimal-user-id",
            "email": "minimal@example.com",
        }

        result = _parse_user_info(minimal_token)

        assert result.idp_user_id == "minimal-user-id"
        assert result.email == "minimal@example.com"
        assert result.username is None
        assert result.profile_picture_url is None

    def test_missing_sub_claim(self) -> None:
        """Test that missing sub claim raises InvalidUserInfo."""
        token_without_sub = {
            "email": "user@example.com",
            "name": "Test User",
        }

        with pytest.raises(InvalidUserInfo, match="Missing required 'sub' claim"):
            _parse_user_info(token_without_sub)

    def test_none_sub_claim(self) -> None:
        """Test that None sub claim raises InvalidUserInfo."""
        token_with_none_sub = {
            "sub": None,
            "email": "user@example.com",
        }

        with pytest.raises(InvalidUserInfo, match="Missing required 'sub' claim"):
            _parse_user_info(token_with_none_sub)

    def test_empty_sub_claim(self) -> None:
        """Test that empty/whitespace sub claim raises InvalidUserInfo."""
        token_with_empty_sub = {
            "sub": "   ",
            "email": "user@example.com",
        }

        with pytest.raises(InvalidUserInfo, match="'sub' claim cannot be empty"):
            _parse_user_info(token_with_empty_sub)

    def test_invalid_sub_type(self) -> None:
        """Test that invalid sub claim type raises InvalidUserInfo."""
        token_with_dict_sub = {
            "sub": {"id": "12345"},  # Invalid: should be string or int
            "email": "user@example.com",
        }

        with pytest.raises(InvalidUserInfo, match="Invalid 'sub' claim type"):
            _parse_user_info(token_with_dict_sub)

    def test_missing_email(self) -> None:
        """Test that missing email raises MissingEmailScope."""
        token_without_email = {
            "sub": "user-123",
            "name": "Test User",
        }

        with pytest.raises(MissingEmailScope, match="Missing or invalid 'email' claim"):
            _parse_user_info(token_without_email)

    def test_none_email(self) -> None:
        """Test that None email raises MissingEmailScope."""
        token_with_none_email = {
            "sub": "user-123",
            "email": None,
        }

        with pytest.raises(MissingEmailScope, match="Missing or invalid 'email' claim"):
            _parse_user_info(token_with_none_email)

    def test_empty_email(self) -> None:
        """Test that empty/whitespace email raises MissingEmailScope."""
        token_with_empty_email = {
            "sub": "user-123",
            "email": "   ",
        }

        with pytest.raises(MissingEmailScope, match="Missing or invalid 'email' claim"):
            _parse_user_info(token_with_empty_email)

    def test_invalid_email_type(self) -> None:
        """Test that non-string email raises MissingEmailScope."""
        token_with_int_email = {
            "sub": "user-123",
            "email": 12345,
        }

        with pytest.raises(MissingEmailScope, match="Missing or invalid 'email' claim"):
            _parse_user_info(token_with_int_email)

    def test_non_string_name_gracefully_ignored(self) -> None:
        """Test that non-string name values are gracefully ignored."""
        token_with_int_name = {
            "sub": "user-123",
            "email": "user@example.com",
            "name": 12345,  # Invalid type
        }

        result = _parse_user_info(token_with_int_name)

        assert result.username is None  # Should be ignored, not crash

    def test_non_string_picture_gracefully_ignored(self) -> None:
        """Test that non-string picture values are gracefully ignored."""
        token_with_dict_picture = {
            "sub": "user-123",
            "email": "user@example.com",
            "picture": {"url": "https://example.com"},  # Invalid type
        }

        result = _parse_user_info(token_with_dict_picture)

        assert result.profile_picture_url is None  # Should be ignored, not crash

    def test_claims_filtering_removes_empty_values(self) -> None:
        """Test that empty/None values are filtered from claims."""
        token_with_empty_values: dict[str, Any] = {
            "sub": "user-123",
            "email": "user@example.com",
            "name": "Test User",
            "empty_string": "",
            "whitespace_string": "   ",
            "none_value": None,
            "empty_list": [],
            "empty_dict": {},
            "valid_number": 42,
            "valid_bool": True,
            "valid_list": ["item"],
        }

        result = _parse_user_info(token_with_empty_values)

        # Empty values should be filtered out
        assert "empty_string" not in result.claims
        assert "whitespace_string" not in result.claims
        assert "none_value" not in result.claims
        assert "empty_list" not in result.claims
        assert "empty_dict" not in result.claims

        # Valid values should be preserved
        assert result.claims["valid_number"] == 42
        assert result.claims["valid_bool"] is True
        assert result.claims["valid_list"] == ["item"]

    def test_complex_nested_claims_preserved(self) -> None:
        """Test that complex nested structures in claims are preserved."""
        token_with_nested = {
            "sub": "user-123",
            "email": "user@example.com",
            "roles": {
                "organization": {
                    "teams": [
                        {"name": "engineering", "role": "member"},
                        {"name": "platform", "role": "admin"},
                    ]
                }
            },
        }

        result = _parse_user_info(token_with_nested)

        assert "roles" in result.claims
        assert result.claims["roles"]["organization"]["teams"][0]["name"] == "engineering"

    def test_whitespace_handling_in_sub(self) -> None:
        """Test that leading/trailing whitespace in sub is trimmed."""
        token_with_whitespace_sub = {
            "sub": "  user-123  ",
            "email": "user@example.com",
        }

        result = _parse_user_info(token_with_whitespace_sub)

        assert result.idp_user_id == "user-123"  # Whitespace trimmed

    def test_unicode_and_special_characters(self) -> None:
        """Test handling of Unicode and special characters in claims."""
        token_with_unicode = {
            "sub": "user-123",
            "email": "用户@example.com",
            "name": "José García-Müller",
            "locale": "zh-CN",
        }

        result = _parse_user_info(token_with_unicode)

        assert result.email == "用户@example.com"
        assert result.username == "José García-Müller"
        assert result.claims["locale"] == "zh-CN"

    def test_special_characters_in_claim_keys(self) -> None:
        """
        Test that claims with special characters in keys are preserved.

        These require quoted identifiers in JMESPath (e.g., "cognito:groups").
        """
        token_with_special_keys = {
            "sub": "user-123",
            "email": "user@example.com",
            # Auth0 style - URL namespace
            "https://myapp.com/groups": ["admin", "users"],
            # AWS Cognito style - colon separator
            "cognito:groups": ["Administrators"],
            # Keycloak style - nested with special chars
            "resource_access": {"my-app": {"roles": ["developer"]}},
        }

        result = _parse_user_info(token_with_special_keys)

        # Verify special character keys are preserved in claims
        assert result.claims["https://myapp.com/groups"] == ["admin", "users"]
        assert result.claims["cognito:groups"] == ["Administrators"]
        assert result.claims["resource_access"]["my-app"]["roles"] == ["developer"]
