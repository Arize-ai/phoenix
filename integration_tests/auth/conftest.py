import os
import secrets
from contextlib import ExitStack
from dataclasses import asdict
from itertools import count, starmap
from typing import Any, Generator, Iterator, Optional, cast
from unittest import mock

import pytest
from faker import Faker
from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET
from phoenix.config import ENV_PHOENIX_ENABLE_AUTH, ENV_PHOENIX_SECRET
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from .._helpers import (
    _create_user,
    _Email,
    _GetNewUser,
    _log_in,
    _LoggedInUser,
    _Password,
    _Profile,
    _server,
    _Token,
    _UserGenerator,
    _Username,
)


@pytest.fixture(scope="class")
def _secret() -> str:
    return secrets.token_hex(32)


@pytest.fixture(autouse=True, scope="class")
def _app(
    _secret: str,
    _env_phoenix_sql_database_url: Any,
) -> Iterator[None]:
    values = (
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
        (ENV_PHOENIX_SECRET, _secret),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(_server())
        yield


@pytest.fixture(scope="class")
def _emails(_fake: Faker) -> Iterator[_Email]:
    return (_fake.unique.email() for _ in count())


@pytest.fixture(scope="class")
def _passwords(_fake: Faker) -> Iterator[_Password]:
    return (_fake.unique.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET)) for _ in count())


@pytest.fixture(scope="class")
def _usernames(_fake: Faker) -> Iterator[_Username]:
    return (_fake.unique.pystr() for _ in count())


@pytest.fixture(scope="class")
def _profiles(
    _emails: Iterator[_Email],
    _usernames: Iterator[_Password],
    _passwords: Iterator[_Password],
) -> Iterator[_Profile]:
    return starmap(_Profile, zip(_emails, _passwords, _usernames))


@pytest.fixture
def _users(
    _profiles: Iterator[_Profile],
    _admin_token: _Token,
    _fake: Faker,
) -> _UserGenerator:
    def _() -> Generator[Optional[_LoggedInUser], UserRoleInput, None]:
        role = yield None
        for profile in _profiles:
            gid = _create_user(_admin_token, **asdict(profile), role=role)
            email, password = profile.email, profile.password
            tokens = _log_in(password, email=email)
            role = yield _LoggedInUser(gid=gid, role=role, tokens=tokens, profile=profile)

    g = _()
    next(g)
    return cast(_UserGenerator, g)


@pytest.fixture
def _get_new_user(
    _users: _UserGenerator,
) -> _GetNewUser:
    def _(role: UserRoleInput) -> _LoggedInUser:
        return _users.send(role)

    return _


@pytest.fixture
def _admin_token(
    _admin_email: str,
    _secret: str,
) -> Iterator[_Token]:
    with _log_in(_secret, email=_admin_email) as (token, _):
        yield token


@pytest.fixture(scope="module")
def _admin_email() -> _Email:
    return "admin@localhost"
