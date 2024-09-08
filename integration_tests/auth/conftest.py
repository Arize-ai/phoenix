import os
import secrets
from contextlib import ExitStack
from typing import Any, Iterator
from unittest import mock

import pytest
from phoenix.auth import DEFAULT_SECRET_LENGTH
from phoenix.config import ENV_PHOENIX_ENABLE_AUTH, ENV_PHOENIX_SECRET

from .._helpers import _Secret, _server


@pytest.fixture(scope="module")
def _secret() -> _Secret:
    return secrets.token_hex(DEFAULT_SECRET_LENGTH)


@pytest.fixture(autouse=True, scope="module")
def _app(
    _secret: _Secret,
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
