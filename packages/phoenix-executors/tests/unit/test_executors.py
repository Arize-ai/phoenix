import sys
from contextlib import contextmanager
from types import ModuleType
from typing import Any, Iterator, List, Tuple, Type
from unittest import mock

import pytest

from phoenix.executors import executors as executors_module
from phoenix.executors.exceptions import PhoenixException
from phoenix.executors.executors import (
    AsyncExecutor,
    ConcurrencyController,
    ExecutionDetails,
    ExecutionStatus,
    SyncExecutor,
)
from phoenix.executors.rate_limiters import RateLimitError, UnavailableTokensError

MAX_RETRIES = 2


@contextmanager
def legacy_evals_installed() -> Iterator[Tuple[Type[BaseException], Type[BaseException]]]:
    """Stand in for an arize-phoenix-evals released before these modules moved here.

    Such a release defines its own exception classes rather than re-exporting the shared ones, so
    the executor's identity checks miss them unless the compatibility shim finds them.
    """

    class LegacyPhoenixException(Exception):
        pass

    class LegacyRateLimitError(LegacyPhoenixException):
        pass

    evals = ModuleType("phoenix.evals")
    exceptions = ModuleType("phoenix.evals.exceptions")
    exceptions.PhoenixException = LegacyPhoenixException  # type: ignore[attr-defined]
    rate_limiters = ModuleType("phoenix.evals.rate_limiters")
    rate_limiters.RateLimitError = LegacyRateLimitError  # type: ignore[attr-defined]
    evals.exceptions = exceptions  # type: ignore[attr-defined]
    evals.rate_limiters = rate_limiters  # type: ignore[attr-defined]

    injected = {
        "phoenix.evals": evals,
        "phoenix.evals.exceptions": exceptions,
        "phoenix.evals.rate_limiters": rate_limiters,
    }
    saved = {name: sys.modules.get(name) for name in injected}
    sys.modules.update(injected)
    executors_module._legacy_rate_limit_errors.cache_clear()  # pyright: ignore[reportPrivateUsage]
    executors_module._legacy_phoenix_exceptions.cache_clear()  # pyright: ignore[reportPrivateUsage]
    try:
        yield LegacyRateLimitError, LegacyPhoenixException
    finally:
        for name, previous in saved.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
        executors_module._legacy_rate_limit_errors.cache_clear()  # pyright: ignore[reportPrivateUsage]
        executors_module._legacy_phoenix_exceptions.cache_clear()  # pyright: ignore[reportPrivateUsage]


async def run_until_settled(exc: BaseException) -> Tuple[ExecutionDetails, int]:
    """Run one always-failing task and report what the executor did about it.

    Returns the task's execution details plus how many times the executor signalled the
    concurrency controller — the observable difference between a throttled failure, which backs
    concurrency off, and an ordinary one, which does not.
    """

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


async def test_rate_limit_error_is_retried_and_backs_off_concurrency() -> None:
    details, backoffs = await run_until_settled(RateLimitError())
    assert len(details.exceptions) == MAX_RETRIES + 1
    assert details.status is ExecutionStatus.FAILED
    assert backoffs == MAX_RETRIES


async def test_internal_error_fails_fast_without_retrying() -> None:
    details, backoffs = await run_until_settled(PhoenixException("internal"))
    assert len(details.exceptions) == 1
    assert details.status is ExecutionStatus.FAILED
    assert backoffs == 0


async def test_unavailable_tokens_error_fails_fast_without_retrying() -> None:
    details, backoffs = await run_until_settled(UnavailableTokensError())
    assert len(details.exceptions) == 1
    assert details.status is ExecutionStatus.FAILED
    assert backoffs == 0


async def test_unrecognized_error_is_retried_without_backing_off_concurrency() -> None:
    details, backoffs = await run_until_settled(ValueError("provider blew up"))
    assert len(details.exceptions) == MAX_RETRIES + 1
    assert details.status is ExecutionStatus.FAILED
    assert backoffs == 0


async def test_rate_limit_error_from_an_older_evals_still_backs_off_concurrency() -> None:
    with legacy_evals_installed() as (legacy_rate_limit_error, _):
        details, backoffs = await run_until_settled(legacy_rate_limit_error())
    assert len(details.exceptions) == MAX_RETRIES + 1
    assert backoffs == MAX_RETRIES, (
        "an older evals raises a different class object, so without the compatibility shim this "
        "is demoted to an ordinary retry and the provider never sees the back-off"
    )


async def test_internal_error_from_an_older_evals_still_fails_fast() -> None:
    with legacy_evals_installed() as (_, legacy_phoenix_exception):
        details, backoffs = await run_until_settled(legacy_phoenix_exception("internal"))
    assert len(details.exceptions) == 1, (
        "without the compatibility shim this is retried to exhaustion instead of failing fast"
    )
    assert backoffs == 0


def test_absent_legacy_classes_resolve_to_an_empty_tuple() -> None:
    # isinstance(exc, ()) is unconditionally False, so "no older evals installed" needs no
    # placeholder class to check against.
    assert executors_module._legacy_rate_limit_errors() == ()  # pyright: ignore[reportPrivateUsage]
    assert executors_module._legacy_phoenix_exceptions() == ()  # pyright: ignore[reportPrivateUsage]


def test_sync_executor_raises_rate_limit_errors_immediately() -> None:
    # SyncExecutor has no rate-limit tier: RateLimitError subclasses PhoenixException, so it takes
    # the immediate-raise path rather than backing off the way AsyncExecutor does. That divergence
    # is longstanding; this pins it so a future change to it is a decision rather than a side
    # effect.
    attempts: List[int] = []

    def always_rate_limited(payload: Any) -> Any:
        attempts.append(1)
        raise RateLimitError()

    executor = SyncExecutor(
        always_rate_limited,
        max_retries=3,
        exit_on_error=False,
        termination_signal=None,
    )
    _, details = executor.run([0])

    assert len(attempts) == 1
    assert details[0].status is ExecutionStatus.FAILED


def test_sync_executor_retries_unrecognized_errors() -> None:
    attempts: List[int] = []

    def always_fails(payload: Any) -> Any:
        attempts.append(1)
        raise ValueError("provider blew up")

    executor = SyncExecutor(
        always_fails,
        max_retries=3,
        exit_on_error=False,
        termination_signal=None,
    )
    _, details = executor.run([0])

    assert len(attempts) == 4
    assert details[0].status is ExecutionStatus.FAILED


@pytest.mark.parametrize("exc", [PhoenixException("internal"), RateLimitError()])
def test_sync_executor_raises_every_phoenix_exception_immediately(exc: BaseException) -> None:
    attempts: List[int] = []

    def always_raises(payload: Any) -> Any:
        attempts.append(1)
        raise exc

    executor = SyncExecutor(
        always_raises,
        max_retries=3,
        exit_on_error=False,
        termination_signal=None,
    )
    executor.run([0])

    assert len(attempts) == 1
