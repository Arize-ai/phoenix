"""Comprehensive OIDC authentication integration tests.

This module contains all OIDC-related tests organized by functionality:
- TestBasicFlow: Standard OIDC authentication flows
- TestPKCE: Proof Key for Code Exchange flows
- TestRoleMapping: Role extraction and mapping from OIDC claims
- TestMockOIDCServer: Mock server behavior verification
"""

from __future__ import annotations

from random import choice
from secrets import token_hex
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.auth import sanitize_email
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from .._helpers import (
    _AppInfo,
    _create_user,
    _delete_users,
    _httpx_client,
    _list_users,
    _OIDCServer,
    _Profile,
    _randomize_casing,
)

# =============================================================================
# Shared Helper Functions
# =============================================================================


async def _start_flow(
    app: _AppInfo,
    oidc_server: _OIDCServer,
    path_suffix: str = "",
) -> tuple[str, dict[str, str]]:
    """Start OIDC flow and return (auth_url, cookies)."""
    client = _httpx_client(app)
    response = client.post(f"oauth2/{oidc_server}{path_suffix}/login")
    assert response.status_code == 302

    auth_url = response.headers["location"]
    cookies = dict(response.cookies)

    return auth_url, cookies


async def _get_callback_url(app: _AppInfo, auth_url: str) -> str:
    """Follow redirect to IDP and get callback URL."""
    client = _httpx_client(app)
    response = client.get(auth_url)
    assert response.status_code == 302
    return response.headers["location"]


async def _complete_flow(
    app: _AppInfo,
    oidc_server: _OIDCServer,
    path_suffix: str = "",
) -> tuple[str, dict[str, str], str]:
    """Complete OIDC flow and return (email, cookies, callback_url).

    Note: The email is only available AFTER following the redirect to the IDP,
    as the OIDC server sets user_email during the authorization request.
    """
    auth_url, cookies = await _start_flow(app, oidc_server, path_suffix)
    callback_url = await _get_callback_url(app, auth_url)

    # Email is now available after the IDP has processed the auth request
    assert oidc_server.user_email is not None, "OIDC server should have user_email"
    email = sanitize_email(oidc_server.user_email)

    return email, cookies, callback_url


async def _exchange_code_for_tokens(
    app: _AppInfo,
    cookies: dict[str, str],
    callback_url: str,
) -> tuple[int, Optional[str], Optional[str]]:
    """Exchange authorization code for tokens."""
    response = _httpx_client(app, cookies=cookies).get(callback_url)
    return (
        response.status_code,
        response.cookies.get("phoenix-access-token"),
        response.cookies.get("phoenix-refresh-token"),
    )


def _verify_tokens_issued(
    status_code: int,
    access_token: Optional[str],
    refresh_token: Optional[str],
) -> None:
    """Verify tokens were successfully issued."""
    assert status_code == 302
    assert access_token is not None
    assert refresh_token is not None


def _verify_access_denied(
    status_code: int,
    access_token: Optional[str],
    redirect_location: str,
) -> None:
    """Verify access was denied and user redirected to login."""
    assert status_code == 307
    assert "/login" in redirect_location
    assert access_token is None


def _verify_sensitive_cookies_cleaned(set_cookie_headers: list[str]) -> None:
    """Verify sensitive cookies (state, nonce) are cleaned up."""
    assert any("phoenix-oauth2-state=" in h and "Max-Age=0" in h for h in set_cookie_headers)
    assert any("phoenix-oauth2-nonce=" in h and "Max-Age=0" in h for h in set_cookie_headers)


def _verify_pkce_cookie_cleaned(set_cookie_headers: list[str]) -> None:
    """Verify PKCE code_verifier cookie is cleaned up."""
    assert any(
        "phoenix-oauth2-code-verifier=" in h and "Max-Age=0" in h for h in set_cookie_headers
    )


async def _verify_user_exists_with_role(
    app: _AppInfo,
    email: str,
    expected_role: UserRoleInput,
    cleanup: bool = False,
) -> None:
    """Verify user exists and has expected role, optionally cleaning up after."""
    users = {u.profile.email: u for u in _list_users(app, app.admin_secret)}
    assert email in users, f"User {email} should exist but was not found"
    assert users[email].role is expected_role, (
        f"Expected role {expected_role}, got {users[email].role}"
    )

    if cleanup:
        _delete_users(app, app.admin_secret, users=[users[email]])


async def _verify_user_does_not_exist(
    app: _AppInfo,
    email: str,
) -> None:
    """Verify user does not exist."""
    users = {u.profile.email: u for u in _list_users(app, app.admin_secret)}
    assert email not in users, f"User {email} should not exist but was found"


async def _verify_user_granted_with_role(
    app: _AppInfo,
    email: str,
    cookies: dict[str, str],
    callback_url: str,
    expected_role: UserRoleInput,
    cleanup: bool = True,
) -> None:
    """Verify user is granted access and assigned the expected role."""
    status, access_token, _ = await _exchange_code_for_tokens(app, cookies, callback_url)
    _verify_tokens_issued(status, access_token, _)
    await _verify_user_exists_with_role(app, email, expected_role, cleanup=cleanup)


async def _verify_user_denied(
    app: _AppInfo,
    email: str,
    cookies: dict[str, str],
    callback_url: str,
) -> None:
    """Verify user is denied access and not created."""
    response = _httpx_client(app, cookies=cookies).get(callback_url)
    _verify_access_denied(
        response.status_code,
        response.cookies.get("phoenix-access-token"),
        response.headers["location"],
    )
    await _verify_user_does_not_exist(app, email)


# =============================================================================
# Test Classes
# =============================================================================


class TestBasicFlow:
    """Tests for standard OIDC authentication flows."""

    @pytest.mark.parametrize("allow_sign_up", [True, False])
    async def test_sign_in(
        self,
        allow_sign_up: bool,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test complete OIDC sign-in flow with different allow_sign_up settings."""
        path_suffix = "" if allow_sign_up else "_no_sign_up"

        # Start flow
        auth_url, cookies = await _start_flow(_app, _oidc_server, path_suffix)
        callback_url = await _get_callback_url(_app, auth_url)

        # Email is now available after IDP processed the auth request
        assert _oidc_server.user_email is not None
        email = sanitize_email(_oidc_server.user_email)

        # Verify user doesn't exist yet
        await _verify_user_does_not_exist(_app, email)

        # Exchange code for tokens
        status, access_token, refresh_token = await _exchange_code_for_tokens(
            _app, cookies, callback_url
        )

        if not allow_sign_up:
            # Verify access denied
            response = _httpx_client(_app, cookies=cookies).get(callback_url)
            _verify_access_denied(status, access_token, response.headers["location"])
            _verify_sensitive_cookies_cleaned(response.headers.get_list("set-cookie"))

            # Create user without password
            case_insensitive_email = _randomize_casing(email)
            expected_role: UserRoleInput = choice(list(UserRoleInput))
            _create_user(
                _app,
                _app.admin_secret,
                role=expected_role,
                profile=_Profile(case_insensitive_email, "", token_hex(8)),
                local=False,
            )

            # Try again - should succeed
            status, access_token, refresh_token = await _exchange_code_for_tokens(
                _app, cookies, callback_url
            )
        else:
            expected_role = UserRoleInput.VIEWER

        # Verify tokens issued and user created with expected role
        _verify_tokens_issued(status, access_token, refresh_token)
        await _verify_user_exists_with_role(_app, email, expected_role)

        # Verify role preserved on subsequent login (critical for backward compatibility)
        status2, access_token2, refresh_token2 = await _exchange_code_for_tokens(
            _app, cookies, callback_url
        )
        _verify_tokens_issued(status2, access_token2, refresh_token2)
        assert access_token2 != access_token
        await _verify_user_exists_with_role(_app, email, expected_role)

    @pytest.mark.parametrize("allow_sign_up", [True, False])
    async def test_sign_in_conflict_for_local_user_with_password(
        self,
        allow_sign_up: bool,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that users with passwords cannot sign in via OIDC."""
        path_suffix = "" if allow_sign_up else "_no_sign_up"

        # Start flow
        email, cookies, callback_url = await _complete_flow(_app, _oidc_server, path_suffix)

        # Verify user doesn't exist
        await _verify_user_does_not_exist(_app, email)

        # Create user with password
        _create_user(
            _app,
            _app.admin_secret,
            role=UserRoleInput.VIEWER,
            profile=_Profile(email, token_hex(8), token_hex(8)),
            local=True,
        )

        # Verify OIDC sign-in is rejected
        response = _httpx_client(_app, cookies=cookies).get(callback_url)
        _verify_access_denied(
            response.status_code,
            response.cookies.get("phoenix-access-token"),
            response.headers["location"],
        )
        # User SHOULD exist (we just created them), but OIDC sign-in should be rejected
        await _verify_user_exists_with_role(_app, email, UserRoleInput.VIEWER)

    async def test_state_mismatch_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that state parameter mismatch is rejected (CSRF protection)."""
        auth_url, cookies = await _start_flow(_app, _oidc_server)

        # Tamper with state cookie
        cookies["phoenix-oauth2-state"] = "tampered_state_value"

        callback_url = await _get_callback_url(_app, auth_url)

        # Email is now available
        assert _oidc_server.user_email is not None
        email = sanitize_email(_oidc_server.user_email)

        await _verify_user_denied(_app, email, cookies, callback_url)

    async def test_missing_state_cookie_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that missing state cookie is rejected."""
        auth_url, cookies = await _start_flow(_app, _oidc_server)
        callback_url = await _get_callback_url(_app, auth_url)

        # Try to complete flow WITHOUT cookies (simulating deleted cookies)
        response = _httpx_client(_app).get(callback_url)

        # Verify proper error handling (422 for missing cookie)
        assert response.status_code == 422

    async def test_nonce_mismatch_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that nonce parameter mismatch is rejected (replay attack protection)."""
        auth_url, cookies = await _start_flow(_app, _oidc_server)

        # Tamper with nonce cookie
        cookies["phoenix-oauth2-nonce"] = "tampered_nonce_value"

        callback_url = await _get_callback_url(_app, auth_url)

        # Email is now available
        assert _oidc_server.user_email is not None
        email = sanitize_email(_oidc_server.user_email)

        # Nonce validation should fail and deny access
        await _verify_user_denied(_app, email, cookies, callback_url)

    async def test_unsafe_return_url_is_rejected(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that unsafe return URLs are rejected (open redirect protection)."""
        client = _httpx_client(_app)

        # Try to use external URL as return_to parameter
        response = client.post(f"oauth2/{_oidc_server}/login?return_to=https://evil.com/phishing")
        assert response.status_code == 302

        auth_url = response.headers["location"]
        callback_url = await _get_callback_url(_app, auth_url)

        # Exchange code - should succeed but not redirect to evil.com
        response = _httpx_client(_app, cookies=dict(response.cookies)).get(callback_url)
        assert response.status_code == 302

        # CRITICAL: Verify redirect location is safe (not the malicious URL)
        redirect_location = response.headers["location"]
        assert "evil.com" not in redirect_location, (
            "Open redirect vulnerability: redirected to malicious URL!"
        )
        # Should redirect to a safe default (e.g., root path)
        assert redirect_location.startswith("/"), "Redirect should be to a relative path"

    async def test_unknown_idp_is_rejected(self, _app: _AppInfo) -> None:
        """Test that unknown IDP names are rejected."""
        client = _httpx_client(_app)
        response = client.post("oauth2/unknown_idp_that_does_not_exist/login")
        # Should redirect to /login with error
        assert response.status_code == 307
        assert "/login" in response.headers["location"]

    async def test_cookie_security_attributes(
        self,
        _oidc_server: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that OAuth2 cookies have proper security attributes."""
        client = _httpx_client(_app)
        response = client.post(f"oauth2/{_oidc_server}/login")

        set_cookie_headers = response.headers.get_list("set-cookie")

        # Verify security attributes on state cookie
        state_cookie = [h for h in set_cookie_headers if "phoenix-oauth2-state=" in h][0]
        assert "HttpOnly" in state_cookie
        assert "SameSite=lax" in state_cookie or "SameSite=Lax" in state_cookie
        assert "Path=/" in state_cookie

        # Verify security attributes on nonce cookie
        nonce_cookie = [h for h in set_cookie_headers if "phoenix-oauth2-nonce=" in h][0]
        assert "HttpOnly" in nonce_cookie
        assert "SameSite=lax" in nonce_cookie or "SameSite=Lax" in nonce_cookie
        assert "Path=/" in nonce_cookie

    async def test_oidc_with_groups_access_granted(
        self,
        _oidc_server_standard_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test OIDC with group-based access control - access granted."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_standard_with_groups, "_granted"
        )

        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.VIEWER
        )

    async def test_oidc_with_groups_access_denied(
        self,
        _oidc_server_standard_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test OIDC with group-based access control - access denied."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_standard_with_groups, "_denied"
        )

        await _verify_user_denied(_app, email, cookies, callback_url)


class TestPKCE:
    """Tests for PKCE (Proof Key for Code Exchange) OAuth2 flows."""

    async def test_pkce_public_client_flow(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE flow with public client (no client_secret)."""
        client = _httpx_client(_app)

        # Start flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        assert response.status_code == 302
        cookies = dict(response.cookies)

        # Verify PKCE cookies set
        assert "phoenix-oauth2-state" in cookies
        assert "phoenix-oauth2-nonce" in cookies
        assert "phoenix-oauth2-code-verifier" in cookies

        # Get callback URL
        auth_url = response.headers["location"]
        callback_url = await _get_callback_url(_app, auth_url)

        assert _oidc_server_pkce_public.user_email is not None
        email = sanitize_email(_oidc_server_pkce_public.user_email)
        await _verify_user_does_not_exist(_app, email)

        # Exchange code
        response = _httpx_client(_app, cookies=cookies).get(callback_url)
        _verify_tokens_issued(
            response.status_code,
            response.cookies.get("phoenix-access-token"),
            response.cookies.get("phoenix-refresh-token"),
        )

        # Verify sensitive cookies cleaned
        set_cookie_headers = response.headers.get_list("set-cookie")
        _verify_sensitive_cookies_cleaned(set_cookie_headers)
        _verify_pkce_cookie_cleaned(set_cookie_headers)

        await _verify_user_exists_with_role(_app, email, UserRoleInput.VIEWER)

    async def test_pkce_confidential_client_flow(
        self,
        _oidc_server_pkce_confidential: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE flow with confidential client (has client_secret)."""
        email, cookies, callback_url = await _complete_flow(_app, _oidc_server_pkce_confidential)

        # Verify PKCE cookie set
        assert "phoenix-oauth2-code-verifier" in cookies

        # Exchange code
        response = _httpx_client(_app, cookies=cookies).get(callback_url)
        _verify_tokens_issued(
            response.status_code,
            response.cookies.get("phoenix-access-token"),
            response.cookies.get("phoenix-refresh-token"),
        )

        # Verify cookies cleaned
        set_cookie_headers = response.headers.get_list("set-cookie")
        _verify_sensitive_cookies_cleaned(set_cookie_headers)
        _verify_pkce_cookie_cleaned(set_cookie_headers)

        await _verify_user_exists_with_role(_app, email, UserRoleInput.VIEWER)

    async def test_pkce_code_verifier_mismatch_rejected(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that PKCE code_verifier mismatch is rejected."""
        client = _httpx_client(_app)

        # Start flow
        response = client.post(f"oauth2/{_oidc_server_pkce_public}/login")
        cookies = dict(response.cookies)

        # Tamper with code_verifier cookie
        cookies["phoenix-oauth2-code-verifier"] = "tampered_verifier_value"

        # Get callback URL
        auth_url = response.headers["location"]
        callback_url = await _get_callback_url(_app, auth_url)

        assert _oidc_server_pkce_public.user_email is not None
        email = sanitize_email(_oidc_server_pkce_public.user_email)
        await _verify_user_denied(_app, email, cookies, callback_url)

    async def test_pkce_wrong_code_verifier_is_rejected(
        self,
        _oidc_server_pkce_public: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test that wrong PKCE code_verifier is rejected by IDP."""
        auth_url, cookies = await _start_flow(_app, _oidc_server_pkce_public)

        # Replace code_verifier with wrong value
        cookies["phoenix-oauth2-code-verifier"] = "wrong_verifier_1234567890"

        callback_url = await _get_callback_url(_app, auth_url)

        assert _oidc_server_pkce_public.user_email is not None
        email = sanitize_email(_oidc_server_pkce_public.user_email)

        await _verify_user_denied(_app, email, cookies, callback_url)

    async def test_pkce_with_groups_access_granted(
        self,
        _oidc_server_pkce_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE with group-based access control - access granted."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_pkce_with_groups, "_granted"
        )

        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.VIEWER
        )

    async def test_pkce_with_groups_access_denied(
        self,
        _oidc_server_pkce_with_groups: _OIDCServer,
        _app: _AppInfo,
    ) -> None:
        """Test PKCE with group-based access control - access denied."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_pkce_with_groups, "_denied"
        )

        await _verify_user_denied(_app, email, cookies, callback_url)


class TestRoleMapping:
    """Tests for OAuth2/OIDC role mapping functionality."""

    async def test_role_mapping_admin(
        self, _oidc_server_with_role_admin: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test role mapping: IDP role 'Owner' → Phoenix role ADMIN."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_with_role_admin, "_admin"
        )
        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.ADMIN
        )

    async def test_role_mapping_member(
        self, _oidc_server_with_role_member: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test role mapping: IDP role 'Developer' → Phoenix role MEMBER."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_with_role_member, "_member"
        )
        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.MEMBER
        )

    async def test_role_mapping_viewer(
        self, _oidc_server_with_role_viewer: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test role mapping: IDP role 'Reader' → Phoenix role VIEWER."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_with_role_viewer, "_viewer"
        )
        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.VIEWER
        )

    async def test_invalid_role_defaults_to_viewer_non_strict(
        self, _oidc_server_with_invalid_role: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test invalid role defaults to VIEWER in non-strict mode (least privilege)."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_with_invalid_role, "_invalid"
        )
        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.VIEWER
        )

    async def test_invalid_role_denies_access_strict_mode(
        self, _oidc_server_with_invalid_role: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test invalid role denies access in strict mode."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_with_invalid_role, "_strict"
        )
        await _verify_user_denied(_app, email, cookies, callback_url)

    async def test_missing_role_defaults_to_viewer(
        self, _oidc_server_without_role: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test missing role defaults to VIEWER (no role mapping configured)."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_without_role, "_default"
        )
        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.VIEWER
        )

    async def test_system_role_cannot_be_assigned_via_oidc(
        self, _oidc_server_with_role_system: _OIDCServer, _app: _AppInfo
    ) -> None:
        """Test SYSTEM role from IDP defaults to VIEWER (SYSTEM is internal-only)."""
        email, cookies, callback_url = await _complete_flow(
            _app, _oidc_server_with_role_system, "_system"
        )
        await _verify_user_granted_with_role(
            _app, email, cookies, callback_url, UserRoleInput.VIEWER
        )


class TestMockOIDCServer:
    """Tests for mock _OIDCServer behavior (not Phoenix)."""

    async def test_pkce_server_rejects_non_pkce_flow(
        self,
        _oidc_server_pkce_public: _OIDCServer,
    ) -> None:
        """Test that mock PKCE-enabled server rejects token requests without code_verifier."""
        from base64 import urlsafe_b64encode
        from hashlib import sha256

        client = httpx.Client(verify=False)

        # Start auth request with code_challenge
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
        callback_url = auth_response.headers["location"]
        query_params = parse_qs(urlparse(callback_url).query)
        auth_code = query_params["code"][0]

        # Try to exchange code for token WITHOUT code_verifier
        token_response = client.post(
            f"{_oidc_server_pkce_public.base_url}/token",
            data={
                "grant_type": "authorization_code",
                "code": auth_code,
                "redirect_uri": "http://localhost/callback",
                "client_id": _oidc_server_pkce_public.client_id,
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
        """Test that mock standard OIDC server rejects token requests with code_verifier."""
        client = httpx.Client(verify=False)

        # Get authorization code from server (standard flow, no code_challenge)
        auth_response = client.get(
            f"{_oidc_server_standard.base_url}/auth",
            params={
                "client_id": _oidc_server_standard.client_id,
                "response_type": "code",
                "redirect_uri": "http://localhost/callback",
                "state": "test_state",
            },
        )
        assert auth_response.status_code == 302

        # Extract authorization code from redirect
        callback_url = auth_response.headers["location"]
        query_params = parse_qs(urlparse(callback_url).query)
        auth_code = query_params["code"][0]

        # Try to exchange code for token WITH code_verifier
        token_response = client.post(
            f"{_oidc_server_standard.base_url}/token",
            data={
                "grant_type": "authorization_code",
                "code": auth_code,
                "redirect_uri": "http://localhost/callback",
                "client_id": _oidc_server_standard.client_id,
                "client_secret": _oidc_server_standard.client_secret,
                "code_verifier": "some_pkce_verifier_12345",
            },
        )

        # Server should reject the request
        assert token_response.status_code == 400
        error_data = token_response.json()
        assert error_data.get("error") == "invalid_request"
        assert "code_verifier" in error_data.get("error_description", "").lower()
