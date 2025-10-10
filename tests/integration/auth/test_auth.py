from __future__ import annotations

import string
from collections import defaultdict
from collections.abc import Iterator, Sequence
from contextlib import AbstractContextManager
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from functools import partial
from random import choice
from secrets import token_hex
from typing import (
    Any,
    Generic,
    Optional,
    TypeVar,
)
from urllib.error import URLError
from urllib.request import urlopen

import bs4
import jwt
import pytest
import smtpdfix
from httpx import HTTPStatusError
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExportResult
from strawberry.relay import GlobalID

from phoenix.auth import sanitize_email
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from .._helpers import (
    _ADMIN,
    _DEFAULT_ADMIN,
    _DENIED,
    _EXPECTATION_401,
    _EXPECTATION_404,
    _MEMBER,
    _OK,
    _OK_OR_DENIED,
    _SYSTEM_USER_GID,
    _VIEWER,
    _AccessToken,
    _AdminSecret,
    _ApiKey,
    _AppInfo,
    _create_api_key,
    _create_user,
    _delete_users,
    _Email,
    _ExistingSpan,
    _Expectation,
    _export_embeddings,
    _extract_html,
    _GetUser,
    _GqlId,
    _Headers,
    _httpx_client,
    _initiate_password_reset,
    _log_in,
    _log_out,
    _LoggedInUser,
    _OIDCServer,
    _Password,
    _patch_user,
    _patch_viewer,
    _Profile,
    _randomize_casing,
    _RefreshToken,
    _RoleOrUser,
    _SpanExporterFactory,
    _Username,
    _will_be_asked_to_reset_password,
)

NOW = datetime.now(timezone.utc)
_decode_jwt = partial(jwt.decode, options=dict(verify_signature=False))
_TokenT = TypeVar("_TokenT", _AccessToken, _RefreshToken)


class TestOIDC:
    """Tests for OpenID Connect (OIDC) authentication flow.

    This class tests the OIDC sign-in and sign-up processes, including:
    - User authentication via OIDC
    - New user creation during OIDC sign-in
    - Token generation and validation
    - Handling of conflicts with existing users
    - Configuration options like allow_sign_up
    - Error handling for invalid credentials
    """

    @pytest.mark.parametrize("allow_sign_up", [True, False])
    async def test_sign_in(
        self,
        allow_sign_up: bool,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test the complete OIDC sign-in flow with different allow_sign_up settings.

        This test verifies:
        1. The OAuth2 flow redirects correctly to the OIDC provider
        2. When allow_sign_up is True:
           - A new user is created with MEMBER role
           - Access and refresh tokens are generated
           - Subsequent OIDC flows generate new tokens for the same user
        3. When allow_sign_up is False:
           - Users are redirected to login with an error message
           - No access tokens are granted
           - If a user without a password exists, they can still sign in
        """
        client = _httpx_client(_app)
        url = (
            f"oauth2/{_oidc_server}/login"
            if allow_sign_up
            else f"oauth2/{_oidc_server}_no_sign_up/login"
        )

        # Start the OAuth2 flow
        response = client.post(url)
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify required OAuth2 cookies are set (non-PKCE: state and nonce only)
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" not in cookies  # PKCE not enabled

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert _oidc_server.user_email, "Fixture should have initialized a (random) user"
        assert (email := sanitize_email(_oidc_server.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users

        # Complete the flow by calling the token endpoint
        response = client.get(callback_url)

        if not allow_sign_up:
            # Verify that user is redirected to /login
            assert response.status_code == 307
            assert "/login" in response.headers["location"]

            # Verify no access is granted
            assert not response.cookies.get("phoenix-access-token")
            assert not response.cookies.get("phoenix-refresh-token")

            # Verify sensitive cookies are cleaned up even on error
            set_cookie_headers = response.headers.get_list("set-cookie")
            assert any(
                "phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers
            )
            assert any(
                "phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers
            )

            # Create the user without password
            # Casing should not matter
            case_insensitive_email = _randomize_casing(email)
            admin.create_user(
                _app, profile=_Profile(case_insensitive_email, "", token_hex(8)), local=False
            )

            # If user go through OIDC flow again, access should be granted
            response = _httpx_client(_app, cookies=cookies).get(callback_url)

            # Verify that user is redirected not to /login
            assert response.status_code == 302
            assert "/login" not in response.headers["location"]

            # Verify we got access
            assert (access_token := response.cookies.get("phoenix-access-token"))
            assert (refresh_token := response.cookies.get("phoenix-refresh-token"))

            # Verify that the user was created
            users = {u.profile.email: u for u in admin.list_users(_app)}
            assert email in users
            assert users[email].role is UserRoleInput.MEMBER

            # If user go through OIDC flow again, new access token should be created
            response = _httpx_client(_app, cookies=cookies).get(callback_url)
            assert (new_access_token := response.cookies.get("phoenix-access-token"))
            assert (new_refresh_token := response.cookies.get("phoenix-refresh-token"))
            assert new_access_token != access_token
            assert new_refresh_token != refresh_token
            return

        # Verify we got access
        assert response.status_code == 302
        assert (access_token := response.cookies.get("phoenix-access-token"))
        assert (refresh_token := response.cookies.get("phoenix-refresh-token"))

        # Verify sensitive cookies are cleaned up after successful authentication
        set_cookie_headers = response.headers.get_list("set-cookie")
        assert any("phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any("phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers)

        # Verify that the user was created
        users = {u.profile.email: u for u in admin.list_users(_app)}
        assert email in users
        assert users[email].role is UserRoleInput.MEMBER

        # If user go through OIDC flow again, new access token should be created
        response = _httpx_client(_app, cookies=cookies).get(callback_url)
        assert (new_access_token := response.cookies.get("phoenix-access-token"))
        assert (new_refresh_token := response.cookies.get("phoenix-refresh-token"))
        assert new_access_token != access_token
        assert new_refresh_token != refresh_token

    @pytest.mark.parametrize("allow_sign_up", [True, False])
    async def test_sign_in_conflict_for_local_user_with_password(
        self,
        allow_sign_up: bool,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test OIDC sign-in when a user with the same email already exists with password authentication.

        This test verifies:
        1. The system detects the email conflict with an existing user
        2. The user is redirected to the login page with an appropriate error message
        3. No access tokens are granted to the OIDC user
        4. The existing user's credentials remain unchanged
        5. This behavior is consistent regardless of the allow_sign_up setting
        """
        client = _httpx_client(_app)
        url = (
            f"oauth2/{_oidc_server}/login"
            if allow_sign_up
            else f"oauth2/{_oidc_server}_no_sign_up/login"
        )

        # Start the OAuth2 flow
        response = client.post(url)
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify required OAuth2 cookies are set (non-PKCE: state and nonce only)
        assert "phoenix-oauth2-state" in response.cookies
        assert "phoenix-oauth2-nonce" in response.cookies
        assert "phoenix-oauth2-code-verifier" not in response.cookies  # PKCE not enabled

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert (email := _oidc_server.user_email)
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {u.profile.email: u for u in admin.list_users(_app)}
        assert email not in users

        # Create the user with password
        admin.create_user(_app, profile=_Profile(email, token_hex(8), token_hex(8)))

        # Verify that user is redirected to /login
        response = client.get(callback_url)
        assert response.status_code == 307
        assert "/login" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

        # Verify sensitive cookies are cleaned up after conflict error
        set_cookie_headers = response.headers.get_list("set-cookie")
        assert any("phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any("phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers)

    async def test_state_mismatch_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that state parameter mismatch is rejected (CSRF protection).

        This test verifies that an attacker cannot intercept the authorization code
        and use it with a different state value. The state parameter binds the
        authorization request to the token request, preventing CSRF attacks.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 flow
        response = client.post(f"oauth2/{_oidc_server}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]
        cookies = dict(response.cookies)

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Tamper with the state parameter in the callback URL
        from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

        parsed = urlparse(callback_url)
        query_params = parse_qs(parsed.query)
        query_params["state"] = ["tampered_state_value"]
        tampered_url = urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                urlencode(query_params, doseq=True),
                parsed.fragment,
            )
        )

        # Try to complete the flow with tampered state
        response = _httpx_client(_app, cookies=cookies).get(tampered_url)

        # Verify that user is redirected to login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]
        assert "error=" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

    async def test_missing_state_cookie_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that missing state cookie causes proper error handling.

        This verifies that if a user's cookies are deleted or expire before
        completing the OAuth2 flow, the system handles it gracefully.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 flow
        response = client.post(f"oauth2/{_oidc_server}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Try to complete the flow WITHOUT cookies (simulating deleted cookies)
        response = _httpx_client(_app).get(callback_url)

        # Verify proper error handling (422 Unprocessable Entity for missing cookie)
        assert response.status_code == 422

    async def test_unsafe_return_url_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that absolute URLs in returnUrl parameter are rejected (open redirect protection).

        This test verifies protection against open redirect attacks where an attacker
        could trick users into authenticating and then redirect them to a malicious site.
        """
        client = _httpx_client(_app)

        # Try to start OAuth2 flow with an absolute URL (potential open redirect)
        response = client.post(
            f"oauth2/{_oidc_server}/login",
            params={"returnUrl": "https://evil.com/phishing"},
        )
        assert response.status_code == 302
        auth_url = response.headers["location"]
        cookies = dict(response.cookies)

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Complete the flow
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify that user is redirected to login with error about unsafe URL
        assert response.status_code == 307
        assert "/login" in response.headers["location"]
        assert "unsafe" in response.headers["location"].lower()

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

    async def test_unknown_idp_is_rejected(
        self,
        _app: _AppInfo,
    ) -> None:
        """Test that requests to unknown identity providers are rejected.

        This verifies that the system validates the IDP name and returns
        a proper redirect to the login page with an error code.
        """
        client = _httpx_client(_app)

        # Try to start OAuth2 flow with unknown IDP
        response = client.post("oauth2/non_existent_idp/login")

        # Should redirect to /login with error code
        assert response.status_code == 307
        assert "/login" in response.headers["location"]
        assert "error=unknown_idp" in response.headers["location"]

    async def test_cookie_security_attributes(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that OAuth2 cookies have proper security attributes.

        This verifies that cookies are set with HttpOnly, SameSite, and appropriate
        Max-Age values to protect against XSS and CSRF attacks.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 flow
        response = client.post(f"oauth2/{_oidc_server}/login")
        assert response.status_code == 302

        # Verify cookie security attributes
        set_cookie_headers = response.headers.get_list("set-cookie")

        # Check state cookie
        state_cookie = next((h for h in set_cookie_headers if "phoenix-oauth2-state=" in h), None)
        assert state_cookie is not None
        assert "HttpOnly" in state_cookie
        assert "SameSite=lax" in state_cookie or "SameSite=Lax" in state_cookie
        assert "Max-Age=900" in state_cookie  # 15 minutes

        # Check nonce cookie
        nonce_cookie = next((h for h in set_cookie_headers if "phoenix-oauth2-nonce=" in h), None)
        assert nonce_cookie is not None
        assert "HttpOnly" in nonce_cookie
        assert "SameSite=lax" in nonce_cookie or "SameSite=Lax" in nonce_cookie
        assert "Max-Age=900" in nonce_cookie

    async def test_oidc_with_groups_access_granted(
        self,
        _oidc_server_standard_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test standard OIDC with group-based access control - user HAS matching group.

        This test verifies:
        1. OIDC server returns groups claim ["engineering", "operations"]
        2. Phoenix extracts groups using JMESPath (groups)
        3. Phoenix checks against ALLOWED_GROUPS ("engineering,admin")
        4. User has "engineering" → access GRANTED
        """
        client = _httpx_client(_app)

        # Start the OAuth2 OIDC flow with groups
        response = client.post(f"oauth2/{_oidc_server_standard_with_groups}_granted/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify OAuth2 state and nonce cookies are set (no code_verifier for standard OIDC)
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" not in cookies  # OIDC doesn't use PKCE

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert _oidc_server_standard_with_groups.user_email, (
            "Fixture should have initialized a (random) user"
        )
        assert (email := sanitize_email(_oidc_server_standard_with_groups.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users

        # Complete the flow by calling the token endpoint
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify we got access tokens (user has matching group)
        assert response.status_code == 302
        assert response.cookies.get("phoenix-access-token")
        assert response.cookies.get("phoenix-refresh-token")

        # Verify that the user was created
        users = {u.profile.email: u for u in admin.list_users(_app)}
        assert email in users
        assert users[email].role is UserRoleInput.MEMBER

    async def test_oidc_with_groups_access_denied(
        self,
        _oidc_server_standard_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test standard OIDC with group-based access control - user does NOT have matching group.

        This test verifies:
        1. OIDC server returns groups claim ["engineering", "operations"]
        2. Phoenix extracts groups using JMESPath (groups)
        3. Phoenix checks against ALLOWED_GROUPS ("admin,sales")
        4. User has NO matching groups → access DENIED
        """
        client = _httpx_client(_app)

        # Start the OAuth2 OIDC flow with groups
        response = client.post(f"oauth2/{_oidc_server_standard_with_groups}_denied/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify OAuth2 state and nonce cookies are set (no code_verifier for standard OIDC)
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" not in cookies  # OIDC doesn't use PKCE

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Complete the flow by calling the token endpoint
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify that user is redirected to login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

        # Verify that the user was NOT created
        assert _oidc_server_standard_with_groups.user_email, (
            "Fixture should have initialized a (random) user"
        )
        assert (email := sanitize_email(_oidc_server_standard_with_groups.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users


class TestPKCE:
    """Test PKCE (Proof Key for Code Exchange) OAuth2 flow.

    These tests verify that Phoenix correctly handles PKCE for both:
    - Public clients that cannot securely store a client_secret
    - Confidential clients using PKCE for defense-in-depth security

    PKCE adds code_challenge/code_verifier validation to protect against
    authorization code interception attacks.
    """

    async def test_pkce_public_client_flow(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE flow with a public client (no client_secret).

        This test verifies:
        1. Phoenix generates code_verifier and code_challenge
        2. OIDC server receives code_challenge in authorization request
        3. Phoenix sends code_verifier in token request (no client_secret)
        4. Server validates code_verifier matches code_challenge
        5. User is successfully authenticated and tokens are issued
        6. Sensitive cookies (state, nonce, code_verifier) are cleaned up
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify all required OAuth2 cookies are set
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" in cookies

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert _oidc_server_pkce_public.user_email, (
            "Fixture should have initialized a (random) user"
        )
        assert (email := sanitize_email(_oidc_server_pkce_public.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users

        # Complete the flow by calling the token endpoint
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify we got access tokens
        assert response.status_code == 302
        assert response.cookies.get("phoenix-access-token")
        assert response.cookies.get("phoenix-refresh-token")

        # Verify sensitive cookies are cleaned up (security: remove ephemeral crypto material)
        # Check Set-Cookie headers for deletion (Max-Age=0)
        set_cookie_headers = response.headers.get_list("set-cookie")
        assert any("phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any("phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any(
            "phoenix-oauth2-code-verifier=" in h and "Max-Age=0" in h for h in set_cookie_headers
        )

        # Verify that the user was created
        users = {u.profile.email: u for u in admin.list_users(_app)}
        assert email in users
        assert users[email].role is UserRoleInput.MEMBER

    async def test_pkce_confidential_client_flow(
        self,
        _oidc_server_pkce_confidential: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE flow with a confidential client (defense-in-depth).

        This test verifies defense-in-depth: both client_secret AND code_verifier
        are validated. Even if the client_secret is compromised, the attacker
        cannot exchange an intercepted authorization code without the code_verifier.

        This test verifies:
        1. Phoenix generates code_verifier and code_challenge (PKCE)
        2. Phoenix sends client_secret (traditional OAuth2)
        3. Server validates BOTH client_secret AND code_verifier
        4. User is successfully authenticated and tokens are issued
        5. Sensitive cookies (state, nonce, code_verifier) are cleaned up
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow with confidential client
        response = client.post(f"oauth2/{_oidc_server_pkce_confidential}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify all required OAuth2 cookies are set
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" in cookies

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert _oidc_server_pkce_confidential.user_email, (
            "Fixture should have initialized a (random) user"
        )
        assert (email := sanitize_email(_oidc_server_pkce_confidential.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users

        # Complete the flow by calling the token endpoint
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify we got access tokens
        assert response.status_code == 302
        assert response.cookies.get("phoenix-access-token")
        assert response.cookies.get("phoenix-refresh-token")

        # Verify sensitive cookies are cleaned up (security: remove ephemeral crypto material)
        # Check Set-Cookie headers for deletion (Max-Age=0)
        set_cookie_headers = response.headers.get_list("set-cookie")
        assert any("phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any("phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any(
            "phoenix-oauth2-code-verifier=" in h and "Max-Age=0" in h for h in set_cookie_headers
        )

        # Verify that the user was created
        users = {u.profile.email: u for u in admin.list_users(_app)}
        assert email in users
        assert users[email].role is UserRoleInput.MEMBER

    async def test_pkce_code_verifier_mismatch_rejected(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that invalid code_verifier is rejected.

        This test verifies that if an attacker intercepts the authorization code
        and tries to exchange it with a wrong code_verifier, the server rejects it.

        Security scenario: An attacker intercepts the authorization code from the
        redirect URL but doesn't have the code_verifier from the cookie. The server
        should reject the token exchange request.

        Also verifies that sensitive cookies are cleaned up even on error.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify all required OAuth2 cookies are set
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" in cookies

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Try to complete the flow with state and nonce but WITHOUT code_verifier
        # This simulates an attacker who intercepts the callback URL and has the state/nonce
        # cookies (from the same browser session) but doesn't have the code_verifier
        cookies_without_verifier = {k: v for k, v in cookies.items() if "code-verifier" not in k}
        response = _httpx_client(_app, cookies=cookies_without_verifier).get(callback_url)

        # Verify that user is redirected to login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

        # Verify sensitive cookies are cleaned up even on error (security: prevent reuse)
        # Check Set-Cookie headers for deletion (Max-Age=0)
        set_cookie_headers = response.headers.get_list("set-cookie")
        assert any("phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any("phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers)
        assert any(
            "phoenix-oauth2-code-verifier=" in h and "Max-Age=0" in h for h in set_cookie_headers
        )

    async def test_pkce_with_groups_access_granted(
        self,
        _oidc_server_pkce_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE with group-based access control - user HAS matching group.

        This test verifies:
        1. OIDC server returns groups claim ["engineering", "operations"]
        2. Phoenix extracts groups using JMESPath (groups)
        3. Phoenix checks against ALLOWED_GROUPS ("engineering,admin")
        4. User has "engineering" → access GRANTED
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow with groups
        response = client.post(f"oauth2/{_oidc_server_pkce_with_groups}_granted/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify all required OAuth2 cookies are set
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" in cookies

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert _oidc_server_pkce_with_groups.user_email, (
            "Fixture should have initialized a (random) user"
        )
        assert (email := sanitize_email(_oidc_server_pkce_with_groups.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users

        # Complete the flow by calling the token endpoint
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify we got access tokens (user has matching group)
        assert response.status_code == 302
        assert response.cookies.get("phoenix-access-token")
        assert response.cookies.get("phoenix-refresh-token")

        # Verify that the user was created
        users = {u.profile.email: u for u in admin.list_users(_app)}
        assert email in users
        assert users[email].role is UserRoleInput.MEMBER

    async def test_pkce_with_groups_access_denied(
        self,
        _oidc_server_pkce_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE with group-based access control - user does NOT have matching group.

        This test verifies:
        1. OIDC server returns groups claim ["engineering", "operations"]
        2. Phoenix extracts groups using JMESPath (groups)
        3. Phoenix checks against ALLOWED_GROUPS ("admin,sales")
        4. User has NO matching groups → access DENIED
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow with groups
        response = client.post(f"oauth2/{_oidc_server_pkce_with_groups}_denied/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Verify all required OAuth2 cookies are set
        cookies = dict(response.cookies)
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" in cookies

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Complete the flow by calling the token endpoint
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify that user is redirected to login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

        # Verify that the user was NOT created
        assert _oidc_server_pkce_with_groups.user_email, (
            "Fixture should have initialized a (random) user"
        )
        assert (email := sanitize_email(_oidc_server_pkce_with_groups.user_email))
        admin = _DEFAULT_ADMIN.log_in(_app)
        users = {sanitize_email(u.profile.email): u for u in admin.list_users(_app)}
        assert email not in users

    async def test_pkce_wrong_code_verifier_is_rejected(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that wrong code_verifier is rejected (not just missing).

        This test verifies that an attacker who intercepts the authorization code
        and tries to use their own code_verifier will be rejected by the OIDC server.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]
        cookies = dict(response.cookies)

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Replace code_verifier with a wrong value
        cookies["phoenix-oauth2-code-verifier"] = "wrong_code_verifier_value_12345"

        # Try to complete the flow with wrong code_verifier
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify that user is redirected to login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]
        assert "error=" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

    async def test_pkce_missing_code_verifier_cookie_is_rejected(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that missing code_verifier cookie in PKCE flow causes error.

        This verifies that for PKCE-enabled flows, the code_verifier cookie
        is required and the system properly rejects requests without it.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]
        cookies = dict(response.cookies)

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Remove code_verifier cookie (keep state and nonce)
        cookies.pop("phoenix-oauth2-code-verifier", None)

        # Try to complete the flow without code_verifier
        response = _httpx_client(_app, cookies=cookies).get(callback_url)

        # Verify that user is redirected to login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")

    async def test_pkce_code_verifier_cookie_security_attributes(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that PKCE code_verifier cookie has proper security attributes.

        This verifies that the code_verifier cookie (which contains sensitive
        cryptographic material) is set with HttpOnly, SameSite, and appropriate
        Max-Age values.
        """
        client = _httpx_client(_app)

        # Start the OAuth2 PKCE flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        assert response.status_code == 302

        # Verify cookie security attributes
        set_cookie_headers = response.headers.get_list("set-cookie")

        # Check code_verifier cookie
        verifier_cookie = next(
            (h for h in set_cookie_headers if "phoenix-oauth2-code-verifier=" in h), None
        )
        assert verifier_cookie is not None
        assert "HttpOnly" in verifier_cookie
        assert "SameSite=lax" in verifier_cookie or "SameSite=Lax" in verifier_cookie
        assert "Max-Age=900" in verifier_cookie  # 15 minutes


class TestMockOIDCServer:
    """Tests for mock _OIDCServer behavior (not Phoenix).

    These tests verify that our mock OIDC server correctly simulates the distinction
    between PKCE and standard OIDC flows. This ensures that other integration tests
    are actually testing Phoenix's behavior correctly by providing realistic mock
    server responses.
    """

    async def test_pkce_server_rejects_non_pkce_flow(
        self,
        _oidc_server_pkce_public: _OIDCServer,
    ) -> None:
        """Test that mock PKCE-enabled server rejects token requests without code_verifier.

        This verifies that the mock _OIDCServer, when configured with PKCE enabled,
        properly rejects token exchange requests that don't include the PKCE code_verifier,
        even if they have a valid authorization code. This ensures the mock server
        accurately simulates real OIDC provider behavior for testing purposes.
        """
        import httpx

        # Get authorization code by doing the auth flow
        client = httpx.Client(verify=False)

        # Start auth request with code_challenge
        from base64 import urlsafe_b64encode
        from hashlib import sha256

        code_verifier = "test_verifier_1234567890_abcdefghijklmnopqrstuvwxyz"
        code_challenge = (
            urlsafe_b64encode(sha256(code_verifier.encode()).digest()).decode().rstrip("=")
        )

        # Get authorization code from server
        auth_response = client.get(
            f"{_oidc_server_pkce_public.base_url}/auth",
            params={
                "client_id": _oidc_server_pkce_public.client_id,
                "response_type": "code",
                "redirect_uri": "http://localhost/callback",
                "state": "test_state",
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            },
        )
        assert auth_response.status_code == 302

        # Extract authorization code from redirect
        from urllib.parse import parse_qs, urlparse

        callback_url = auth_response.headers["location"]
        query_params = parse_qs(urlparse(callback_url).query)
        auth_code = query_params["code"][0]

        # Try to exchange code for token WITHOUT code_verifier (standard OIDC flow)
        token_response = client.post(
            f"{_oidc_server_pkce_public.base_url}/token",
            data={
                "grant_type": "authorization_code",
                "code": auth_code,
                "redirect_uri": "http://localhost/callback",
                "client_id": _oidc_server_pkce_public.client_id,
                # NOT including code_verifier - this should be rejected
            },
        )

        # Server should reject the request
        assert token_response.status_code == 400
        error_data = token_response.json()
        assert error_data.get("error") == "invalid_request"
        assert "code_verifier" in error_data.get("error_description", "").lower()

    async def test_standard_oidc_server_rejects_pkce_parameters(
        self,
        _oidc_server_standard: _OIDCServer,
    ) -> None:
        """Test that mock standard OIDC server rejects token requests with code_verifier.

        This verifies that the mock _OIDCServer, when configured for standard OIDC (not PKCE),
        properly rejects token exchange requests that include PKCE parameters (code_verifier)
        when PKCE is not enabled. This ensures the mock server accurately simulates real
        OIDC provider behavior for testing purposes.
        """
        import httpx

        # Get authorization code by doing standard OAuth flow (no PKCE)
        client = httpx.Client(verify=False)

        # Get authorization code from server (standard flow, no code_challenge)
        auth_response = client.get(
            f"{_oidc_server_standard.base_url}/auth",
            params={
                "client_id": _oidc_server_standard.client_id,
                "response_type": "code",
                "redirect_uri": "http://localhost/callback",
                "state": "test_state",
                # NO code_challenge - standard OIDC flow
            },
        )
        assert auth_response.status_code == 302

        # Extract authorization code from redirect
        from urllib.parse import parse_qs, urlparse

        callback_url = auth_response.headers["location"]
        query_params = parse_qs(urlparse(callback_url).query)
        auth_code = query_params["code"][0]

        # Try to exchange code for token WITH code_verifier (PKCE flow on non-PKCE server)
        token_response = client.post(
            f"{_oidc_server_standard.base_url}/token",
            data={
                "grant_type": "authorization_code",
                "code": auth_code,
                "redirect_uri": "http://localhost/callback",
                "client_id": _oidc_server_standard.client_id,
                "client_secret": _oidc_server_standard.client_secret,
                "code_verifier": "some_pkce_verifier_12345",  # Should be rejected
            },
        )

        # Server should reject the request
        assert token_response.status_code == 400
        error_data = token_response.json()
        assert error_data.get("error") == "invalid_request"
        assert "code_verifier" in error_data.get("error_description", "").lower()


class TestTLS:
    def test_non_tls_client_cannot_connect(self, _app: _AppInfo) -> None:
        with pytest.raises(URLError) as e:
            urlopen(_app.base_url)
        assert "SSL" in str(e.value), f"Expected SSL error, got: {e.value}"


class TestOriginAndReferer:
    @pytest.mark.parametrize(
        "headers,expectation",
        [
            [dict(), _OK],
            [dict(origin="http://localhost"), _OK],
            [dict(referer="http://localhost/xyz"), _OK],
            [dict(origin="http://xyz.com"), _EXPECTATION_401],
            [dict(referer="http://xyz.com/xyz"), _EXPECTATION_401],
            [dict(origin="http://xyz.com", referer="http://localhost/xyz"), _EXPECTATION_401],
            [dict(origin="http://localhost", referer="http://xyz.com/xyz"), _EXPECTATION_401],
        ],
    )
    def test_csrf_origin_validation(
        self,
        headers: dict[str, str],
        expectation: AbstractContextManager[Any],
        _app: _AppInfo,
    ) -> None:
        resp = _httpx_client(_app, headers=headers).get("/healthz")
        with expectation:
            resp.raise_for_status()


class TestLogIn:
    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_can_log_in(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        u.log_in(_app)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_can_log_in_more_than_once_simultaneously(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        for _ in range(10):
            u.log_in(_app)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_can_log_in_with_case_insensitive_email(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        username, password = token_hex(8), token_hex(8)
        email = _randomize_casing(f"{string.ascii_lowercase}@{token_hex(16)}.com")
        profile = _Profile(email=email, password=password, username=username)
        u = _get_user(_app, role_or_user, profile=profile)
        case_insensitive_email = _randomize_casing(u.email)
        _log_in(_app, u.password, email=case_insensitive_email)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_cannot_log_in_with_empty_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        with _EXPECTATION_401:
            _log_in(_app, "", email=u.email)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_cannot_log_in_with_wrong_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        assert (wrong_password := next(_passwords)) != u.password
        with _EXPECTATION_401:
            _log_in(_app, wrong_password, email=u.email)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_cannot_log_in_with_deleted_user(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user)
        _delete_users(_app, _app.admin_secret, users=[user])
        with _EXPECTATION_401:
            user.log_in(_app)


class TestWelcomeEmail:
    @pytest.mark.parametrize("role", list(UserRoleInput))
    @pytest.mark.parametrize("send_welcome_email", [True, False])
    def test_welcome_email_is_sent(
        self,
        role: UserRoleInput,
        send_welcome_email: bool,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        email = f"{token_hex(16)}@{token_hex(16)}.com"
        profile = _Profile(email=email, password=token_hex(8), username=token_hex(8))
        u = _create_user(
            _app,
            _get_user(_app, _ADMIN),
            role=role,
            profile=profile,
            send_welcome_email=send_welcome_email,
        )
        if send_welcome_email:
            assert _smtpd.messages
            assert (msg := _smtpd.messages[-1])["to"] == u.email
            assert (soup := _extract_html(msg))
            assert isinstance((link := soup.find(id="welcome-url")), bs4.Tag)
            assert isinstance((url := link.get("href")), str)
            assert url == _app.base_url
        else:
            assert not _smtpd.messages or _smtpd.messages[-1]["to"] != u.email


class TestPasswordReset:
    def test_initiate_password_reset_does_not_reveal_whether_user_exists(
        self,
        _emails: Iterator[_Email],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        email = next(_emails)
        assert not _initiate_password_reset(_app, email, _smtpd, should_receive_email=False)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_initiate_password_reset_does_not_change_existing_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        assert u.initiate_password_reset(_app, _smtpd)
        u.log_in(_app)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_initiate_password_reset_with_case_insensitive_email(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        username, password = token_hex(8), token_hex(8)
        email = _randomize_casing(f"{string.ascii_lowercase}@{token_hex(16)}.com")
        profile = _Profile(email=email, password=password, username=username)
        u = _get_user(_app, role_or_user, profile=profile)
        case_insensitive_email = _randomize_casing(u.email)
        assert _initiate_password_reset(_app, case_insensitive_email, _smtpd)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_password_reset_can_be_initiated_multiple_times(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        new_password = next(_passwords)
        assert new_password != u.password
        tokens = [u.initiate_password_reset(_app, _smtpd) for _ in range(2)]
        assert sum(map(bool, tokens)) > 1
        for i, token in enumerate(tokens):
            assert token
            if i < len(tokens) - 1:
                with _EXPECTATION_401:
                    token.reset(_app, new_password)
                continue
            # only the last one works
            token.reset(_app, new_password)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_password_reset_can_be_initiated_immediately_after_password_reset(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        new_password = next(_passwords)
        assert new_password != u.password
        assert (token := u.initiate_password_reset(_app, _smtpd))
        token.reset(_app, new_password)
        assert u.initiate_password_reset(_app, _smtpd)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_password_reset_token_is_single_use(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        new_password = next(_passwords)
        assert new_password != u.password
        newer_password = next(_passwords)
        assert newer_password != new_password
        assert (token := u.initiate_password_reset(_app, _smtpd))
        token.reset(_app, new_password)
        with _EXPECTATION_401:
            token.reset(_app, newer_password)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_initiate_password_reset_and_then_reset_password_using_token_from_email(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        logged_in_user.visit(_app)
        assert (token := u.initiate_password_reset(_app, _smtpd))
        new_password = next(_passwords)
        assert new_password != u.password
        token.reset(_app, new_password)
        with _EXPECTATION_401:
            # old password should no longer work
            u.log_in(_app)
        # old logged-in tokens should no longer work
        logged_in_user.visit(_app, 401)
        # new password should work
        new_profile = replace(u.profile, password=new_password)
        new_u = replace(u, profile=new_profile)
        new_u.log_in(_app)
        assert not _will_be_asked_to_reset_password(_app, new_u)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_deleted_user_will_not_receive_email_after_initiating_password_reset(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        logged_in_user.visit(_app)
        _DEFAULT_ADMIN.delete_users(_app, u)
        assert not u.initiate_password_reset(_app, _smtpd, should_receive_email=False)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_deleted_user_cannot_reset_password_using_token_from_email(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        logged_in_user.visit(_app)
        assert (token := u.initiate_password_reset(_app, _smtpd))
        new_password = next(_passwords)
        assert new_password != u.password
        _DEFAULT_ADMIN.delete_users(_app, u)
        with _EXPECTATION_401:
            token.reset(_app, new_password)


class TestLogOut:
    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_can_log_out(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_users = [u.log_in(_app) for _ in range(2)]
        for logged_in_user in logged_in_users:
            logged_in_user.visit(_app)
        logged_in_users[0].log_out(_app)
        for logged_in_user in logged_in_users:
            logged_in_user.visit(_app, 401)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_can_log_out_with_only_refresh_token(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        refresh_token = u.log_in(_app).tokens.refresh_token
        # Explicitly check for 302 response from logout
        client = _httpx_client(_app, refresh_token)
        response = client.get("auth/logout", follow_redirects=False)
        assert response.status_code == 302
        # Optionally, check the redirect location
        assert response.headers["location"] in ("/login", "/logout")

    def test_log_out_does_not_raise_exception(self, _app: _AppInfo) -> None:
        _log_out(_app)


class TestLoggedInTokens:
    class _JtiSet(Generic[_TokenT]):
        def __init__(self) -> None:
            self._set: set[str] = set()

        def add(self, token: _TokenT) -> None:
            assert (jti := _decode_jwt(token)["jti"]) not in self._set
            self._set.add(jti)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_logged_in_tokens_should_change_after_log_out(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        access_tokens = self._JtiSet[_AccessToken]()
        refresh_tokens = self._JtiSet[_RefreshToken]()
        u = _get_user(_app, role_or_user)
        for _ in range(2):
            logged_in_user = u.log_in(_app)
            access_tokens.add(logged_in_user.tokens.access_token)
            refresh_tokens.add(logged_in_user.tokens.refresh_token)
            logged_in_user.log_out(_app)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_logged_in_tokens_should_differ_between_users(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        access_tokens = self._JtiSet[_AccessToken]()
        refresh_tokens = self._JtiSet[_RefreshToken]()
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        access_tokens.add(logged_in_user.tokens.access_token)
        refresh_tokens.add(logged_in_user.tokens.refresh_token)
        logged_in_user.log_out(_app)
        other_user = _get_user(_app, role)
        logged_in_user = other_user.log_in(_app)
        access_tokens.add(logged_in_user.tokens.access_token)
        refresh_tokens.add(logged_in_user.tokens.refresh_token)
        logged_in_user.log_out(_app)

    def test_corrupt_tokens_are_not_accepted(self, _app: _AppInfo) -> None:
        parts = _DEFAULT_ADMIN.log_in(_app).tokens.access_token.split(".")
        # delete last 3 characters because base64 could have up to 2 padding characters
        bad_headers = _AccessToken(f"{parts[0][:-3]}.{parts[1]}.{parts[2]}")
        with _EXPECTATION_401:
            _create_api_key(_app, bad_headers)
        bad_payload = _AccessToken(f"{parts[0]}.{parts[1][:-3]}.{parts[2]}")
        with _EXPECTATION_401:
            _create_api_key(_app, bad_payload)


class TestRefreshToken:
    @pytest.mark.parametrize("role_or_user", list(UserRoleInput))
    def test_end_to_end_credentials_flow(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_users: defaultdict[int, dict[int, _LoggedInUser]] = defaultdict(dict)

        # user logs into first browser
        logged_in_users[0][0] = u.log_in(_app)
        # tokens are refreshed in the first browser
        logged_in_users[0][1] = logged_in_users[0][0].refresh(_app)
        # user can visit the app
        logged_in_users[0][1].visit(_app)
        # refresh token is good for one use only
        with pytest.raises(HTTPStatusError):
            logged_in_users[0][0].refresh(_app)
        # original access token is invalid after refresh
        logged_in_users[0][0].visit(_app, 401)

        # user logs into second browser
        logged_in_users[1][0] = u.log_in(_app)
        # user can visit the app
        logged_in_users[1][0].visit(_app)

        # user logs out in first browser
        logged_in_users[0][1].log_out(_app)
        # user is logged out of both browsers
        logged_in_users[0][1].visit(_app, 401)
        logged_in_users[1][0].visit(_app, 401)


class TestCreateUser:
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_cannot_create_user_without_access(
        self,
        role: UserRoleInput,
        _profiles: Iterator[_Profile],
        _app: _AppInfo,
    ) -> None:
        profile = next(_profiles)
        with _EXPECTATION_401:
            _create_user(_app, role=role, profile=profile)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_only_admin_can_create_user(
        self,
        role_or_user: UserRoleInput,
        role: UserRoleInput,
        expectation: AbstractContextManager[Optional[Unauthorized]],
        _get_user: _GetUser,
        _profiles: Iterator[_Profile],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        profile = next(_profiles)
        with expectation as e:
            new_user = logged_in_user.create_user(_app, role, profile=profile)
        if not e:
            new_user.log_in(_app)
            assert _will_be_asked_to_reset_password(_app, new_user)

    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    def test_cannot_create_duplicate_user_with_different_email_case(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        admin = _get_user(_app, role_or_user).log_in(_app)

        # Create first user
        username, password = token_hex(8), token_hex(8)
        email = _randomize_casing(f"{string.ascii_lowercase}@{token_hex(16)}.com")
        profile = _Profile(email=email, password=password, username=username)
        admin.create_user(_app, profile=profile)

        # Try to create second user with same email but different case
        case_different_profile = replace(profile, email=_randomize_casing(profile.email))
        with pytest.raises(Exception):  # Should fail due to duplicate email
            admin.create_user(_app, profile=case_different_profile)


class TestPatchViewer:
    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_cannot_patch_viewer_without_access(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        with _EXPECTATION_401:
            _patch_viewer(_app, None, u.password, new_username="new_username")

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_cannot_change_password_without_current_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        new_password = next(_passwords)
        with pytest.raises(Exception):
            _patch_viewer(_app, logged_in_user, None, new_password=new_password)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_cannot_change_password_with_wrong_current_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        assert (wrong_password := next(_passwords)) != logged_in_user.password
        new_password = next(_passwords)
        with pytest.raises(Exception):
            _patch_viewer(_app, logged_in_user, wrong_password, new_password=new_password)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_change_password(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role)
        logged_in_user = u.log_in(_app)
        new_password = f"new_password_{next(_passwords)}"
        assert new_password != logged_in_user.password
        _patch_viewer(
            _app,
            (old_token := logged_in_user.tokens),
            (old_password := logged_in_user.password),
            new_password=new_password,
        )
        another_password = f"another_password_{next(_passwords)}"
        with _EXPECTATION_401:
            # old tokens should no longer work
            _patch_viewer(_app, old_token, new_password, new_password=another_password)
        with _EXPECTATION_401:
            # old password should no longer work
            u.log_in(_app)
        new_profile = replace(u.profile, password=new_password)
        new_u = replace(u, profile=new_profile)
        new_tokens = new_u.log_in(_app)
        assert not _will_be_asked_to_reset_password(_app, new_u)
        with pytest.raises(Exception):
            # old password should no longer work, even with new tokens
            _patch_viewer(_app, new_tokens, old_password, new_password=another_password)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_change_username(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _usernames: Iterator[_Username],
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role)
        logged_in_user = u.log_in(_app)
        new_username = f"new_username_{next(_usernames)}"
        _patch_viewer(_app, logged_in_user, None, new_username=new_username)
        another_username = f"another_username_{next(_usernames)}"
        wrong_password = next(_passwords)
        assert wrong_password != logged_in_user.password
        _patch_viewer(_app, logged_in_user, wrong_password, new_username=another_username)


class TestPatchUser:
    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    @pytest.mark.parametrize("new_role", list(UserRoleInput))
    def test_cannot_change_role_of_default_admin(
        self,
        role_or_user: _RoleOrUser,
        new_role: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        with pytest.raises(Exception, match="role"):
            logged_in_user.patch_user(_app, _DEFAULT_ADMIN, new_role=new_role)

    def test_admin_cannot_change_role_for_self(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, _ADMIN)
        logged_in_user = u.log_in(_app)
        with pytest.raises(Exception, match="role"):
            logged_in_user.patch_user(_app, u, new_role=_MEMBER)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    @pytest.mark.parametrize("new_role", list(UserRoleInput))
    def test_only_admin_can_change_role_for_non_self(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        new_role: UserRoleInput,
        expectation: AbstractContextManager[Optional[Unauthorized]],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        non_self = _get_user(_app, role)
        assert non_self.gid != logged_in_user.gid
        with _EXPECTATION_401:
            _patch_user(_app, non_self, new_role=new_role)
        with expectation:
            logged_in_user.patch_user(_app, non_self, new_role=new_role)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_only_admin_can_change_password_for_non_self(
        self,
        role_or_user: UserRoleInput,
        role: UserRoleInput,
        expectation: AbstractContextManager[Optional[Unauthorized]],
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        non_self = _get_user(_app, role)
        assert non_self.gid != logged_in_user.gid
        old_password = non_self.password
        new_password = f"new_password_{next(_passwords)}"
        assert new_password != old_password
        with _EXPECTATION_401:
            _patch_user(_app, non_self, new_password=new_password)
        with expectation as e:
            logged_in_user.patch_user(_app, non_self, new_password=new_password)
        if e:
            # password should still work
            non_self.log_in(_app)
            return
        with _EXPECTATION_401:
            # old password should no longer work
            non_self.log_in(_app)
        new_profile = replace(non_self.profile, password=new_password)
        new_non_self = replace(non_self, profile=new_profile)
        new_non_self.log_in(_app)
        assert _will_be_asked_to_reset_password(_app, new_non_self)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_only_admin_can_change_username_for_non_self(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        expectation: AbstractContextManager[Optional[Unauthorized]],
        _get_user: _GetUser,
        _usernames: Iterator[_Username],
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        non_self = _get_user(_app, role)
        assert non_self.gid != logged_in_user.gid
        old_username = non_self.username
        new_username = f"new_username_{next(_usernames)}"
        assert new_username != old_username
        with _EXPECTATION_401:
            _patch_user(_app, non_self, new_username=new_username)
        with expectation:
            logged_in_user.patch_user(_app, non_self, new_username=new_username)

    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    @pytest.mark.parametrize("old_role", list(UserRoleInput))
    @pytest.mark.parametrize("new_role", list(UserRoleInput))
    def test_user_is_logged_out_when_role_changes(
        self,
        role_or_user: _RoleOrUser,
        old_role: UserRoleInput,
        new_role: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that changing a user's role invalidates their existing tokens.

        This is a security test to ensure that when a user's role changes,
        their old tokens (which contain the old role) are immediately invalidated.
        This prevents privilege escalation/retention vulnerabilities.
        """
        if old_role == new_role:
            pytest.skip("Skipping test when old_role == new_role")

        # Create user with old_role and log them in
        user = _get_user(_app, old_role)
        logged_in_user = user.log_in(_app)
        old_tokens = logged_in_user.tokens

        # Verify user can access with old tokens
        logged_in_user.visit(_app)

        # Admin changes user's role
        _patch_user(_app, user, _app.admin_secret, new_role=new_role)

        # Old tokens should no longer work (user should be logged out)
        logged_in_user.visit(_app, 401)

        # User needs to log in again
        new_logged_in_user = user.log_in(_app)
        new_tokens = new_logged_in_user.tokens

        # New tokens should be different
        assert new_tokens.access_token != old_tokens.access_token
        assert new_tokens.refresh_token != old_tokens.refresh_token

        # New tokens should work
        new_logged_in_user.visit(_app)


class TestDeleteUsers:
    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_MEMBER, _DENIED),
            (_ADMIN, pytest.raises(Exception)),
            (_DEFAULT_ADMIN, pytest.raises(Exception)),
        ],
    )
    def test_cannot_delete_system_user(
        self,
        role_or_user: UserRoleInput,
        expectation: _Expectation,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        with expectation:
            logged_in_user.delete_users(_app, _SYSTEM_USER_GID)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_MEMBER, _DENIED),
            (_ADMIN, pytest.raises(Exception, match="Cannot delete the default admin user")),
            (_DEFAULT_ADMIN, pytest.raises(Exception)),
        ],
    )
    def test_cannot_delete_default_admin_user(
        self,
        role_or_user: _RoleOrUser,
        expectation: _Expectation,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        with expectation:
            logged_in_user.delete_users(_app, _DEFAULT_ADMIN)
        _DEFAULT_ADMIN.log_in(_app)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_only_admin_can_delete_users(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        non_self = _get_user(_app, role)
        with expectation as e:
            logged_in_user.delete_users(_app, non_self)
        if e:
            non_self.log_in(_app)
        else:
            with _EXPECTATION_401:
                non_self.log_in(_app)

    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    def test_error_is_raised_when_deleting_a_non_existent_user_id(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        phantom = _GqlId(GlobalID(type_name="User", node_id=str(999_999_999)))
        user = _get_user(_app)
        with pytest.raises(Exception, match="Some user IDs could not be found"):
            logged_in_user.delete_users(_app, phantom, user)
        user.log_in(_app)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_deletion_deletes_all_tokens(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _spans: Sequence[ReadableSpan],
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role)
        logged_in_user = user.log_in(_app)
        tokens = logged_in_user.tokens
        logged_in_user.visit(_app)
        _delete_users(_app, _app.admin_secret, users=[user])
        with _EXPECTATION_401:
            tokens.refresh(_app)
        logged_in_user.visit(_app, 401)


class TestCreateApiKey:
    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _OK),
            (_MEMBER, _OK),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_create_user_api_key(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        with expectation:
            logged_in_user.create_api_key(_app)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_create_system_api_key(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        with expectation:
            logged_in_user.create_api_key(_app, "System")


class TestDeleteApiKey:
    @pytest.mark.parametrize("role_or_user", [_VIEWER, _MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_delete_user_api_key(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        api_key = logged_in_user.create_api_key(_app)
        logged_in_user.delete_api_key(_app, api_key)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", [_MEMBER, _ADMIN])
    def test_only_admin_can_delete_user_api_key_for_non_self(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        non_self = _get_user(_app, role).log_in(_app)
        assert non_self.gid != logged_in_user.gid
        api_key = non_self.create_api_key(_app)
        with expectation:
            logged_in_user.delete_api_key(_app, api_key)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_delete_system_api_key(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        api_key = _DEFAULT_ADMIN.create_api_key(_app, "System")
        with expectation:
            logged_in_user.delete_api_key(_app, api_key)


class TestGraphQLQuery:
    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize(
        "query",
        [
            "query{users{edges{node{id}}}}",
            "query{userApiKeys{id}}",
            "query{systemApiKeys{id}}",
        ],
    )
    def test_only_admin_can_list_users_and_api_keys(
        self,
        role_or_user: _RoleOrUser,
        query: str,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        with expectation:
            logged_in_user.gql(_app, query)

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_can_query_user_node_for_self(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        query = 'query{node(id:"' + u.gid + '"){__typename}}'
        logged_in_user.gql(_app, query)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_only_admin_can_query_user_node_for_non_self(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in_user = u.log_in(_app)
        non_self = _get_user(_app, role)
        query = 'query{node(id:"' + non_self.gid + '"){__typename}}'
        with expectation:
            logged_in_user.gql(_app, query)


class TestSpanExporters:
    @pytest.mark.parametrize(
        "use_api_key,expires_at,expected",
        [
            (True, NOW + timedelta(days=1), SpanExportResult.SUCCESS),
            (True, None, SpanExportResult.SUCCESS),
            (True, NOW, SpanExportResult.FAILURE),
            (False, None, SpanExportResult.FAILURE),
        ],
    )
    def test_api_key(
        self,
        use_api_key: bool,
        expires_at: Optional[datetime],
        expected: SpanExportResult,
        _span_exporter: _SpanExporterFactory,
        _spans: Sequence[ReadableSpan],
        _app: _AppInfo,
    ) -> None:
        headers: Optional[_Headers] = None
        api_key: Optional[_ApiKey] = None
        if use_api_key:
            api_key = _DEFAULT_ADMIN.create_api_key(_app, "System", expires_at=expires_at)
            # Must use all lower case for `authorization` because
            # otherwise it would crash the gRPC receiver.
            headers = dict(authorization=f"Bearer {api_key}")
        export = _span_exporter(_app, headers=headers).export
        for _ in range(2):
            assert export(_spans) is expected
        if api_key and expected is SpanExportResult.SUCCESS:
            _DEFAULT_ADMIN.delete_api_key(_app, api_key)
            assert export(_spans) is SpanExportResult.FAILURE

    @pytest.mark.parametrize(
        "use_admin_secret,expected",
        [
            (True, SpanExportResult.SUCCESS),
            (False, SpanExportResult.FAILURE),
        ],
    )
    def test_admin_secret(
        self,
        use_admin_secret: bool,
        expected: SpanExportResult,
        _span_exporter: _SpanExporterFactory,
        _spans: Sequence[ReadableSpan],
        _app: _AppInfo,
    ) -> None:
        if use_admin_secret:
            assert (api_key := _app.admin_secret)
        else:
            api_key = _AdminSecret("")
        # Must use all lower case for `authorization` because
        # otherwise it would crash the gRPC receiver.
        headers = dict(authorization=f"Bearer {str(api_key)}")
        export = _span_exporter(_app, headers=headers).export
        assert export(_spans) is expected


class TestEmbeddingsRestApi:
    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_authenticated_users_can_access_route(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user)
        logged_in_user = user.log_in(_app)
        with _EXPECTATION_404:  # no files have been exported
            logged_in_user.export_embeddings(_app, "embeddings")

    def test_unauthenticated_requests_receive_401(self, _app: _AppInfo) -> None:
        with _EXPECTATION_401:
            _export_embeddings(_app, None, filename="embeddings")


class TestPrompts:
    def test_authenticated_users_are_recorded_in_prompts(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        u = _get_user(_app, _MEMBER)
        logged_in_user = u.log_in(_app)

        # Create new prompt
        response, _ = logged_in_user.gql(
            _app,
            query="""
              mutation CreateChatPromptMutation($input: CreateChatPromptInput!) {
                createChatPrompt(input: $input) {
                  id
                  promptVersions {
                    edges {
                      promptVersion: node {
                        user {
                          id
                        }
                      }
                    }
                  }
                }
              }
            """,
            variables={
                "input": {
                    "name": "prompt-name",
                    "description": "prompt-description",
                    "promptVersion": {
                        "description": "prompt-version-description",
                        "templateFormat": "MUSTACHE",
                        "template": {
                            "messages": [
                                {
                                    "role": "USER",
                                    "content": [{"text": {"text": "hello world"}}],
                                }
                            ]
                        },
                        "invocationParameters": {"temperature": 0.4},
                        "modelProvider": "OPENAI",
                        "modelName": "o1-mini",
                    },
                }
            },
        )
        prompt_id = response["data"]["createChatPrompt"]["id"]
        prompt_versions = response["data"]["createChatPrompt"]["promptVersions"]["edges"]
        assert len(prompt_versions) == 1
        user = prompt_versions[0]["promptVersion"]["user"]
        assert user is not None
        assert user["id"] == logged_in_user.gid

        # Create new version for existing prompt
        response, _ = logged_in_user.gql(
            _app,
            query="""
              mutation CreateChatPromptVersionMutation($input: CreateChatPromptVersionInput!) {
                createChatPromptVersion(input: $input) {
                  promptVersions {
                    edges {
                      promptVersion: node {
                        user {
                          id
                        }
                      }
                    }
                  }
                }
              }
            """,
            variables={
                "input": {
                    "promptId": prompt_id,
                    "promptVersion": {
                        "description": "new-version-description",
                        "templateFormat": "MUSTACHE",
                        "template": {
                            "messages": [
                                {
                                    "role": "USER",
                                    "content": [{"text": {"text": "new version"}}],
                                }
                            ]
                        },
                        "invocationParameters": {"temperature": 0.4},
                        "modelProvider": "OPENAI",
                        "modelName": "o1-mini",
                    },
                }
            },
        )

        # Verify both versions record the user
        prompt_versions = response["data"]["createChatPromptVersion"]["promptVersions"]["edges"]
        assert len(prompt_versions) == 2
        for version in prompt_versions:
            user = version["promptVersion"]["user"]
            assert user is not None
            assert user["id"] == logged_in_user.gid


class TestSpanAnnotations:
    QUERY = """
      mutation CreateSpanAnnotations($input: [CreateSpanAnnotationInput!]!) {
        createSpanAnnotations(input: $input) {
          spanAnnotations {
            ...SpanAnnotationFields
          }
        }
      }

      mutation PatchSpanAnnotations($input: [PatchAnnotationInput!]!) {
        patchSpanAnnotations(input: $input) {
          spanAnnotations {
            ...SpanAnnotationFields
          }
        }
      }

      mutation DeleteSpanAnnotations($input: DeleteAnnotationsInput!) {
        deleteSpanAnnotations(input: $input) {
          spanAnnotations {
            ...SpanAnnotationFields
          }
        }
      }

      query GetSpanAnnotation($annotationId: ID!) {
        spanAnnotation: node(id: $annotationId) {
          ... on SpanAnnotation {
            ...SpanAnnotationFields
          }
        }
      }

      fragment SpanAnnotationFields on SpanAnnotation {
        id
        name
        score
        label
        explanation
        annotatorKind
        metadata
        source
        identifier
        spanId
        user {
          id
          email
          username
        }
      }
    """

    async def test_other_users_cannot_patch_and_only_creator_or_admin_can_delete(
        self,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        assert _existing_spans, "At least one existing span is required for this test"
        span_gid, *_ = choice(_existing_spans)

        annotation_creator = _get_user(_app, _MEMBER)
        logged_in_annotation_creator = annotation_creator.log_in(_app)
        member = _get_user(_app, _MEMBER)
        logged_in_member = member.log_in(_app)
        admin = _get_user(_app, _ADMIN)
        logged_in_admin = admin.log_in(_app)

        # Create span annotation
        name = token_hex(8)
        response, _ = logged_in_annotation_creator.gql(
            _app,
            query=self.QUERY,
            operation_name="CreateSpanAnnotations",
            variables={
                "input": {
                    "spanId": str(span_gid),
                    "name": name,
                    "annotatorKind": "HUMAN",
                    "label": "correct",
                    "score": 1,
                    "explanation": "explanation",
                    "metadata": {},
                    "identifier": "identifier",
                    "source": "APP",
                }
            },
        )

        span_annotations = response["data"]["createSpanAnnotations"]["spanAnnotations"]
        assert len(span_annotations) == 1
        original_span_annotation = span_annotations[0]
        annotation_id = original_span_annotation["id"]

        # Only the user who created the annotation can patch
        for user in [logged_in_member, logged_in_admin]:
            with pytest.raises(RuntimeError) as exc_info:
                response, _ = user.gql(
                    _app,
                    query=self.QUERY,
                    operation_name="PatchSpanAnnotations",
                    variables={
                        "input": {
                            "annotationId": annotation_id,
                            "name": f"patched-{name}",
                            "annotatorKind": "LLM",
                            "label": "incorrect",
                            "score": 0,
                            "explanation": "patched-explanation",
                            "metadata": {"patched": "key"},
                            "identifier": "patched-identifier",
                        }
                    },
                )
            assert "At least one span annotation is not associated with the current user." in str(
                exc_info.value
            )

            # Check that the annotation remains unchanged
            response, _ = user.gql(
                _app,
                query=self.QUERY,
                operation_name="GetSpanAnnotation",
                variables={"annotationId": annotation_id},
            )
            span_annotation = response["data"]["spanAnnotation"]
            assert span_annotation == original_span_annotation

        # Member who did not create the annotation cannot delete
        with pytest.raises(RuntimeError) as exc_info:
            logged_in_member.gql(
                _app,
                query=self.QUERY,
                operation_name="DeleteSpanAnnotations",
                variables={
                    "input": {
                        "annotationIds": [annotation_id],
                    }
                },
            )
        assert "At least one span annotation is not associated with the current user." in str(
            exc_info.value
        )

        # Check that the annotation remains unchanged
        response, _ = user.gql(
            _app,
            query=self.QUERY,
            operation_name="GetSpanAnnotation",
            variables={"annotationId": annotation_id},
        )
        span_annotation = response["data"]["spanAnnotation"]
        assert span_annotation == original_span_annotation

        # Admin can delete
        response, _ = logged_in_admin.gql(
            _app,
            query=self.QUERY,
            operation_name="DeleteSpanAnnotations",
            variables={
                "input": {
                    "annotationIds": [annotation_id],
                }
            },
        )


class TestTraceAnnotations:
    QUERY = """
      mutation CreateTraceAnnotations($input: [CreateTraceAnnotationInput!]!) {
        createTraceAnnotations(input: $input) {
          traceAnnotations {
            ...TraceAnnotationFields
          }
        }
      }

      mutation PatchTraceAnnotations($input: [PatchAnnotationInput!]!) {
        patchTraceAnnotations(input: $input) {
          traceAnnotations {
            ...TraceAnnotationFields
          }
        }
      }

      mutation DeleteTraceAnnotations($input: DeleteAnnotationsInput!) {
        deleteTraceAnnotations(input: $input) {
          traceAnnotations {
            ...TraceAnnotationFields
          }
        }
      }

      query GetTraceAnnotation($annotationId: ID!) {
        traceAnnotation: node(id: $annotationId) {
          ... on TraceAnnotation {
            ...TraceAnnotationFields
          }
        }
      }

      fragment TraceAnnotationFields on TraceAnnotation {
        id
        name
        score
        label
        explanation
        annotatorKind
        metadata
        source
        identifier
        trace {
          traceId
        }
        user {
          id
          email
          username
        }
      }
    """

    async def test_other_users_cannot_patch_and_only_creator_or_admin_can_delete(
        self,
        _existing_spans: Sequence[_ExistingSpan],
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        assert _existing_spans, "At least one existing span is required for this test"
        existing_span = choice(_existing_spans)
        trace_gid = existing_span.trace.id

        annotation_creator = _get_user(_app, _MEMBER)
        logged_in_annotation_creator = annotation_creator.log_in(_app)
        member = _get_user(_app, _MEMBER)
        logged_in_member = member.log_in(_app)
        admin = _get_user(_app, _ADMIN)
        logged_in_admin = admin.log_in(_app)

        # Create trace annotation
        response, _ = logged_in_annotation_creator.gql(
            _app,
            query=self.QUERY,
            operation_name="CreateTraceAnnotations",
            variables={
                "input": {
                    "traceId": str(trace_gid),
                    "name": "trace-annotation-name",
                    "annotatorKind": "HUMAN",
                    "label": "correct",
                    "score": 1,
                    "explanation": "explanation",
                    "metadata": {},
                    "identifier": "identifier",
                    "source": "APP",
                }
            },
        )

        trace_annotations = response["data"]["createTraceAnnotations"]["traceAnnotations"]
        assert len(trace_annotations) == 1
        original_trace_annotation = trace_annotations[0]
        annotation_id = original_trace_annotation["id"]

        # Only the user who created the annotation can patch
        for user in [logged_in_member, logged_in_admin]:
            with pytest.raises(RuntimeError) as exc_info:
                response, _ = user.gql(
                    _app,
                    query=self.QUERY,
                    operation_name="PatchTraceAnnotations",
                    variables={
                        "input": {
                            "annotationId": annotation_id,
                            "name": "patched-trace-annotation-name",
                            "annotatorKind": "LLM",
                            "label": "incorrect",
                            "score": 0,
                            "explanation": "patched-explanation",
                            "metadata": {"patched": "key"},
                            "identifier": "patched-identifier",
                        }
                    },
                )
            assert "At least one trace annotation is not associated with the current user." in str(
                exc_info.value
            )

            # Check that the annotation remains unchanged
            response, _ = user.gql(
                _app,
                query=self.QUERY,
                operation_name="GetTraceAnnotation",
                variables={"annotationId": annotation_id},
            )
            trace_annotation = response["data"]["traceAnnotation"]
            assert trace_annotation == original_trace_annotation

        # Member who did not create the annotation cannot delete
        with pytest.raises(RuntimeError) as exc_info:
            logged_in_member.gql(
                _app,
                query=self.QUERY,
                operation_name="DeleteTraceAnnotations",
                variables={
                    "input": {
                        "annotationIds": [annotation_id],
                    }
                },
            )
        assert (
            "At least one trace annotation is not associated with the current user "
            "and the current user is not an admin." in str(exc_info.value)
        )

        # Check that the annotation remains unchanged
        response, _ = user.gql(
            _app,
            query=self.QUERY,
            operation_name="GetTraceAnnotation",
            variables={"annotationId": annotation_id},
        )
        trace_annotation = response["data"]["traceAnnotation"]
        assert trace_annotation == original_trace_annotation

        # Admin can delete
        response, _ = logged_in_admin.gql(
            _app,
            query=self.QUERY,
            operation_name="DeleteTraceAnnotations",
            variables={
                "input": {
                    "annotationIds": [annotation_id],
                }
            },
        )


class TestApiAccessViaCookiesOrApiKeys:
    """Tests REST API v1 access control using both cookie and API key authentication.

    These comprehensive tests verify that access restrictions are enforced consistently
    across all user roles (Admin, Member, Viewer) at the v1 router level, regardless of
    authentication method used:
    - Cookie-based authentication (access tokens from login)
    - API key authentication (Bearer tokens)

    Test Coverage:
    - 28 GET endpoints across all major v1 routers (projects, datasets, experiments,
      prompts, annotation configs, evaluations, spans, annotations)
    - 3 admin-only endpoints (GET/POST/DELETE on /users)
    - 25 write operations (POST/PUT/DELETE) tested for viewer restrictions
    - All user roles: Admin, Member, Viewer, and Default Admin
    - Both authentication methods tested for each endpoint
    - Error handling: validates proper HTTP status codes (200, 404, 422) for both
      valid and invalid resource identifiers
    - Invalid ID format handling: ensures GlobalID parsing errors return 422 instead of 500

    Access Rules (enforced consistently for both cookies and API keys):
    - GET requests: Most common resources are readable by all roles (28 endpoints)
    - Admin-only endpoints: /users operations require admin role (3 endpoints, 403 for non-admins)
    - Write operations (POST/PUT/DELETE): Blocked for viewers (25 operations, all return 403)
    """

    # GET endpoints that all roles can read with expected status codes
    COMMON_RESOURCE_ENDPOINTS = [
        # Projects
        (404, "v1/projects/invalid-id-{}"),
        (200, "v1/projects"),
        # Datasets
        (422, "v1/datasets/invalid-id-{}"),
        (200, "v1/datasets"),
        (422, "v1/datasets/invalid-id-{}/versions"),
        (422, "v1/datasets/invalid-id-{}/examples"),
        (422, "v1/datasets/invalid-id-{}/csv"),
        (422, "v1/datasets/invalid-id-{}/jsonl/openai_ft"),
        (422, "v1/datasets/invalid-id-{}/jsonl/openai_evals"),
        # Experiments
        (422, "v1/experiments/invalid-id-{}"),
        (422, "v1/datasets/invalid-id-{}/experiments"),
        (422, "v1/experiments/invalid-id-{}/runs"),
        (422, "v1/experiments/invalid-id-{}/json"),
        (422, "v1/experiments/invalid-id-{}/csv"),
        # Prompts
        (200, "v1/prompts"),
        (200, "v1/prompts/invalid-id-{}/versions"),  # Treats as prompt name, returns empty list
        (422, "v1/prompt_versions/invalid-id-{}"),
        (404, "v1/prompts/invalid-id-{}/tags/test-tag"),
        (404, "v1/prompts/invalid-id-{}/latest"),
        (422, "v1/prompt_versions/invalid-id-{}/tags"),
        # Annotation configs
        (200, "v1/annotation_configs"),
        (404, "v1/annotation_configs/invalid-id-{}"),
        # Evaluations
        (404, "v1/evaluations"),  # Returns 404 when no project_name provided
        # Spans (project-scoped)
        (404, "v1/projects/invalid-id-{}/spans"),
        (404, "v1/projects/invalid-id-{}/spans/otlpv1"),
        # Annotations (project-scoped) - require query params
        (422, "v1/projects/invalid-id-{}/span_annotations"),
        (422, "v1/projects/invalid-id-{}/trace_annotations"),
        (422, "v1/projects/invalid-id-{}/session_annotations"),
    ]

    # Admin-only endpoints (GET and write operations)
    # Non-admins should receive 403 regardless of request validity
    ADMIN_ONLY_ENDPOINTS = [
        ("GET", "v1/users"),
        ("POST", "v1/users"),
        ("DELETE", "v1/users/invalid-id-{}"),
    ]

    # Write operations that viewers should be blocked from
    VIEWER_BLOCKED_WRITE_OPERATIONS = [
        # POST routes
        ("POST", "v1/annotation_configs"),
        ("POST", "v1/datasets/upload"),
        ("POST", "v1/datasets/invalid-id-{}/experiments"),
        ("POST", "v1/document_annotations"),
        ("POST", "v1/evaluations"),
        ("POST", "v1/experiment_evaluations"),
        ("POST", "v1/experiments/invalid-id-{}/runs"),
        ("POST", "v1/projects"),
        ("POST", "v1/projects/invalid-id-{}/spans"),
        ("POST", "v1/prompts"),
        ("POST", "v1/prompt_versions/invalid-id-{}/tags"),
        ("POST", "v1/session_annotations"),
        ("POST", "v1/span_annotations"),
        ("POST", "v1/spans"),
        ("POST", "v1/trace_annotations"),
        ("POST", "v1/traces"),
        ("POST", "v1/users"),
        # PUT routes
        ("PUT", "v1/annotation_configs/invalid-id-{}"),
        ("PUT", "v1/projects/invalid-id-{}"),
        # DELETE routes
        ("DELETE", "v1/annotation_configs/invalid-id-{}"),
        ("DELETE", "v1/datasets/invalid-id-{}"),
        ("DELETE", "v1/projects/invalid-id-{}"),
        ("DELETE", "v1/spans/invalid-id-{}"),
        ("DELETE", "v1/traces/invalid-id-{}"),
        ("DELETE", "v1/users/invalid-id-{}"),
    ]

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_all_roles_can_read_common_resources(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that all roles can read common v1 API resources using cookies or API keys.

        This test verifies comprehensive read access across 28 GET endpoints covering:
        - Projects, Datasets, Experiments, Prompts, Annotation Configs
        - Evaluations, Spans, and Annotations

        Tests both valid endpoints (200 responses) and error cases:
        - 404: Non-existent resources or missing required parameters
        - 422: Invalid ID format (ensures GlobalID errors are handled properly)

        Authentication verification:
        Tests each endpoint with BOTH authentication methods to ensure consistent behavior:
        1. Cookie-based authentication (session tokens)
        2. API key authentication (Bearer tokens)

        Both methods should return the same status code, verifying that authorization
        is enforced consistently regardless of authentication method.

        Uses dynamic invalid IDs (token_hex) to ensure test isolation and verify
        server-side error handling returns appropriate status codes instead of 500.
        """
        user = _get_user(_app, role_or_user)
        logged_in_user = user.log_in(_app)
        api_key = logged_in_user.create_api_key(_app)
        tokens = logged_in_user.tokens

        for expected_status_code, endpoint in self.COMMON_RESOURCE_ENDPOINTS:
            assert expected_status_code not in (401, 403), (
                f"Test misconfiguration: expected_status_code should not be "
                f"401 or 403 (got {expected_status_code} for {endpoint})"
            )
            endpoint = endpoint.format(token_hex(4))
            for client in (
                _httpx_client(_app, tokens),
                _httpx_client(_app, api_key),
            ):
                response = client.get(endpoint)
                assert response.status_code == expected_status_code, (
                    f"Expected {expected_status_code} but got {response.status_code} for {endpoint}"
                )

    @pytest.mark.parametrize("role_or_user", list(UserRoleInput) + [_DEFAULT_ADMIN])
    def test_only_admins_can_access_admin_only_endpoints(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that only admins can access admin-restricted endpoints with any auth method.

        Admin-only endpoints (GET/POST/DELETE on /v1/users) require admin role via the
        require_admin dependency. Members and Viewers should receive 403 Forbidden when
        accessing these endpoints, regardless of whether they use cookies or API keys.

        This test covers 3 admin-only operations:
        - GET /v1/users (list users)
        - POST /v1/users (create user)
        - DELETE /v1/users/{id} (delete user)

        Authentication verification:
        Tests with BOTH authentication methods to ensure consistent behavior:
        1. Cookie-based authentication (session tokens)
        2. API key authentication (Bearer tokens)

        Expected behavior (consistent across both auth methods):
        - Admins: Access granted (may get validation errors like 422 for invalid data, but not 403)
        - Members/Viewers: 403 Forbidden (authorization denied before validation)

        This verifies that role-based authorization is enforced consistently
        regardless of authentication method.
        """
        user = _get_user(_app, role_or_user)
        logged_in_user = user.log_in(_app)
        api_key = logged_in_user.create_api_key(_app)
        tokens = logged_in_user.tokens
        is_admin = user.role is UserRoleInput.ADMIN or role_or_user is _DEFAULT_ADMIN

        for method, endpoint in self.ADMIN_ONLY_ENDPOINTS:
            endpoint = endpoint.format(token_hex(4))
            for client in (
                _httpx_client(_app, tokens),
                _httpx_client(_app, api_key),
            ):
                response = client.request(method, endpoint)
                if is_admin:
                    # Admins should NOT get 403 (may get other errors like 422 for invalid data)
                    assert response.status_code != 403, (
                        f"Admin got 403 for {method} {endpoint}, expected access granted"
                    )
                else:
                    # Non-admins should always get 403
                    assert response.status_code == 403, (
                        f"Non-admin expected 403 but got {response.status_code} "
                        f"for {method} {endpoint}"
                    )

    def test_viewers_blocked_from_all_write_operations(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Test that viewers are blocked from all write operations with any auth method.

        Viewers have read-only access and must receive 403 Forbidden for any
        POST, PUT, or DELETE requests across all v1 API endpoints, regardless
        of whether they authenticate with cookies or API keys.

        This test covers 25 write operations across:
        - Projects, Datasets, Experiments, Prompts
        - Annotations (span, trace, session, document)
        - Evaluations, Spans, Traces, Users
        - 17 POST operations, 2 PUT operations, 6 DELETE operations

        Authentication verification:
        Tests each write operation with BOTH authentication methods to ensure consistent behavior:
        1. Cookie-based authentication (session tokens)
        2. API key authentication (Bearer tokens)

        Expected behavior (consistent across both auth methods):
        - All 25 write operations return 403 Forbidden for viewers

        This verifies that viewer write restrictions are enforced consistently
        regardless of authentication method. Viewers remain read-only whether
        they use cookies or API keys.
        """
        user = _get_user(_app, _VIEWER)
        logged_in_user = user.log_in(_app)
        api_key = logged_in_user.create_api_key(_app)
        tokens = logged_in_user.tokens

        for method, endpoint in self.VIEWER_BLOCKED_WRITE_OPERATIONS:
            endpoint = endpoint.format(token_hex(4))
            for client in (
                _httpx_client(_app, tokens),
                _httpx_client(_app, api_key),
            ):
                response = client.request(method, endpoint)
                assert response.status_code == 403, (
                    f"Expected 403 but got {response.status_code} for {method} {endpoint}"
                )
