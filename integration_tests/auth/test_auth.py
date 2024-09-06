from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from functools import partial
from itertools import product
from typing import ContextManager, Iterator, Optional
from urllib.parse import urljoin

import jwt
import pytest
from faker import Faker
from httpx import HTTPStatusError
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME, PHOENIX_REFRESH_TOKEN_COOKIE_NAME
from phoenix.config import get_base_url
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from ..conftest import _Headers, _httpx_client, _SpanExporterFactory, _start_span
from .conftest import (
    _create_system_api_key,
    _create_user,
    _delete_system_api_key,
    _GetNewUser,
    _GqlId,
    _log_in,
    _Password,
    _patch_user,
    _patch_viewer,
    _Profile,
    _Token,
    _Username,
)

NOW = datetime.now(timezone.utc)


class TestTokens:
    def test_log_in_tokens_should_change(
        self,
        _admin_email: str,
        _secret: str,
    ) -> None:
        n, access_tokens, refresh_tokens = 2, set(), set()
        for _ in range(n):
            with _log_in(_secret, email=_admin_email) as (access_token, refresh_token):
                access_tokens.add(access_token)
                refresh_tokens.add(refresh_token)
        assert len(access_tokens) == n
        assert len(refresh_tokens) == n
        decode = partial(jwt.decode, options=dict(verify_signature=False))
        assert len({decode(token)["jti"] for token in access_tokens}) == n
        assert len({decode(token)["jti"] for token in refresh_tokens}) == n


class TestUsers:
    @pytest.mark.parametrize(
        "email,use_secret,expectation",
        [
            ("admin@localhost", True, nullcontext()),
            ("admin@localhost", False, pytest.raises(HTTPStatusError, match="401 Unauthorized")),
            ("system@localhost", True, pytest.raises(HTTPStatusError, match="401 Unauthorized")),
            ("admin", True, pytest.raises(HTTPStatusError, match="401 Unauthorized")),
        ],
    )
    def test_admin(
        self,
        email: str,
        use_secret: bool,
        expectation: ContextManager[Optional[Unauthorized]],
        _secret: str,
        _fake: Faker,
        _passwords: Iterator[_Password],
    ) -> None:
        password = _secret if use_secret else next(_passwords)
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _create_system_api_key(None, name=_fake.unique.pystr())
        with expectation:
            with _log_in(password, email=email) as (token, _):
                _create_system_api_key(token, name=_fake.unique.pystr())
            with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
                _create_system_api_key(token, name=_fake.unique.pystr())

    def test_end_to_end_credentials_flow(
        self,
        _admin_email: str,
        _secret: str,
        _fake: Faker,
    ) -> None:
        # user logs into first browser
        resp = _httpx_client().post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": _admin_email, "password": _secret},
        )
        resp.raise_for_status()
        assert (browser_0_access_token_0 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert (browser_0_refresh_token_0 := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))

        # user creates api key in the first browser
        _create_system_api_key(browser_0_access_token_0, name="api-key-0")

        # tokens are refreshed in the first browser
        resp = _httpx_client().post(
            urljoin(get_base_url(), "/auth/refresh"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_0,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_0,
            },
        )
        resp.raise_for_status()
        assert (browser_0_access_token_1 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert (browser_0_refresh_token_1 := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))

        # user creates api key in the first browser
        _create_system_api_key(browser_0_access_token_1, name="api-key-1")

        # refresh token is good for one use only
        resp = _httpx_client().post(
            urljoin(get_base_url(), "/auth/refresh"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_0,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_0,
            },
        )
        with pytest.raises(HTTPStatusError):
            resp.raise_for_status()

        # original access token is invalid after refresh
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _create_system_api_key(browser_0_access_token_0, name="api-key-2")

        # user logs into second browser
        resp = _httpx_client().post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": _admin_email, "password": _secret},
        )
        resp.raise_for_status()
        assert (browser_1_access_token_0 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)

        # user creates api key in the second browser
        _create_system_api_key(browser_1_access_token_0, name="api-key-3")

        # user logs out in first browser
        resp = _httpx_client().post(
            urljoin(get_base_url(), "/auth/logout"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_1,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_1,
            },
        )
        resp.raise_for_status()

        # user is logged out of both browsers
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _create_system_api_key(browser_0_access_token_1, name="api-key-4")
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _create_system_api_key(browser_1_access_token_0, name="api-key-5")

    @pytest.mark.parametrize(
        "role,expectation",
        [
            (UserRoleInput.ADMIN, nullcontext()),
            (UserRoleInput.MEMBER, pytest.raises(Unauthorized)),
        ],
    )
    def test_create_user(
        self,
        role: UserRoleInput,
        expectation: ContextManager[Optional[Unauthorized]],
        _admin_email: str,
        _secret: str,
        _fake: Faker,
        _profiles: Iterator[_Profile],
    ) -> None:
        profile = next(_profiles)
        email = profile.email
        username = profile.username
        password = profile.password
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _create_user(None, email=email, password=password, username=username, role=role)
        with _log_in(_secret, email=_admin_email) as (token, _):
            _create_user(token, email=email, password=password, username=username, role=role)
        with _log_in(password, email=email) as (token, _):
            with expectation:
                _create_system_api_key(token, name=_fake.unique.pystr())
            for _role in UserRoleInput:
                _profile = next(_profiles)
                with expectation:
                    _create_user(
                        token,
                        email=_profile.email,
                        username=_profile.username,
                        password=_profile.password,
                        role=_role,
                    )

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_can_change_password_for_self(
        self,
        role: UserRoleInput,
        _get_new_user: _GetNewUser,
        _passwords: Iterator[_Password],
    ) -> None:
        user = _get_new_user(role)
        email = user.profile.email
        password = user.profile.password
        (token, *_) = user.tokens
        new_password = f"new_password_{next(_passwords)}"
        assert new_password != password
        wrong_password = next(_passwords)
        assert wrong_password != password
        for _token, _password in product((None, token), (None, wrong_password, password)):
            if _token == token and _password == password:
                continue
            with pytest.raises(BaseException):
                _patch_viewer(_token, _password, new_password=new_password)
            _log_in(password, email=email)
        _patch_viewer((old_token := token), (old_password := password), new_password=new_password)
        another_password = f"another_password_{next(_passwords)}"
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _patch_viewer(old_token, new_password, new_password=another_password)
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _log_in(old_password, email=email)
        new_token, _ = _log_in(new_password, email=email)
        with pytest.raises(BaseException):
            _patch_viewer(new_token, old_password, new_password=another_password)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_can_change_username_for_self(
        self,
        role: UserRoleInput,
        _get_new_user: _GetNewUser,
        _usernames: Iterator[_Username],
        _passwords: Iterator[_Password],
    ) -> None:
        user = _get_new_user(role)
        (token, *_), password = user.tokens, user.profile.password
        new_username = f"new_username_{next(_usernames)}"
        for _password in (None, password):
            with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
                _patch_viewer(None, _password, new_username=new_username)
        _patch_viewer(token, None, new_username=new_username)
        another_username = f"another_username_{next(_usernames)}"
        wrong_password = next(_passwords)
        assert wrong_password != password
        _patch_viewer(token, wrong_password, new_username=another_username)

    @pytest.mark.parametrize(
        "role,expectation",
        [
            (UserRoleInput.MEMBER, pytest.raises(Unauthorized)),
            (UserRoleInput.ADMIN, nullcontext()),
        ],
    )
    def test_only_admin_can_change_role_for_non_self(
        self,
        role: UserRoleInput,
        expectation: ContextManager[Optional[Unauthorized]],
        _get_new_user: _GetNewUser,
    ) -> None:
        user = _get_new_user(role)
        non_self = _get_new_user(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        (token, *_), gid = user.tokens, non_self.gid
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _patch_user(None, gid, new_role=UserRoleInput.ADMIN)
        with expectation:
            _patch_user(token, gid, new_role=UserRoleInput.ADMIN)

    @pytest.mark.parametrize(
        "role,expectation",
        [
            (UserRoleInput.MEMBER, pytest.raises(Unauthorized)),
            (UserRoleInput.ADMIN, nullcontext()),
        ],
    )
    def test_only_admin_can_change_password_for_non_self(
        self,
        role: UserRoleInput,
        expectation: ContextManager[Optional[Unauthorized]],
        _get_new_user: _GetNewUser,
        _passwords: Iterator[_Password],
    ) -> None:
        user = _get_new_user(role)
        non_self = _get_new_user(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        old_password = non_self.profile.password
        new_password = f"new_password_{next(_passwords)}"
        assert new_password != old_password
        (token, *_), gid = user.tokens, non_self.gid
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _patch_user(None, gid, new_password=new_password)
        with expectation as e:
            _patch_user(token, gid, new_password=new_password)
        if e:
            return
        email = non_self.profile.email
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _log_in(old_password, email=email)
        _log_in(new_password, email=email)

    @pytest.mark.parametrize(
        "role,expectation",
        [
            (UserRoleInput.MEMBER, pytest.raises(Unauthorized)),
            (UserRoleInput.ADMIN, nullcontext()),
        ],
    )
    def test_only_admin_can_change_username_for_non_self(
        self,
        role: UserRoleInput,
        expectation: ContextManager[Optional[Unauthorized]],
        _get_new_user: _GetNewUser,
        _usernames: Iterator[_Username],
    ) -> None:
        user = _get_new_user(role)
        non_self = _get_new_user(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        old_username = non_self.profile.username
        new_username = f"new_username_{next(_usernames)}"
        assert new_username != old_username
        (token, *_), gid = user.tokens, non_self.gid
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            _patch_user(None, gid, new_username=new_username)
        with expectation:
            _patch_user(token, gid, new_username=new_username)


def _create_user_key(token: str) -> str:
    _create_user_key_mutation = """
            mutation ($input: CreateUserApiKeyInput!) {
              createUserApiKey(input: $input) {
                apiKey {
                  id
                }
              }
            }
            """
    resp = _httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json={
            "query": _create_user_key_mutation,
            "variables": {
                "input": {
                    "name": "test",
                }
            },
        },
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token},
    )
    resp.raise_for_status()
    return str(resp.json()["data"]["createUserApiKey"]["apiKey"]["id"])


class TestApiKeys:
    DELETE_USER_KEY_MUTATION = """
            mutation ($input: DeleteApiKeyInput!) {
              deleteUserApiKey(input: $input) {
                apiKeyId
              }
            }
            """

    def test_delete_user_api_key(
        self,
        _admin_email: str,
        _secret: str,
        _passwords: Iterator[_Password],
    ) -> None:
        member_email = "member@localhost.com"
        username = "member"
        member_password = next(_passwords)

        with _log_in(_secret, email=_admin_email) as (admin_token, _):
            admin_api_key_id = _create_user_key(admin_token)
            _create_user(
                admin_token,
                email=member_email,
                password=member_password,
                role=UserRoleInput.MEMBER,
                username=username,
            )

            with _log_in(
                member_password,
                email=member_email,
            ) as (member_token, _):
                member_api_key_id = _create_user_key(member_token)
                member_api_key_id_2 = _create_user_key(member_token)
                # member can delete their own keys
                resp = _httpx_client().post(
                    urljoin(get_base_url(), "graphql"),
                    json={
                        "query": self.DELETE_USER_KEY_MUTATION,
                        "variables": {
                            "input": {
                                "id": member_api_key_id,
                            }
                        },
                    },
                    cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: member_token},
                )
                resp.raise_for_status()
                assert resp.json().get("errors") is None
                # member can't delete other user's keys
                resp = _httpx_client().post(
                    urljoin(get_base_url(), "graphql"),
                    json={
                        "query": self.DELETE_USER_KEY_MUTATION,
                        "variables": {
                            "input": {
                                "id": admin_api_key_id,
                            }
                        },
                    },
                    cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: member_token},
                )
                assert len(errors := resp.json().get("errors")) == 1
                assert errors[0]["message"] == "User not authorized to delete"
                # admin can delete their own key
                resp = _httpx_client().post(
                    urljoin(get_base_url(), "graphql"),
                    json={
                        "query": self.DELETE_USER_KEY_MUTATION,
                        "variables": {
                            "input": {
                                "id": admin_api_key_id,
                            }
                        },
                    },
                    cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: admin_token},
                )
                resp.raise_for_status()
                assert resp.json().get("errors") is None
                # admin can delete other user's keys
                resp = _httpx_client().post(
                    urljoin(get_base_url(), "graphql"),
                    json={
                        "query": self.DELETE_USER_KEY_MUTATION,
                        "variables": {
                            "input": {
                                "id": member_api_key_id_2,
                            }
                        },
                    },
                    cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: admin_token},
                )
                resp.raise_for_status()
                assert resp.json().get("errors") is None


class TestSpanExporters:
    @pytest.mark.parametrize(
        "with_headers,expires_at,expected",
        [
            (True, NOW + timedelta(days=1), SpanExportResult.SUCCESS),
            (True, None, SpanExportResult.SUCCESS),
            (True, NOW, SpanExportResult.FAILURE),
            (False, None, SpanExportResult.FAILURE),
        ],
    )
    def test_headers(
        self,
        with_headers: bool,
        expires_at: Optional[datetime],
        expected: SpanExportResult,
        _span_exporter: _SpanExporterFactory,
        _admin_token: _Token,
        _fake: Faker,
    ) -> None:
        headers: Optional[_Headers] = None
        gid: Optional[_GqlId] = None
        if with_headers:
            system_api_key, gid = _create_system_api_key(
                _admin_token,
                name=_fake.unique.pystr(),
                expires_at=expires_at,
            )
            headers = {"authorization": f"Bearer {system_api_key}"}
        export = _span_exporter(headers=headers).export
        project_name, span_name = _fake.unique.pystr(), _fake.unique.pystr()
        memory = InMemorySpanExporter()
        _start_span(project_name=project_name, span_name=span_name, exporter=memory).end()
        spans = memory.get_finished_spans()
        assert len(spans) == 1
        for _ in range(2):
            assert export(spans) is expected
        if gid is not None and expected is SpanExportResult.SUCCESS:
            _delete_system_api_key(_admin_token, gid)
            assert export(spans) is SpanExportResult.FAILURE
