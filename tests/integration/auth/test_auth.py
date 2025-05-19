from asyncio import sleep
from collections import defaultdict
from collections.abc import Iterator, Sequence
from contextlib import AbstractContextManager
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from functools import partial
from secrets import token_hex
from typing import (
    Any,
    Generic,
    Literal,
    Optional,
    TypeVar,
)
from urllib.error import URLError
from urllib.parse import urljoin
from urllib.request import urlopen

import bs4
import jwt
import pytest
import smtpdfix
from httpx import HTTPStatusError
from opentelemetry.sdk.environment_variables import (
    OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_EXPORTER_OTLP_TRACES_HEADERS,
)
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExportResult
from phoenix.config import get_base_url, get_env_phoenix_admin_secret, get_env_root_url
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from strawberry.relay import GlobalID
from typing_extensions import assert_never

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
    _AccessToken,
    _ApiKey,
    _create_api_key,
    _create_user,
    _DefaultAdminTokenSequestration,
    _Email,
    _Expectation,
    _export_embeddings,
    _extract_html,
    _GetUser,
    _GqlId,
    _grpc_span_exporter,
    _Headers,
    _http_span_exporter,
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

    This class tests the OIDC signup process, including user creation,
    token generation, and handling of conflicts with existing users.
    """

    async def test_signup(
        self,
        _oidc_server: _OIDCServer,
    ) -> None:
        """Test the complete OIDC signup flow.

        Verifies that:
        1. The OAuth2 flow redirects correctly
        2. A new user is created with MEMBER role
        3. Access and refresh tokens are generated
        4. Subsequent OIDC flows generate new tokens
        """
        client = _httpx_client()

        # Start the OAuth2 flow
        response = client.post(f"oauth2/{_oidc_server}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]
        cookies = dict(response.cookies)  # Save cookies for reuse

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert (email := _oidc_server.user_email)
        admin = _DEFAULT_ADMIN.log_in()
        users = {u.profile.email: u for u in admin.list_users()}
        assert email not in users

        # Complete the flow by calling the token endpoint
        response = client.get(callback_url)
        assert response.status_code == 302

        # Verify we got access
        assert (access_token := response.cookies.get("phoenix-access-token"))
        assert (refresh_token := response.cookies.get("phoenix-refresh-token"))

        # Verify that the user was created
        users = {u.profile.email: u for u in admin.list_users()}
        assert email in users
        assert users[email].role is UserRoleInput.MEMBER

        # If user go through OIDC flow again, new access token should be created
        response = _httpx_client(cookies=cookies).get(callback_url)
        assert (new_access_token := response.cookies.get("phoenix-access-token"))
        assert (new_refresh_token := response.cookies.get("phoenix-refresh-token"))
        assert new_access_token != access_token
        assert new_refresh_token != refresh_token

    async def test_signup_conflict_for_local_user_with_password(
        self,
        _oidc_server: _OIDCServer,
    ) -> None:
        """Test OIDC signup when a user with the same email already exists.

        Verifies that:
        1. The system detects the email conflict
        2. The user is redirected to the login page
        3. No access tokens are granted
        """
        client = _httpx_client()

        # Start the OAuth2 flow
        response = client.post(f"oauth2/{_oidc_server}/login")
        assert response.status_code == 302
        auth_url = response.headers["location"]

        # Follow the redirect to the OIDC server
        response = client.get(auth_url)
        assert response.status_code == 302
        callback_url = response.headers["location"]

        # Verify that the user is not already created
        assert (email := _oidc_server.user_email)
        admin = _DEFAULT_ADMIN.log_in()
        users = {u.profile.email: u for u in admin.list_users()}
        assert email not in users

        # Create the user with password
        admin.create_user(profile=_Profile(email, token_hex(8), token_hex(8)))

        # Verify that user is redirected to /login
        response = client.get(callback_url)
        assert response.status_code == 307
        assert response.headers["location"].startswith("/login")

        # Verify no access is granted
        assert not response.cookies.get("phoenix-access-token")
        assert not response.cookies.get("phoenix-refresh-token")


class TestTLS:
    def test_non_tls_client_cannot_connect(self) -> None:
        with pytest.raises(URLError) as e:
            urlopen(get_base_url())
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
    ) -> None:
        resp = _httpx_client(headers=headers).get("/healthz")
        with expectation:
            resp.raise_for_status()


class TestLogIn:
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_can_log_in(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        u.log_in()

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_can_log_in_more_than_once_simultaneously(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        for _ in range(10):
            u.log_in()

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_cannot_log_in_with_empty_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        with _EXPECTATION_401:
            _log_in("", email=u.email)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_cannot_log_in_with_wrong_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
    ) -> None:
        u = _get_user(role_or_user)
        assert (wrong_password := next(_passwords)) != u.password
        with _EXPECTATION_401:
            _log_in(wrong_password, email=u.email)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_cannot_log_in_with_deleted_user(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
    ) -> None:
        admin_user = _get_user(UserRoleInput.ADMIN)
        user = _get_user(role_or_user)
        admin_user.delete_users(user)
        with _EXPECTATION_401:
            user.log_in()


class TestWelcomeEmail:
    @pytest.mark.parametrize("role", [_MEMBER, _ADMIN])
    @pytest.mark.parametrize("send_welcome_email", [True, False])
    def test_welcome_email_is_sent(
        self,
        role: UserRoleInput,
        send_welcome_email: bool,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        email = f"{token_hex(16)}@{token_hex(16)}.com"
        profile = _Profile(email=email, password=token_hex(8), username=token_hex(8))
        u = _create_user(
            _get_user(_ADMIN),
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
            assert url == urljoin(str(get_env_root_url()), "forgot-password")
        else:
            assert not _smtpd.messages or _smtpd.messages[-1]["to"] != u.email


class TestPasswordReset:
    def test_initiate_password_reset_does_not_reveal_whether_user_exists(
        self,
        _emails: Iterator[_Email],
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        email = next(_emails)
        assert not _initiate_password_reset(email, _smtpd, should_receive_email=False)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_initiate_password_reset_does_not_change_existing_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        assert u.initiate_password_reset(_smtpd)
        u.log_in()

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_password_reset_can_be_initiated_multiple_times(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        new_password = next(_passwords)
        assert new_password != u.password
        tokens = [u.initiate_password_reset(_smtpd) for _ in range(2)]
        assert sum(map(bool, tokens)) > 1
        for i, token in enumerate(tokens):
            assert token
            if i < len(tokens) - 1:
                with _EXPECTATION_401:
                    token.reset(new_password)
                continue
            # only the last one works
            token.reset(new_password)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_password_reset_can_be_initiated_immediately_after_password_reset(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        new_password = next(_passwords)
        assert new_password != u.password
        assert (token := u.initiate_password_reset(_smtpd))
        token.reset(new_password)
        assert u.initiate_password_reset(_smtpd)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_password_reset_token_is_single_use(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        new_password = next(_passwords)
        assert new_password != u.password
        newer_password = next(_passwords)
        assert newer_password != new_password
        assert (token := u.initiate_password_reset(_smtpd))
        token.reset(new_password)
        with _EXPECTATION_401:
            token.reset(newer_password)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_initiate_password_reset_and_then_reset_password_using_token_from_email(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        logged_in_user.create_api_key()
        assert (token := u.initiate_password_reset(_smtpd))
        new_password = next(_passwords)
        assert new_password != u.password
        token.reset(new_password)
        with _EXPECTATION_401:
            # old password should no longer work
            u.log_in()
        with _EXPECTATION_401:
            # old logged-in tokens should no longer work
            logged_in_user.create_api_key()
        # new password should work
        new_profile = replace(u.profile, password=new_password)
        new_u = replace(u, profile=new_profile)
        new_u.log_in()
        assert not _will_be_asked_to_reset_password(new_u)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_deleted_user_will_not_receive_email_after_initiating_password_reset(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        logged_in_user.create_api_key()
        _DEFAULT_ADMIN.delete_users(u)
        assert not u.initiate_password_reset(_smtpd, should_receive_email=False)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_deleted_user_cannot_reset_password_using_token_from_email(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
        _smtpd: smtpdfix.AuthController,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        logged_in_user.create_api_key()
        assert (token := u.initiate_password_reset(_smtpd))
        new_password = next(_passwords)
        assert new_password != u.password
        _DEFAULT_ADMIN.delete_users(u)
        with _EXPECTATION_401:
            token.reset(new_password)


class TestLogOut:
    def test_default_admin_cannot_log_out_during_testing(self) -> None:
        """
        This is not a functional test of Phoenix itself. Instead, it is intended to verify
        that the safeguard preventing the default admin from logging out during concurrent
        test runs is working as expected.
        """
        cls = _DefaultAdminTokenSequestration.exc_cls
        msg = _DefaultAdminTokenSequestration.message
        with pytest.raises(cls, match=msg):
            _DEFAULT_ADMIN.log_in().log_out()

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_can_log_out(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_users = [u.log_in() for _ in range(2)]
        for logged_in_user in logged_in_users:
            logged_in_user.create_api_key()
        logged_in_users[0].log_out()
        for logged_in_user in logged_in_users:
            with _EXPECTATION_401:
                logged_in_user.create_api_key()

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_can_log_out_with_only_refresh_token(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        refresh_token = u.log_in().tokens.refresh_token
        refresh_token.log_out()

    def test_log_out_does_not_raise_exception(self) -> None:
        _log_out()


class TestLoggedInTokens:
    class _JtiSet(Generic[_TokenT]):
        def __init__(self) -> None:
            self._set: set[str] = set()

        def add(self, token: _TokenT) -> None:
            assert (jti := _decode_jwt(token)["jti"]) not in self._set
            self._set.add(jti)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_logged_in_tokens_should_change_after_log_out(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        access_tokens = self._JtiSet[_AccessToken]()
        refresh_tokens = self._JtiSet[_RefreshToken]()
        u = _get_user(role_or_user)
        for _ in range(2):
            with u.log_in() as logged_in_user:
                access_tokens.add(logged_in_user.tokens.access_token)
                refresh_tokens.add(logged_in_user.tokens.refresh_token)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_logged_in_tokens_should_differ_between_users(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        _get_user: _GetUser,
    ) -> None:
        access_tokens = self._JtiSet[_AccessToken]()
        refresh_tokens = self._JtiSet[_RefreshToken]()
        u = _get_user(role_or_user)
        with u.log_in() as logged_in_user:
            access_tokens.add(logged_in_user.tokens.access_token)
            refresh_tokens.add(logged_in_user.tokens.refresh_token)
        other_user = _get_user(role)
        with other_user.log_in() as logged_in_user:
            access_tokens.add(logged_in_user.tokens.access_token)
            refresh_tokens.add(logged_in_user.tokens.refresh_token)

    def test_corrupt_tokens_are_not_accepted(self) -> None:
        parts = _DEFAULT_ADMIN.log_in().tokens.access_token.split(".")
        # delete last 3 characters because base64 could have up to 2 padding characters
        bad_headers = _AccessToken(f"{parts[0][:-3]}.{parts[1]}.{parts[2]}")
        with _EXPECTATION_401:
            _create_api_key(bad_headers)
        bad_payload = _AccessToken(f"{parts[0]}.{parts[1][:-3]}.{parts[2]}")
        with _EXPECTATION_401:
            _create_api_key(bad_payload)


class TestRefreshToken:
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    def test_end_to_end_credentials_flow(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_users: defaultdict[int, dict[int, _LoggedInUser]] = defaultdict(dict)

        # user logs into first browser
        logged_in_users[0][0] = u.log_in()
        # user creates api key in the first browser
        logged_in_users[0][0].create_api_key()
        # tokens are refreshed in the first browser
        logged_in_users[0][1] = logged_in_users[0][0].refresh()
        # user creates api key in the first browser
        logged_in_users[0][1].create_api_key()
        # refresh token is good for one use only
        with pytest.raises(HTTPStatusError):
            logged_in_users[0][0].refresh()
        # original access token is invalid after refresh
        with _EXPECTATION_401:
            logged_in_users[0][0].create_api_key()

        # user logs into second browser
        logged_in_users[1][0] = u.log_in()
        # user creates api key in the second browser
        logged_in_users[1][0].create_api_key()

        # user logs out in first browser
        logged_in_users[0][1].log_out()
        # user is logged out of both browsers
        with _EXPECTATION_401:
            logged_in_users[0][1].create_api_key()
        with _EXPECTATION_401:
            logged_in_users[1][0].create_api_key()


class TestCreateUser:
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_cannot_create_user_without_access(
        self,
        role: UserRoleInput,
        _profiles: Iterator[_Profile],
    ) -> None:
        profile = next(_profiles)
        with _EXPECTATION_401:
            _create_user(role=role, profile=profile)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        profile = next(_profiles)
        with expectation as e:
            new_user = logged_in_user.create_user(role, profile=profile)
        if not e:
            new_user.log_in()
            assert _will_be_asked_to_reset_password(new_user)


class TestPatchViewer:
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_cannot_patch_viewer_without_access(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        with _EXPECTATION_401:
            _patch_viewer(None, u.password, new_username="new_username")

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_cannot_change_password_without_current_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        new_password = next(_passwords)
        with pytest.raises(Exception):
            _patch_viewer(logged_in_user, None, new_password=new_password)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_cannot_change_password_with_wrong_current_password(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        assert (wrong_password := next(_passwords)) != logged_in_user.password
        new_password = next(_passwords)
        with pytest.raises(Exception):
            _patch_viewer(logged_in_user, wrong_password, new_password=new_password)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_change_password(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _passwords: Iterator[_Password],
    ) -> None:
        u = _get_user(role)
        logged_in_user = u.log_in()
        new_password = f"new_password_{next(_passwords)}"
        assert new_password != logged_in_user.password
        _patch_viewer(
            (old_token := logged_in_user.tokens),
            (old_password := logged_in_user.password),
            new_password=new_password,
        )
        another_password = f"another_password_{next(_passwords)}"
        with _EXPECTATION_401:
            # old tokens should no longer work
            _patch_viewer(old_token, new_password, new_password=another_password)
        with _EXPECTATION_401:
            # old password should no longer work
            u.log_in()
        new_profile = replace(u.profile, password=new_password)
        new_u = replace(u, profile=new_profile)
        new_tokens = new_u.log_in()
        assert not _will_be_asked_to_reset_password(new_u)
        with pytest.raises(Exception):
            # old password should no longer work, even with new tokens
            _patch_viewer(new_tokens, old_password, new_password=another_password)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_change_username(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _usernames: Iterator[_Username],
        _passwords: Iterator[_Password],
    ) -> None:
        u = _get_user(role)
        logged_in_user = u.log_in()
        new_username = f"new_username_{next(_usernames)}"
        _patch_viewer(logged_in_user, None, new_username=new_username)
        another_username = f"another_username_{next(_usernames)}"
        wrong_password = next(_passwords)
        assert wrong_password != logged_in_user.password
        _patch_viewer(logged_in_user, wrong_password, new_username=another_username)


class TestPatchUser:
    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    @pytest.mark.parametrize("new_role", list(UserRoleInput))
    def test_cannot_change_role_of_default_admin(
        self,
        role_or_user: _RoleOrUser,
        new_role: UserRoleInput,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        with pytest.raises(Exception, match="role"):
            logged_in_user.patch_user(_DEFAULT_ADMIN, new_role=new_role)

    def test_admin_cannot_change_role_for_self(
        self,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(_ADMIN)
        logged_in_user = u.log_in()
        with pytest.raises(Exception, match="role"):
            logged_in_user.patch_user(u, new_role=_MEMBER)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        non_self = _get_user(role)
        assert non_self.gid != logged_in_user.gid
        with _EXPECTATION_401:
            _patch_user(non_self, new_role=new_role)
        with expectation:
            logged_in_user.patch_user(non_self, new_role=new_role)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        non_self = _get_user(role)
        assert non_self.gid != logged_in_user.gid
        old_password = non_self.password
        new_password = f"new_password_{next(_passwords)}"
        assert new_password != old_password
        with _EXPECTATION_401:
            _patch_user(non_self, new_password=new_password)
        with expectation as e:
            logged_in_user.patch_user(non_self, new_password=new_password)
        if e:
            # password should still work
            non_self.log_in()
            return
        with _EXPECTATION_401:
            # old password should no longer work
            non_self.log_in()
        new_profile = replace(non_self.profile, password=new_password)
        new_non_self = replace(non_self, profile=new_profile)
        new_non_self.log_in()
        assert _will_be_asked_to_reset_password(new_non_self)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        non_self = _get_user(role)
        assert non_self.gid != logged_in_user.gid
        old_username = non_self.username
        new_username = f"new_username_{next(_usernames)}"
        assert new_username != old_username
        with _EXPECTATION_401:
            _patch_user(non_self, new_username=new_username)
        with expectation:
            logged_in_user.patch_user(non_self, new_username=new_username)


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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        with expectation:
            logged_in_user.delete_users(_SYSTEM_USER_GID)

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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        with expectation:
            logged_in_user.delete_users(_DEFAULT_ADMIN)
        _DEFAULT_ADMIN.log_in()

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        non_self = _get_user(role)
        with expectation as e:
            logged_in_user.delete_users(non_self)
        if e:
            non_self.log_in()
        else:
            with _EXPECTATION_401:
                non_self.log_in()

    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    def test_error_is_raised_when_deleting_a_non_existent_user_id(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        phantom = _GqlId(GlobalID(type_name="User", node_id=str(999_999_999)))
        user = _get_user()
        with pytest.raises(Exception, match="Some user IDs could not be found"):
            logged_in_user.delete_users(phantom, user)
        user.log_in()

    @pytest.mark.parametrize("role_or_user", [_ADMIN, _DEFAULT_ADMIN])
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_deletion_deletes_all_tokens(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        _get_user: _GetUser,
        _spans: Sequence[ReadableSpan],
    ) -> None:
        u = _get_user(role_or_user)
        doer = u.log_in()
        user = _get_user(role)
        logged_in_user = user.log_in()
        tokens = logged_in_user.tokens
        user_api_key = logged_in_user.create_api_key()
        headers = dict(authorization=f"Bearer {user_api_key}")
        exporters = [
            _http_span_exporter(headers=headers),
            _grpc_span_exporter(headers=headers),
        ]
        for exporter in exporters:
            assert exporter.export(_spans) is SpanExportResult.SUCCESS
        doer.delete_users(user)
        for exporter in exporters:
            assert exporter.export(_spans) is SpanExportResult.FAILURE
        with _EXPECTATION_401:
            logged_in_user.create_api_key()
        with _EXPECTATION_401:
            tokens.refresh()


class TestCreateApiKey:
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_create_user_api_key(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        logged_in_user.create_api_key()

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        with expectation:
            logged_in_user.create_api_key("System")


class TestDeleteApiKey:
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_delete_user_api_key(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        api_key = logged_in_user.create_api_key()
        logged_in_user.delete_api_key(api_key)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_only_admin_can_delete_user_api_key_for_non_self(
        self,
        role_or_user: _RoleOrUser,
        role: UserRoleInput,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        non_self = _get_user(role).log_in()
        assert non_self.gid != logged_in_user.gid
        api_key = non_self.create_api_key()
        with expectation:
            logged_in_user.delete_api_key(api_key)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        api_key = _DEFAULT_ADMIN.create_api_key("System")
        with expectation:
            logged_in_user.delete_api_key(api_key)


class TestGraphQLQuery:
    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        with expectation:
            logged_in_user.gql(query)

    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_can_query_user_node_for_self(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        query = 'query{node(id:"' + u.gid + '"){__typename}}'
        logged_in_user.gql(query)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
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
    ) -> None:
        u = _get_user(role_or_user)
        logged_in_user = u.log_in()
        non_self = _get_user(role)
        query = 'query{node(id:"' + non_self.gid + '"){__typename}}'
        with expectation:
            logged_in_user.gql(query)


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
    @pytest.mark.parametrize("method", ["headers", "setenv"])
    def test_api_key(
        self,
        method: Literal["headers", "setenv"],
        use_api_key: bool,
        expires_at: Optional[datetime],
        expected: SpanExportResult,
        _span_exporter: _SpanExporterFactory,
        _spans: Sequence[ReadableSpan],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv(OTEL_EXPORTER_OTLP_HEADERS, False)
        monkeypatch.delenv(OTEL_EXPORTER_OTLP_TRACES_HEADERS, False)
        headers: Optional[_Headers] = None
        api_key: Optional[_ApiKey] = None
        if use_api_key:
            api_key = _DEFAULT_ADMIN.create_api_key("System", expires_at=expires_at)
            if method == "headers":
                # Must use all lower case for `authorization` because
                # otherwise it would crash the gRPC receiver.
                headers = dict(authorization=f"Bearer {api_key}")
            elif method == "setenv":
                monkeypatch.setenv(
                    OTEL_EXPORTER_OTLP_TRACES_HEADERS,
                    f"Authorization=Bearer {api_key}",
                )
            else:
                assert_never(method)
        export = _span_exporter(headers=headers).export
        for _ in range(2):
            assert export(_spans) is expected
        if api_key and expected is SpanExportResult.SUCCESS:
            _DEFAULT_ADMIN.delete_api_key(api_key)
            assert export(_spans) is SpanExportResult.FAILURE

    @pytest.mark.parametrize(
        "use_admin_secret,expected",
        [
            (True, SpanExportResult.SUCCESS),
            (False, SpanExportResult.FAILURE),
        ],
    )
    @pytest.mark.parametrize("method", ["headers", "setenv"])
    def test_admin_secret(
        self,
        method: Literal["headers", "setenv"],
        use_admin_secret: bool,
        expected: SpanExportResult,
        _span_exporter: _SpanExporterFactory,
        _spans: Sequence[ReadableSpan],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv(OTEL_EXPORTER_OTLP_HEADERS, False)
        monkeypatch.delenv(OTEL_EXPORTER_OTLP_TRACES_HEADERS, False)
        headers: Optional[_Headers] = None
        if use_admin_secret:
            assert (api_key := get_env_phoenix_admin_secret())
        else:
            api_key = ""
        if method == "headers":
            # Must use all lower case for `authorization` because
            # otherwise it would crash the gRPC receiver.
            headers = dict(authorization=f"Bearer {api_key}")
        elif method == "setenv":
            monkeypatch.setenv(
                OTEL_EXPORTER_OTLP_TRACES_HEADERS,
                f"Authorization=Bearer {api_key}",
            )
        else:
            assert_never(method)
        export = _span_exporter(headers=headers).export
        assert export(_spans) is expected


class TestEmbeddingsRestApi:
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_authenticated_users_can_access_route(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
    ) -> None:
        user = _get_user(role_or_user)
        logged_in_user = user.log_in()
        with _EXPECTATION_404:  # no files have been exported
            logged_in_user.export_embeddings("embeddings")

    def test_unauthenticated_requests_receive_401(self) -> None:
        with _EXPECTATION_401:
            _export_embeddings(None, filename="embeddings")


class TestPrompts:
    def test_authenticated_users_are_recorded_in_prompts(
        self,
        _get_user: _GetUser,
    ) -> None:
        u = _get_user(_MEMBER)
        logged_in_user = u.log_in()

        # Create new prompt
        response, _ = logged_in_user.gql(
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
        _spans: Sequence[ReadableSpan],
        _get_user: _GetUser,
    ) -> None:
        annotation_creator = _get_user(_MEMBER)
        logged_in_annotation_creator = annotation_creator.log_in()
        member = _get_user(_MEMBER)
        logged_in_member = member.log_in()
        admin = _get_user(_ADMIN)
        logged_in_admin = admin.log_in()

        # Add spans
        user_api_key = logged_in_annotation_creator.create_api_key()
        headers = dict(authorization=f"Bearer {user_api_key}")
        exporter = _http_span_exporter(headers=headers)
        assert exporter.export(_spans) is SpanExportResult.SUCCESS
        await sleep(0.1)  # wait for spans to be exported and written to disk

        # Create span annotation
        span_gid = str(GlobalID("Span", "1"))
        response, _ = logged_in_annotation_creator.gql(
            query=self.QUERY,
            operation_name="CreateSpanAnnotations",
            variables={
                "input": {
                    "spanId": span_gid,
                    "name": "span-annotation-name",
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
        span_gid = str(GlobalID("Span", "1"))
        for user in [logged_in_member, logged_in_admin]:
            with pytest.raises(RuntimeError) as exc_info:
                response, _ = user.gql(
                    query=self.QUERY,
                    operation_name="PatchSpanAnnotations",
                    variables={
                        "input": {
                            "annotationId": annotation_id,
                            "name": "patched-span-annotation-name",
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
                query=self.QUERY,
                operation_name="GetSpanAnnotation",
                variables={"annotationId": annotation_id},
            )
            span_annotation = response["data"]["spanAnnotation"]
            assert span_annotation == original_span_annotation

        # Member who did not create the annotation cannot delete
        with pytest.raises(RuntimeError) as exc_info:
            logged_in_member.gql(
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
            query=self.QUERY,
            operation_name="GetSpanAnnotation",
            variables={"annotationId": annotation_id},
        )
        span_annotation = response["data"]["spanAnnotation"]
        assert span_annotation == original_span_annotation

        # Admin can delete
        response, _ = logged_in_admin.gql(
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
        traceId
        user {
          id
          email
          username
        }
      }
    """

    async def test_other_users_cannot_patch_and_only_creator_or_admin_can_delete(
        self,
        _spans: Sequence[ReadableSpan],
        _get_user: _GetUser,
    ) -> None:
        annotation_creator = _get_user(_MEMBER)
        logged_in_annotation_creator = annotation_creator.log_in()
        member = _get_user(_MEMBER)
        logged_in_member = member.log_in()
        admin = _get_user(_ADMIN)
        logged_in_admin = admin.log_in()

        # Add spans
        user_api_key = logged_in_annotation_creator.create_api_key()
        headers = dict(authorization=f"Bearer {user_api_key}")
        exporter = _http_span_exporter(headers=headers)
        assert exporter.export(_spans) is SpanExportResult.SUCCESS
        await sleep(0.1)  # wait for spans to be exported and written to disk

        # Create trace annotation
        trace_gid = str(GlobalID("Trace", "1"))
        response, _ = logged_in_annotation_creator.gql(
            query=self.QUERY,
            operation_name="CreateTraceAnnotations",
            variables={
                "input": {
                    "traceId": trace_gid,
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
        trace_gid = str(GlobalID("Trace", "1"))
        for user in [logged_in_member, logged_in_admin]:
            with pytest.raises(RuntimeError) as exc_info:
                response, _ = user.gql(
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
                query=self.QUERY,
                operation_name="GetTraceAnnotation",
                variables={"annotationId": annotation_id},
            )
            trace_annotation = response["data"]["traceAnnotation"]
            assert trace_annotation == original_trace_annotation

        # Member who did not create the annotation cannot delete
        with pytest.raises(RuntimeError) as exc_info:
            logged_in_member.gql(
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
            query=self.QUERY,
            operation_name="GetTraceAnnotation",
            variables={"annotationId": annotation_id},
        )
        trace_annotation = response["data"]["traceAnnotation"]
        assert trace_annotation == original_trace_annotation

        # Admin can delete
        response, _ = logged_in_admin.gql(
            query=self.QUERY,
            operation_name="DeleteTraceAnnotations",
            variables={
                "input": {
                    "annotationIds": [annotation_id],
                }
            },
        )
