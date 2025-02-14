import os
import secrets
from collections.abc import Iterator
from contextlib import ExitStack
from typing import Any
from unittest import mock

import pytest
from faker import Faker
from phoenix.auth import DEFAULT_SECRET_LENGTH
from phoenix.config import (
    ENV_PHOENIX_DISABLE_RATE_LIMIT,
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_SECRET,
)

from .._helpers import _Secret, _server


@pytest.fixture(scope="module")
def _secret(
    _env_phoenix_sql_database_url: Any,
) -> _Secret:
    return secrets.token_hex(DEFAULT_SECRET_LENGTH)


@pytest.fixture(autouse=True, scope="module")
def _app(
    _ports: Iterator[int],
    _secret: _Secret,
    _env_phoenix_sql_database_url: Any,
    _fake: Faker,
) -> Iterator[None]:
    values = (
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
        (ENV_PHOENIX_DISABLE_RATE_LIMIT, "true"),
        (ENV_PHOENIX_SECRET, _secret),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(_server())
        yield
