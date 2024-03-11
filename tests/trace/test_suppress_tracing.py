from typing import Iterator

import pytest
from opentelemetry.context import (
    _SUPPRESS_INSTRUMENTATION_KEY,
    attach,
    detach,
    get_value,
    set_value,
)
from phoenix.trace import suppress_tracing


def test_suppress_tracing(obj: object):
    with suppress_tracing():
        assert get_value(_SUPPRESS_INSTRUMENTATION_KEY) is True
    assert get_value(_SUPPRESS_INSTRUMENTATION_KEY) is obj


@pytest.fixture(autouse=True)
def instrument(obj: object) -> Iterator[None]:
    token = attach(set_value(_SUPPRESS_INSTRUMENTATION_KEY, obj))
    yield
    detach(token)


@pytest.fixture
def obj() -> object:
    return object()
