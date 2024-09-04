from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from functools import partial
from typing import (
    Any,
    ContextManager,
    Dict,
    Generator,
    Iterator,
    Optional,
    Protocol,
    Tuple,
)

import jwt
import pytest
from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span
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
        *,
        email: _Email,
        password: _Password,
    ) -> ContextManager[Tuple[_AccessToken, _RefreshToken]]: ...


class _LogOut(Protocol):
    def __call__(self, token: _Token, /) -> None: ...


class _CreateUser(Protocol):
    def __call__(
        self,
        *,
        email: _Email,
        password: _Password,
        role: UserRoleInput,
        username: Optional[_Username] = None,
        token: Optional[_Token] = None,
    ) -> _GqlId: ...


class _PatchUser(Protocol):
    def __call__(
        self,
        gid: _GqlId,
        /,
        *,
        username: Optional[_Username] = None,
        password: Optional[_Password] = None,
        role: Optional[UserRoleInput] = None,
        token: Optional[_Token] = None,
    ) -> _Token: ...


class _PatchSelfUser(Protocol):
    def __call__(
        self,
        username: Optional[_Username] = None,
        password: Optional[_Password] = None,
        token: Optional[_Token] = None,
    ) -> _Token: ...


class _CreateSystemApiKey(Protocol):
    def __call__(
        self,
        *,
        name: _Name,
        expires_at: Optional[datetime] = None,
        token: Optional[_Token] = None,
    ) -> Tuple[_ApiKey, _GqlId]: ...


class _DeleteSystemApiKey(Protocol):
    def __call__(
        self,
        gid: _GqlId,
        /,
        *,
        token: Optional[_Token] = None,
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


class TestTokens:
    def test_log_in_tokens_should_change(
        self,
        admin_email: str,
        secret: str,
        log_in: _LogIn,
    ) -> None:
        n, access_tokens, refresh_tokens = 2, set(), set()
        for _ in range(n):
            with log_in(email=admin_email, password=secret) as (access_token, refresh_token):
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
            ("admin@localhost", False, pytest.raises(Unauthorized)),
            ("system@localhost", True, pytest.raises(Unauthorized)),
            ("admin", True, pytest.raises(Unauthorized)),
        ],
    )
    def test_admin(
        self,
        email: str,
        use_secret: bool,
        expectation: ContextManager[Optional[Unauthorized]],
        secret: str,
        log_in: _LogIn,
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
        passwords: Iterator[_Password],
    ) -> None:
        password = secret if use_secret else next(passwords)
        with expectation:
            with log_in(email=email, password=password) as (token, _):
                create_system_api_key(name=fake.unique.pystr(), token=token)
            with pytest.raises(Unauthorized):
                create_system_api_key(name=fake.unique.pystr(), token=token)

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
        secret: str,
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
        with log_in(email=admin_email, password=secret) as (token, _):
            create_user(
                email=email,
                password=password,
                role=role,
                username=username,
                token=token,
            )
        with log_in(email=email, password=password) as (token, _):
            with expectation:
                create_system_api_key(name=fake.unique.pystr(), token=token)
            for _role in UserRoleInput:
                _profile = next(profiles)
                _email = profile.email
                _username = profile.username
                _password = profile.password
                with expectation:
                    create_user(
                        email=_email,
                        password=_password,
                        role=_role,
                        username=_username,
                        token=token,
                    )

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_can_change_password_for_self(
        self,
        role: UserRoleInput,
        patch_self_user: _PatchSelfUser,
        log_in: _LogIn,
        users: Generator[_User, UserRoleInput, None],
        passwords: Iterator[_Password],
    ) -> None:
        user = users.send(role)
        email = user.profile.email
        old_password = user.profile.password
        new_password = f"new_password_{next(passwords)}"
        assert new_password != old_password
        old_token = user.token
        new_token = patch_self_user(password=new_password, token=old_token)
        assert new_token != old_token
        another_password = f"another_password_{next(passwords)}"
        with pytest.raises(Unauthorized):
            patch_self_user(password=another_password, token=old_token)
        with pytest.raises(Unauthorized):
            log_in(email=email, password=old_password).__enter__()
        final_password = f"final_password_{next(passwords)}"
        patch_self_user(password=final_password, token=new_token)
        log_in(email=email, password=final_password).__enter__()

    @pytest.mark.parametrize("role", list(UserRoleInput))
    def test_user_can_change_username_for_self(
        self,
        role: UserRoleInput,
        patch_self_user: _PatchSelfUser,
        log_in: _LogIn,
        users: Generator[_User, UserRoleInput, None],
        usernames: Iterator[_Username],
    ) -> None:
        user = users.send(role)
        new_username = f"new_username_{next(usernames)}"
        patch_self_user(username=new_username, token=user.token)
        another_username = f"another_username_{next(usernames)}"
        patch_self_user(username=another_username, token=user.token)

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
        users: Generator[_User, UserRoleInput, None],
        patch_user: _PatchUser,
        log_in: _LogIn,
        fake: Faker,
    ) -> None:
        user = users.send(role)
        non_self = users.send(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        gid = non_self.gid
        with expectation:
            patch_user(gid, role=UserRoleInput.ADMIN, token=user.token)

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
        users: Generator[_User, UserRoleInput, None],
        passwords: Iterator[_Password],
    ) -> None:
        user = users.send(role)
        non_self = users.send(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        old_password = non_self.profile.password
        new_password = f"new_password_{next(passwords)}"
        assert new_password != old_password
        gid = non_self.gid
        with expectation as e:
            patch_user(gid, password=new_password, token=user.token)
        if e:
            return
        email = non_self.profile.email
        with pytest.raises(Unauthorized):
            log_in(email=email, password=old_password).__enter__()
        log_in(email=email, password=new_password).__enter__()

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
        users: Generator[_User, UserRoleInput, None],
        usernames: Iterator[_Username],
    ) -> None:
        user = users.send(role)
        non_self = users.send(UserRoleInput.MEMBER)
        assert user.gid != non_self.gid
        old_username = non_self.profile.username
        new_username = f"new_username_{next(usernames)}"
        assert new_username != old_username
        gid = non_self.gid
        with expectation:
            patch_user(gid, username=new_username, token=user.token)


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
                name=fake.unique.pystr(),
                expires_at=expires_at,
                token=admin_token,
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
            delete_system_api_key(gid, token=admin_token)
            assert export(spans) is SpanExportResult.FAILURE
