from typing import Any, Iterator

import pytest

from .._helpers import _server


@pytest.fixture(autouse=True, scope="module")
def _app(
    _env_phoenix_sql_database_url: Any,
) -> Iterator[None]:
    with _server():
        yield
