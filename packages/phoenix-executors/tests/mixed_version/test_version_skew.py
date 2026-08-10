"""Behavior of the shared executor against an arize-phoenix-evals older than this package.

Run by the `phoenix_executors_mixed_version` tox environment, which installs the evals version
pinned in requirements/packages/phoenix-executors-mixed-version.txt from PyPI. Normal CI never
builds this configuration, because the workspace always supplies the current evals.
"""

from importlib.metadata import version
from typing import Any, Tuple
from unittest import mock

from phoenix.evals.exceptions import PhoenixException as EvalsPhoenixException
from phoenix.evals.rate_limiters import RateLimitError as EvalsRateLimitError

from phoenix.executors.exceptions import PhoenixException
from phoenix.executors.executors import (
    AsyncExecutor,
    ConcurrencyController,
    ExecutionDetails,
    ExecutionStatus,
)
from phoenix.executors.rate_limiters import RateLimitError

MAX_RETRIES = 2


def test_the_installed_evals_is_actually_the_old_one() -> None:
    # Guard against the environment silently resolving the workspace copy, which would make every
    # assertion below pass for the wrong reason: a consolidated evals re-exports these exact class
    # objects, so the skew this file exercises would not exist.
    assert EvalsRateLimitError is not RateLimitError
    assert EvalsPhoenixException is not PhoenixException
    assert version("arize-phoenix-evals").startswith("3.3.")


async def run_until_settled(exc: BaseException) -> Tuple[ExecutionDetails, int]:
    async def always_raises(payload: Any) -> Any:
        raise exc

    executor = AsyncExecutor(
        always_raises,
        concurrency=1,
        max_retries=MAX_RETRIES,
        exit_on_error=False,
    )
    with mock.patch.object(ConcurrencyController, "record_error") as record_error:
        _, details = await executor.execute([0])
    return details[0], record_error.call_count


async def test_old_evals_rate_limit_error_backs_off_concurrency() -> None:
    details, backoffs = await run_until_settled(EvalsRateLimitError())
    assert len(details.exceptions) == MAX_RETRIES + 1
    assert backoffs == MAX_RETRIES, (
        "the old class is a different object, so without the compatibility shim this is demoted "
        "to an ordinary retry and the provider never sees the back-off"
    )


async def test_old_evals_internal_error_fails_fast() -> None:
    details, backoffs = await run_until_settled(EvalsPhoenixException("internal"))
    assert len(details.exceptions) == 1, (
        "without the compatibility shim this is retried to exhaustion instead of failing fast"
    )
    assert details.status is ExecutionStatus.FAILED
    assert backoffs == 0
