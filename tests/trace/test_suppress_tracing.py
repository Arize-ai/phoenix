import random
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


def test_suppress_tracing(num: float):
    with suppress_tracing():
        assert get_value(_SUPPRESS_INSTRUMENTATION_KEY) is True
    assert get_value(_SUPPRESS_INSTRUMENTATION_KEY) == num


@pytest.fixture(autouse=True)
def instrument(num: float) -> Iterator[None]:
    token = attach(set_value(_SUPPRESS_INSTRUMENTATION_KEY, num))
    yield
    detach(token)


@pytest.fixture
def num() -> float:
    return random.random()
