"""Tests for the out-of-process sandbox behind the MCP code-mode ``execute`` tool.

The sandbox exists to keep untrusted, model-written Python from being able to
kill the Phoenix process. That property is not observable from a return value, so
these tests assert it directly: the payloads below are the ones that fault the
native interpreter, and the assertion is that the host survives them and the
provider keeps working afterwards.

The pool spawns real worker subprocesses, so these run against the actual sandbox
rather than a stub — a mocked worker could not demonstrate crash containment.
"""

from __future__ import annotations

import asyncio
import textwrap
from typing import Any

import pytest
from fastmcp.exceptions import ToolError
from pydantic_monty import MontyError, MontyRuntimeError, MontySyntaxError

from phoenix.server.mcp_code_mode import (
    DEFAULT_LIMITS,
    MontyPoolSandboxProvider,
)

# Faults the native interpreter when run in-process: the nesting is built by a
# loop, so its depth is a runtime value that no check on the source can see.
DEEPLY_NESTED_DUMP = textwrap.dedent("""\
    import json
    x = [1]
    i = 0
    while i < 30000:
        x = [x]
        i = i + 1
    return json.dumps(x)
""")

# Amplifies one tab into a multi-gigabyte buffer. The dangerous value is a
# runtime argument, not a property of the source.
HUGE_STRING_BUILD = "return '\\t'.expandtabs(10**9)"


@pytest.fixture
async def provider() -> Any:
    """A provider whose pool is torn down even if a test fails."""
    p = MontyPoolSandboxProvider()
    try:
        yield p
    finally:
        await p.aclose()


async def test_returns_result_of_top_level_return(provider: MontyPoolSandboxProvider) -> None:
    """``execute`` blocks produce output with ``return``, as the tool describes."""
    assert await provider.run("return 123 * 456") == 56088


async def test_returns_trailing_expression(provider: MontyPoolSandboxProvider) -> None:
    assert await provider.run("40 + 2") == 42


async def test_calls_async_external_function(provider: MontyPoolSandboxProvider) -> None:
    """``call_tool`` reaches the host and its result flows back into the guest."""

    async def call_tool(tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        await asyncio.sleep(0)
        return {"tool": tool_name, "n": params["n"] * 2}

    result = await provider.run(
        "r = await call_tool('double', {'n': 21})\nreturn r['n']",
        external_functions={"call_tool": call_tool},
    )
    assert result == 42


async def test_inputs_are_bound_as_globals(provider: MontyPoolSandboxProvider) -> None:
    assert await provider.run("return x + y", inputs={"x": 1, "y": 2}) == 3


async def test_guest_exception_reaches_the_caller(provider: MontyPoolSandboxProvider) -> None:
    """Errors in the model's own code surface with detail so it can self-correct.

    Asserted as a sandbox error rather than any exception, because the design
    decision under test is that these are *not* rewritten into ``ToolError``:
    the traceback is the useful part, and the remedy is a change to the code
    that was submitted.
    """
    with pytest.raises(MontyRuntimeError) as exc_info:
        await provider.run("raise ValueError('boom')")
    assert "boom" in str(exc_info.value)


async def test_syntax_error_reaches_the_caller(provider: MontyPoolSandboxProvider) -> None:
    with pytest.raises(MontySyntaxError):
        await provider.run("this is not python(")


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param(DEEPLY_NESTED_DUMP, id="deeply_nested_dump"),
        pytest.param(HUGE_STRING_BUILD, id="huge_string_build"),
        pytest.param(
            "def k(x):\n    return sorted([0, 1], key=k)\nreturn sorted([0, 1], key=k)",
            id="recursive_callback_reentry",
        ),
    ],
)
async def test_host_survives_interpreter_faulting_payload(
    provider: MontyPoolSandboxProvider, payload: str
) -> None:
    """The payloads that kill an in-process sandbox leave the host running.

    Both containment outcomes are a pass and the assertion admits both: the
    sandbox refuses the payload (``MontyError``), or the worker dies and the
    provider reports that as a ``ToolError``. What must not happen is the
    process disappearing, so reaching the next line at all is half the result,
    and the provider still executing code is the other half.

    Deliberately not narrowed to the specific error each payload raises today:
    a payload that graduates from "refused" to "killed the worker" is still
    contained, and should not fail this test.
    """
    with pytest.raises((MontyError, ToolError)):
        await provider.run(payload)
    assert await provider.run("return 1 + 1") == 2


async def test_guest_memory_limit_is_enforced(provider: MontyPoolSandboxProvider) -> None:
    with pytest.raises(MontyRuntimeError) as exc_info:
        await provider.run("return 'a' * (10 ** 9)")
    assert "memory" in str(exc_info.value).lower()


async def test_guest_duration_limit_is_enforced() -> None:
    """A compute-bound block is stopped by the guest duration limit."""
    provider = MontyPoolSandboxProvider(limits={"max_duration_secs": 1.0})
    try:
        with pytest.raises(MontyRuntimeError) as exc_info:
            await provider.run("while True:\n    pass")
        assert "time limit" in str(exc_info.value).lower()
    finally:
        await provider.aclose()


async def test_turn_timeout_reports_a_tool_error() -> None:
    """``request_timeout`` bounds the turn even with no guest limits.

    This is the bound that applies when a block spends its time awaiting host
    callbacks rather than computing, which the guest duration limit does not
    measure.
    """
    provider = MontyPoolSandboxProvider(limits=None, request_timeout=3.0)
    try:
        with pytest.raises(ToolError, match="exceeded"):
            await provider.run("while True:\n    pass")
    finally:
        await provider.aclose()


async def test_no_state_leaks_between_runs(provider: MontyPoolSandboxProvider) -> None:
    """Each run gets a fresh session, so one caller cannot observe another's."""
    await provider.run("secret = 'leaked'")
    with pytest.raises(Exception) as exc_info:
        await provider.run("return secret")
    assert "secret" in str(exc_info.value)


async def test_concurrent_runs_all_complete(provider: MontyPoolSandboxProvider) -> None:
    """More concurrent calls than workers all finish, queueing for capacity."""
    results = await asyncio.gather(*(provider.run(f"return {i} * 10") for i in range(8)))
    assert results == [i * 10 for i in range(8)]


async def test_saturated_pool_reports_a_tool_error() -> None:
    """Overload is reported as a busy sandbox instead of queueing without bound."""
    provider = MontyPoolSandboxProvider(
        limits={"max_duration_secs": 3.0}, max_processes=1, checkout_timeout=0.5
    )
    blocker = asyncio.ensure_future(provider.run("while True:\n    pass"))
    try:
        await asyncio.sleep(0.5)  # let the single worker be taken
        with pytest.raises(ToolError, match="busy"):
            await provider.run("return 1")
    finally:
        blocker.cancel()
        await asyncio.gather(blocker, return_exceptions=True)
        await provider.aclose()


async def test_cancelled_run_releases_its_worker_within_the_guest_limit() -> None:
    """A disconnecting client must not strand the worker it was using.

    Cancellation cannot itself stop a turn already running in the worker — the
    pool exposes no kill — so the block keeps running until a bound ends it, and
    ``run`` unwinds only then. For a compute-bound block that bound is the guest
    duration limit, which is why the wait below is scaled to it rather than to
    the much longer turn timeout.

    With a single worker, a stranded worker would make every later call fail, so
    the successful run afterwards is what shows it was returned.
    """
    limit = 2.0
    provider = MontyPoolSandboxProvider(
        limits={"max_duration_secs": limit}, max_processes=1, checkout_timeout=10.0
    )
    try:
        task = asyncio.ensure_future(provider.run("while True:\n    pass"))
        await asyncio.sleep(0.5)
        task.cancel()
        started = asyncio.get_running_loop().time()
        with pytest.raises(asyncio.CancelledError):
            await task
        # Bounded by the guest limit, not by the turn timeout that would apply
        # if the duration limit failed to stop the block.
        assert asyncio.get_running_loop().time() - started < limit * 3
        assert await provider.run("return 7 * 6") == 42
    finally:
        await provider.aclose()


async def test_pool_is_not_started_until_first_run() -> None:
    """A deployment that never calls ``execute`` never spawns a worker."""
    provider = MontyPoolSandboxProvider()
    assert provider._pool is None
    await provider.aclose()
    assert provider._pool is None


async def test_aclose_returns_promptly_while_a_run_is_in_flight() -> None:
    """Shutdown must not wait on a worker still running code.

    This runs on the server's shutdown path, so closing the pool has to kill its
    workers rather than let a busy one hold the process open.
    """
    # The guest limit only bounds how long the abandoned block lingers after the
    # test; the worker is still mid-run when `aclose` is called below, which is
    # the condition under test.
    provider = MontyPoolSandboxProvider(limits={"max_duration_secs": 3.0})
    running = asyncio.ensure_future(provider.run("while True:\n    pass"))
    try:
        await asyncio.sleep(0.5)  # let the worker actually start the block
        started = asyncio.get_running_loop().time()
        await provider.aclose()
        assert asyncio.get_running_loop().time() - started < 5.0
    finally:
        running.cancel()
        await asyncio.gather(running, return_exceptions=True)


async def test_aclose_is_idempotent_and_refuses_later_runs() -> None:
    provider = MontyPoolSandboxProvider()
    assert await provider.run("return 1") == 1
    await provider.aclose()
    await provider.aclose()
    with pytest.raises(ToolError, match="shutting down"):
        await provider.run("return 1")


async def test_default_limits_are_not_shared_between_providers() -> None:
    """Mutating one provider's limits must not change the defaults or another's."""
    first = MontyPoolSandboxProvider()
    assert first.limits is not None
    first.limits["max_memory"] = 1
    second = MontyPoolSandboxProvider()
    assert second.limits is not None
    assert second.limits["max_memory"] == DEFAULT_LIMITS["max_memory"]
    assert DEFAULT_LIMITS["max_memory"] != 1
