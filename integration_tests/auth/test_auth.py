from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from functools import partial
from itertools import product
from typing import (
    Any,
    Callable,
    ContextManager,
    Dict,
    Iterator,
    Optional,
    Protocol,
    Tuple,
)
from urllib.parse import urljoin

import httpx
import jwt
import pytest
from faker import Faker
from httpx import HTTPStatusError
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span
from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.config import get_base_url
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from typing_extensions import TypeAlias

NOW = datetime.now(timezone.utc)

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]
_Name: TypeAlias = str

_Username: TypeAlias = str
_Email: TypeAlias = str
_Password: TypeAlias = str
_Token: TypeAlias = str
_AccessToken: TypeAlias = str
_RefreshToken: TypeAlias = str
_ApiKey: TypeAlias = str
_GqlId: TypeAlias = str


class _LogIn(Protocol):
    def __call__(
        self,
        password: _Password,
        /,
        *,
        email: _Email,
    ) -> ContextManager[Tuple[_AccessToken, _RefreshToken]]: ...


class _LogOut(Protocol):
    def __call__(self, token: _Token, /) -> None: ...


class _CreateUser(Protocol):
    def __call__(
        self,
        token: Optional[_Token],
        /,
        *,
        email: _Email,
        password: _Password,
        role: UserRoleInput,
        username: Optional[_Username] = None,
    ) -> _GqlId: ...


class _PatchUser(Protocol):
    def __call__(
        self,
        token: Optional[_Token],
        gid: _GqlId,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
        new_role: Optional[UserRoleInput] = None,
    ) -> None: ...


class _PatchViewer(Protocol):
    def __call__(
        self,
        token: Optional[_Token],
        current_password: Optional[_Password],
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
    ) -> None: ...


class _CreateSystemApiKey(Protocol):
    def __call__(
        self,
        token: Optional[_Token],
        /,
        *,
        name: _Name,
        expires_at: Optional[datetime] = None,
    ) -> Tuple[_ApiKey, _GqlId]: ...


class _DeleteSystemApiKey(Protocol):
    def __call__(
        self,
        token: Optional[_Token],
        gid: _GqlId,
        /,
    ) -> None: ...


class _SpanExporterFactory(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


class _StartSpan(Protocol):
    def __call__(
        self,
        *,
        project_name: _ProjectName,
        span_name: _SpanName,
        exporter: SpanExporter,
    ) -> Span: ...


class _Profile(Protocol):
    @property
    def email(self) -> _Email: ...
    @property
    def password(self) -> _Password: ...
    @property
    def username(self) -> Optional[_Username]: ...


class _User(Protocol):
    @property
    def gid(self) -> _GqlId: ...
    @property
    def profile(self) -> _Profile: ...
    @property
    def role(self) -> UserRoleInput: ...
    @property
    def token(self) -> Optional[_Token]: ...


class _GetNewUser(Protocol):
    def __call__(self, role: UserRoleInput) -> _User: ...


class TestTokens:
    def test_log_in_tokens_should_change(
        self,
        admin_email: str,
        admin_password: str,
        log_in: _LogIn,
    ) -> None:
        n, access_tokens, refresh_tokens = 2, set(), set()
        for _ in range(n):
            with log_in(admin_password, email=admin_email) as (access_token, refresh_token):
                access_tokens.add(access_token)
                refresh_tokens.add(refresh_token)
        assert len(access_tokens) == n
        assert len(refresh_tokens) == n
        decode = partial(jwt.decode, options=dict(verify_signature=False))
        assert len({decode(token)["jti"] for token in access_tokens}) == n
        assert len({decode(token)["jti"] for token in refresh_tokens}) == n


class TestUsers:
    @pytest.mark.parametrize(
        "email,expectation",
        [
            ("admin@localhost", nullcontext()),
            ("admin@localhost", pytest.raises(HTTPStatusError, match="401 Unauthorized")),
            ("system@localhost", pytest.raises(HTTPStatusError, match="401 Unauthorized")),
            ("admin", pytest.raises(HTTPStatusError, match="401 Unauthorized")),
        ],
    )
    def test_admin(
        self,
        email: str,
        expectation: ContextManager[Optional[Unauthorized]],
        secret: str,
        log_in: _LogIn,
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
        passwords: Iterator[_Password],
    ) -> None:
        password = next(passwords)
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            create_system_api_key(None, name=fake.unique.pystr())
        with expectation:
            with log_in(password, email=email) as (token, _):
                create_system_api_key(token, name=fake.unique.pystr())
            with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
                create_system_api_key(token, name=fake.unique.pystr())

    def test_end_to_end_credentials_flow(
        self,
        admin_email: str,
        admin_password: str,
        httpx_client: Callable[[], httpx.Client],
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
    ) -> None:
        # user logs into first browser
        resp = httpx_client().post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": admin_email, "password": admin_password},
        )
        resp.raise_for_status()
        assert (browser_0_access_token_0 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert (browser_0_refresh_token_0 := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))

        # user creates api key in the first browser
        create_system_api_key(browser_0_access_token_0, name="api-key-0")

        # tokens are refreshed in the first browser
        resp = httpx_client().post(
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
        create_system_api_key(browser_0_access_token_1, name="api-key-1")

        # refresh token is good for one use only
        resp = httpx_client().post(
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
            create_system_api_key(browser_0_access_token_0, name="api-key-2")

        # user logs into second browser
        resp = httpx_client().post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": admin_email, "password": admin_password},
        )
        resp.raise_for_status()
        assert (browser_1_access_token_0 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)

        # user creates api key in the second browser
        create_system_api_key(browser_1_access_token_0, name="api-key-3")

        # user logs out in first browser
        resp = httpx_client().post(
            urljoin(get_base_url(), "/auth/logout"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_1,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_1,
            },
        )
        resp.raise_for_status()

        # user is logged out of both browsers
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            create_system_api_key(browser_0_access_token_1, name="api-key-4")
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            create_system_api_key(browser_1_access_token_0, name="api-key-5")

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
        admin_email: str,
        admin_password: str,
        log_in: _LogIn,
        create_user: _CreateUser,
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
        profiles: Iterator[_Profile],
    ) -> None:
        profile = next(profiles)
        email = profile.email
        username = profile.username
        password = profile.password
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            create_user(None, email=email, password=password, username=username, role=role)
        with log_in(admin_password, email=admin_email) as (token, _):
            create_user(token, email=email, password=password, username=username, role=role)
        with log_in(password, email=email) as (token, _):
            with expectation:
                create_system_api_key(token, name=fake.unique.pystr())
            for _role in UserRoleInput:
                _profile = next(profiles)
                with expectation:
                    create_user(
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
        patch_viewer: _PatchViewer,
        log_in: _LogIn,
        get_new_user: _GetNewUser,
        passwords: Iterator[_Password],
    ) -> None:
        user = get_new_user(role)
        email = user.profile.email
        password = user.profile.password
        token = user.token
        new_password = f"new_password_{next(passwords)}"
        assert new_password != password
        wrong_password = next(passwords)
        assert wrong_password != password
        for _token, _password in product((None, token), (None, wrong_password, password)):
            if _token == token and _password == password:
                continue
            with pytest.raises(BaseException):
                patch_viewer(_token, _password, new_password=new_password)
            log_in(password, email=email).__enter__()
        patch_viewer((old_token := token), (old_password := password), new_password=new_password)
        another_password = f"another_password_{next(passwords)}"
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            patch_viewer(old_token, new_password, new_password=another_password)
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            log_in(old_password, email=email).__enter__()
        new_token, _ = log_in(new_password, email=email).__enter__()
        with pytest.raises(BaseException):
            patch_viewer(new_token, old_password, new_password=another_password)

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_can_change_username_for_self(
        self,
        role: UserRoleInput,
        patch_viewer: _PatchViewer,
        log_in: _LogIn,
        get_new_user: _GetNewUser,
        usernames: Iterator[_Username],
        passwords: Iterator[_Password],
    ) -> None:
        user = get_new_user(role)
        token, password = user.token, user.profile.password
        new_username = f"new_username_{next(usernames)}"
        for _password in (None, password):
            with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
                patch_viewer(None, _password, new_username=new_username)
        patch_viewer(token, None, new_username=new_username)
        another_username = f"another_username_{next(usernames)}"
        wrong_password = next(passwords)
        assert wrong_password != password
        patch_viewer(token, wrong_password, new_username=another_username)

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
        patch_user: _PatchUser,
        log_in: _LogIn,
        get_new_user: _GetNewUser,
    ) -> None:
        user = get_new_user(role)
        non_self = get_new_user(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        token, gid = user.token, non_self.gid
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            patch_user(None, gid, new_role=UserRoleInput.ADMIN)
        with expectation:
            patch_user(token, gid, new_role=UserRoleInput.ADMIN)

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
        patch_user: _PatchUser,
        log_in: _LogIn,
        get_new_user: _GetNewUser,
        passwords: Iterator[_Password],
    ) -> None:
        user = get_new_user(role)
        non_self = get_new_user(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        old_password = non_self.profile.password
        new_password = f"new_password_{next(passwords)}"
        assert new_password != old_password
        token, gid = user.token, non_self.gid
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            patch_user(None, gid, new_password=new_password)
        with expectation as e:
            patch_user(token, gid, new_password=new_password)
        if e:
            return
        email = non_self.profile.email
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            log_in(old_password, email=email).__enter__()
        log_in(new_password, email=email).__enter__()

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
        patch_user: _PatchUser,
        log_in: _LogIn,
        get_new_user: _GetNewUser,
        usernames: Iterator[_Username],
    ) -> None:
        user = get_new_user(role)
        non_self = get_new_user(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        old_username = non_self.profile.username
        new_username = f"new_username_{next(usernames)}"
        assert new_username != old_username
        token, gid = user.token, non_self.gid
        with pytest.raises(HTTPStatusError, match="401 Unauthorized"):
            patch_user(None, gid, new_username=new_username)
        with expectation:
            patch_user(token, gid, new_username=new_username)


def create_user_key(httpx_client: Callable[[], httpx.Client], token: str) -> str:
    create_user_key_mutation = """
            mutation ($input: CreateUserApiKeyInput!) {
              createUserApiKey(input: $input) {
                apiKey {
                  id
                }
              }
            }
            """
    resp = httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json={
            "query": create_user_key_mutation,
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
        admin_email: str,
        admin_password: str,
        log_in: _LogIn,
        create_user: _CreateUser,
        httpx_client: Callable[[], httpx.Client],
        passwords: Iterator[_Password],
    ) -> None:
        member_email = "member@localhost.com"
        username = "member"
        member_password = next(passwords)

        with log_in(admin_password, email=admin_email) as (admin_token, _):
            admin_api_key_id = create_user_key(httpx_client, admin_token)
            create_user(
                admin_token,
                email=member_email,
                password=member_password,
                role=UserRoleInput.MEMBER,
                username=username,
            )

            with log_in(
                member_password,
                email=member_email,
            ) as (member_token, _):
                member_api_key_id = create_user_key(httpx_client, member_token)
                member_api_key_id_2 = create_user_key(httpx_client, member_token)
                # member can delete their own keys
                resp = httpx_client().post(
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
                resp = httpx_client().post(
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
                resp = httpx_client().post(
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
                resp = httpx_client().post(
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
        span_exporter: _SpanExporterFactory,
        start_span: _StartSpan,
        create_system_api_key: _CreateSystemApiKey,
        delete_system_api_key: _DeleteSystemApiKey,
        admin_token: _Token,
        fake: Faker,
    ) -> None:
        headers: Optional[Dict[str, Any]] = None
        gid: Optional[_GqlId] = None
        if with_headers:
            system_api_key, gid = create_system_api_key(
                admin_token,
                name=fake.unique.pystr(),
                expires_at=expires_at,
            )
            headers = {"authorization": f"Bearer {system_api_key}"}
        export = span_exporter(headers=headers).export
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        memory = InMemorySpanExporter()
        start_span(project_name=project_name, span_name=span_name, exporter=memory).end()
        spans = memory.get_finished_spans()
        assert len(spans) == 1
        for _ in range(2):
            assert export(spans) is expected
        if gid is not None and expected is SpanExportResult.SUCCESS:
            delete_system_api_key(admin_token, gid)
            assert export(spans) is SpanExportResult.FAILURE
