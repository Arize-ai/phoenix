from secrets import token_hex
from typing import Any, Optional, cast

import pytest
from sqlalchemy import insert, select
from starlette.types import ASGIApp

from phoenix.config import OAuth2UserRoleName
from phoenix.db import models
from phoenix.server.api.routers.oauth2 import (
    InvalidUserInfo,
    MissingEmailScope,
    SignInNotAllowed,
    UserInfo,
    _parse_user_info,
    _sign_in_existing_oauth2_user,
)
from phoenix.server.types import DbSessionFactory


class TestSignInExistingOAuth2User:
    """Comprehensive test for _sign_in_existing_oauth2_user covering all authentication scenarios."""

    @pytest.fixture(autouse=True)
    async def _setup_role_ids(self, asgi_app: ASGIApp, db: DbSessionFactory) -> None:
        """Query role IDs upfront to avoid hardcoding numeric values."""
        async with db() as session:
            result = await session.execute(select(models.UserRole.name, models.UserRole.id))
            self.role_ids = {name: id_ for name, id_ in result.all()}

    async def test_all_scenarios(self, asgi_app: ASGIApp, db: DbSessionFactory) -> None:
        """Single comprehensive test covering all sign-in scenarios."""
        client_id = "123456789012-abcdef.apps.googleusercontent.com"
        role_ids = self.role_ids

        async def create_user(email: str, uid: Optional[str], role: str, **kw: Any) -> None:
            async with db() as session:
                is_local = kw.get("auth_method") == "LOCAL"
                await session.execute(
                    insert(models.User).values(
                        email=email,
                        user_role_id=role_ids[role],
                        username=kw.get("username", token_hex(8)),
                        reset_password=False,
                        auth_method=kw.get("auth_method", "OAUTH2"),
                        oauth2_client_id=None if is_local else kw.get("cid"),
                        oauth2_user_id=None if is_local else uid,
                        password_hash=kw.get("pw_hash"),
                        password_salt=kw.get("pw_salt"),
                        profile_picture_url=kw.get("pic"),
                    )
                )

        async def sign_in(
            email: str, uid: str, role: Optional[OAuth2UserRoleName], pic: Optional[str] = None
        ) -> models.User:
            async with db() as session:
                return await _sign_in_existing_oauth2_user(
                    session,
                    oauth2_client_id=client_id,
                    user_info=UserInfo(
                        idp_user_id=uid, email=email, username=None, profile_picture_url=pic
                    ),
                    role_name=role,
                )

        # Test 1: LOCAL user cannot sign in with OAuth2
        e1 = f"{token_hex(8)}@example.com"
        await create_user(e1, "uid1", "VIEWER", auth_method="LOCAL", pw_hash=b"h", pw_salt=b"s")
        async with db() as session:
            with pytest.raises(SignInNotAllowed):
                await _sign_in_existing_oauth2_user(
                    session,
                    oauth2_client_id=client_id,
                    user_info=UserInfo(
                        idp_user_id="uid1", email=e1, username=None, profile_picture_url=None
                    ),
                    role_name="VIEWER",
                )

        # Test 2: Non-existent user
        async with db() as session:
            with pytest.raises(SignInNotAllowed):
                await _sign_in_existing_oauth2_user(
                    session,
                    oauth2_client_id=client_id,
                    user_info=UserInfo(
                        idp_user_id="uid_new",
                        email=f"{token_hex(8)}@example.com",
                        username=None,
                        profile_picture_url=None,
                    ),
                    role_name="VIEWER",
                )

        # Test 3: Mismatched OAuth2 user ID
        e2 = f"{token_hex(8)}@example.com"
        await create_user(e2, "uid2", "VIEWER", cid=client_id)
        async with db() as session:
            with pytest.raises(SignInNotAllowed):
                await _sign_in_existing_oauth2_user(
                    session,
                    oauth2_client_id=client_id,
                    user_info=UserInfo(
                        idp_user_id="uid_wrong", email=e2, username=None, profile_picture_url=None
                    ),
                    role_name="VIEWER",
                )

        # Test 4-8: OAuth2 credential updates (each with unique user)
        for uid_suffix in range(5):
            e = f"{token_hex(8)}@example.com"
            uid = f"uid3_{uid_suffix}"
            await create_user(e, uid, "VIEWER", cid=client_id)
            u = await sign_in(e, uid, "VIEWER")
            assert (
                u.role.name == "VIEWER"
                and u.oauth2_client_id == client_id
                and u.oauth2_user_id == uid
            )

        # Test 9: Profile picture update
        e3 = f"{token_hex(8)}@example.com"
        await create_user(e3, "uid4", "VIEWER", cid=client_id, pic="old.jpg")
        u = await sign_in(e3, "uid4", "VIEWER", "new.jpg")
        assert u.role.name == "VIEWER"

        # Test 10-13: Role updates when mapping configured
        for idx, (initial, target) in enumerate(
            [("VIEWER", "ADMIN"), ("ADMIN", "VIEWER"), ("MEMBER", "ADMIN"), ("VIEWER", "VIEWER")]
        ):
            e = f"{token_hex(8)}@example.com"
            uid = f"uid5_{idx}"
            await create_user(e, uid, initial, cid=client_id)
            u = await sign_in(e, uid, cast(OAuth2UserRoleName, target))
            assert u.role.name == target

        # Test 14-16: CRITICAL backward compatibility - role preservation
        for idx, role in enumerate(["ADMIN", "MEMBER", "VIEWER"]):
            e = f"{token_hex(8)}@example.com"
            uid = f"uid6_{idx}"
            await create_user(e, uid, role, cid=client_id)
            u = await sign_in(e, uid, None)  # None = role mapping NOT configured
            assert u.role.name == role

        # Test 17: Combined role + picture update
        e4 = f"{token_hex(8)}@example.com"
        await create_user(e4, "uid7", "MEMBER", cid=client_id, pic="old.jpg")
        u = await sign_in(e4, "uid7", "ADMIN", "new.jpg")
        assert u.role.name == "ADMIN"


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
