"""Tests for the out-of-process sandbox behind the MCP code-mode ``execute`` tool.

Run against real worker subprocesses: a mocked worker could not demonstrate crash
containment.
"""

from __future__ import annotations

import asyncio
import textwrap
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import pytest
from fastmcp.exceptions import ToolError
from pydantic_monty import MontyError, MontyRuntimeError, MontySyntaxError

from phoenix.server.mcp_code_mode import (
    DEFAULT_LIMITS,
    MontyPoolSandboxProvider,
)
from phoenix.server.monty_runtime import MontyRuntime, MontyShuttingDown

# Faults the native interpreter in-process; depth is a runtime value, invisible
# to any check on the source.
DEEPLY_NESTED_DUMP = textwrap.dedent("""\
    import json
    x = [1]
    i = 0
    while i < 30000:
        x = [x]
        i = i + 1
    return json.dumps(x)
""")

# Amplifies one tab into a multi-gigabyte buffer.
HUGE_STRING_BUILD = "return '\\t'.expandtabs(10**9)"


@pytest.fixture
async def provider() -> AsyncIterator[MontyPoolSandboxProvider]:
    """A provider whose pool is torn down even if a test fails."""
    async with _standalone_provider() as sandbox:
        yield sandbox


@asynccontextmanager
async def _standalone_provider(
    *,
    limits: Any = None,
    max_processes: int = 4,
    request_timeout: float = 180.0,
    total_timeout: float | None = 300.0,
    checkout_timeout: float = 30.0,
) -> AsyncIterator[MontyPoolSandboxProvider]:
    runtime = MontyRuntime(
        max_processes=max_processes,
        request_timeout=request_timeout,
        checkout_timeout=checkout_timeout,
        consumer_limits={"mcp": max_processes},
    )
    try:
        yield MontyPoolSandboxProvider(
            runtime=runtime,
            limits=limits,
            total_timeout=total_timeout,
        )
    finally:
        await runtime.aclose()


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


async def test_external_function_timeout_is_not_misclassified_as_capacity(
    provider: MontyPoolSandboxProvider,
) -> None:
    async def call_tool(tool_name: str, params: dict[str, Any]) -> None:
        del tool_name, params
        raise TimeoutError("host tool timed out")

    with pytest.raises(MontyRuntimeError, match="host tool timed out"):
        await provider.run(
            "await call_tool('slow', {})",
            external_functions={"call_tool": call_tool},
        )


async def test_inputs_are_bound_as_globals(provider: MontyPoolSandboxProvider) -> None:
    assert await provider.run("return x + y", inputs={"x": 1, "y": 2}) == 3


async def test_guest_exception_reaches_the_caller(provider: MontyPoolSandboxProvider) -> None:
    """Guest errors reach the model with detail, not rewritten into ``ToolError``."""
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
    """Payloads that kill an in-process sandbox leave the host running.

    Admits either containment outcome — refused, or worker killed — since both
    mean the process survived.
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
    async with _standalone_provider(limits={"max_duration_secs": 1.0}) as provider:
        with pytest.raises(MontyRuntimeError) as exc_info:
            await provider.run("while True:\n    pass")
        assert "time limit" in str(exc_info.value).lower()


async def test_turn_timeout_reports_a_tool_error() -> None:
    """``request_timeout`` reclaims a worker before its longer guest limit."""
    async with _standalone_provider(
        limits={"max_duration_secs": 60.0}, request_timeout=2.0
    ) as provider:
        with pytest.raises(ToolError, match="stopped responding"):
            await provider.run("while True:\n    pass")


async def test_none_and_omitted_limits_use_defaults() -> None:
    runtime = MontyRuntime()
    try:
        assert MontyPoolSandboxProvider(runtime=runtime, limits=None).limits == DEFAULT_LIMITS
        assert MontyPoolSandboxProvider(runtime=runtime).limits == DEFAULT_LIMITS
    finally:
        await runtime.aclose()


async def test_total_timeout_bounds_a_block_dominated_by_tool_calls() -> None:
    """Only the end-to-end ceiling sees host-callback time; the other bounds here
    are far larger than the total."""

    async def slow_tool(tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        await asyncio.sleep(1.0)
        return {"ok": True}

    code = "i = 0\nwhile i < 30:\n    r = await call_tool('t', {})\n    i = i + 1\nreturn i"
    async with _standalone_provider(
        limits={"max_duration_secs": 60.0},
        request_timeout=60.0,
        total_timeout=3.0,
    ) as provider:
        with pytest.raises(ToolError, match="tool calls took"):
            await provider.run(code, external_functions={"call_tool": slow_tool})


async def test_total_timeout_bounds_pool_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    """Acquisition is inside the end-to-end envelope. Monty currently spawns
    lazily at checkout, so today a wedged install hangs there — but spawn-at-
    startup is upstream's to change, and it happens under the provider lock."""
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime, total_timeout=0.2)

    async def hang() -> Any:
        await asyncio.Event().wait()

    monkeypatch.setattr(provider._runtime, "_ensure_pool", hang)
    try:
        with pytest.raises(ToolError, match="exceeded the"):
            await asyncio.wait_for(provider.run("return 1"), timeout=5.0)
    finally:
        await runtime.aclose()


@pytest.mark.real_monty_runtime_probe
async def test_runtime_probe_reports_a_working_sandbox_and_leaves_nothing_running() -> None:
    runtime = MontyRuntime()
    try:
        assert await runtime.probe_runtime() is True
        assert runtime._pool is None, "startup probe must not warm the shared pool"
    finally:
        await runtime.aclose()


@pytest.mark.real_monty_runtime_probe
async def test_runtime_probe_reports_a_broken_install(monkeypatch: pytest.MonkeyPatch) -> None:
    """A broken install is reported at boot rather than raising into startup."""
    monkeypatch.setenv("MONTY_BIN", "/nonexistent/monty-binary")
    runtime = MontyRuntime()
    try:
        assert await runtime.probe_runtime() is False
    finally:
        await runtime.aclose()


@pytest.mark.real_monty_runtime_probe
async def test_runtime_probe_is_bounded_when_the_install_hangs(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    """A binary that spawns but never speaks the protocol hits no per-turn
    bound, so only the startup-check ceiling keeps boot from stalling."""
    stub = tmp_path / "monty"
    stub.write_text("#!/bin/sh\nexec sleep 3600\n")
    stub.chmod(0o755)
    monkeypatch.setenv("MONTY_BIN", str(stub))
    monkeypatch.setattr("phoenix.server.monty_runtime.STARTUP_CHECK_TIMEOUT", 1.0)
    runtime = MontyRuntime()
    try:
        assert await asyncio.wait_for(runtime.probe_runtime(), timeout=10.0) is False
    finally:
        await runtime.aclose()


@pytest.mark.real_monty_runtime_probe
async def test_runtime_probe_reports_teardown_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def successful_run(self: MontyRuntime, *args: Any, **kwargs: Any) -> int:
        del self, args, kwargs
        return 1

    async def failing_close(self: MontyRuntime) -> None:
        del self
        raise RuntimeError("probe teardown failed")

    monkeypatch.setattr(MontyRuntime, "run", successful_run)
    monkeypatch.setattr(MontyRuntime, "aclose", failing_close)

    assert await MontyRuntime().probe_runtime() is False


async def test_unstartable_pool_reports_a_tool_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """A sandbox that cannot start is a deployment fault, not a bare exception."""
    monkeypatch.setenv("MONTY_BIN", "/nonexistent/monty-binary")
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime)
    try:
        with pytest.raises(ToolError, match="could not be started"):
            await provider.run("return 1")
    finally:
        await runtime.aclose()


async def test_pool_startup_failure_of_any_type_reports_a_tool_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Startup failures are not confined to OSError.

    Locating the worker binary happens inside pool startup, and upstream's
    editable-install probe walks four parent directories unguarded, so an
    install nearer the filesystem root — a container that flattens
    site-packages onto its Python path, for one — raises IndexError instead of
    FileNotFoundError. Type-based handling would let that reach the caller raw.
    """

    def unresolvable_binary(*args: Any, **kwargs: Any) -> Any:
        del args, kwargs
        raise IndexError("tuple index out of range")

    monkeypatch.setattr("pydantic_monty.AsyncMonty", unresolvable_binary)
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime)
    try:
        with pytest.raises(ToolError, match="could not be started"):
            await provider.run("return 1")
    finally:
        await runtime.aclose()


async def test_dropped_pool_during_shutdown_reports_a_tool_error() -> None:
    """A call that loses its pool to shutdown reports shutdown, not RuntimeError."""
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime)
    pool = await provider._runtime._ensure_pool()  # the handle an in-flight run would hold
    await runtime.aclose()
    with pytest.raises(MontyShuttingDown, match="shutting down"):
        await provider._runtime._feed(
            pool,
            "return 1",
            limits=provider.limits,
            inputs=None,
            external_functions=None,
            print_callback=None,
        )


async def test_no_state_leaks_between_runs(provider: MontyPoolSandboxProvider) -> None:
    """Each run gets a fresh session, so one caller cannot observe another's."""
    await provider.run("secret = 'leaked'")
    with pytest.raises(Exception) as exc_info:
        await provider.run("return secret")
    assert "secret" in str(exc_info.value)


async def test_guest_print_does_not_write_to_server_output(
    provider: MontyPoolSandboxProvider,
    capsys: pytest.CaptureFixture[str],
) -> None:
    await provider.run("print('guest-output-must-be-discarded')\nreturn 1")

    captured = capsys.readouterr()
    assert "guest-output-must-be-discarded" not in captured.out
    assert "guest-output-must-be-discarded" not in captured.err


async def test_concurrent_runs_all_complete(provider: MontyPoolSandboxProvider) -> None:
    """More concurrent calls than workers all finish, queueing for capacity."""
    results = await asyncio.gather(*(provider.run(f"return {i} * 10") for i in range(8)))
    assert results == [i * 10 for i in range(8)]


async def test_saturated_pool_reports_a_tool_error() -> None:
    """Overload is reported as a busy sandbox instead of queueing without bound."""
    async with _standalone_provider(
        limits={"max_duration_secs": 3.0},
        max_processes=1,
        checkout_timeout=0.5,
    ) as provider:
        blocker = asyncio.ensure_future(provider.run("while True:\n    pass"))
        try:
            await asyncio.sleep(0.5)  # let the single worker be taken
            with pytest.raises(ToolError, match="busy"):
                await provider.run("return 1")
        finally:
            blocker.cancel()
            await asyncio.gather(blocker, return_exceptions=True)


async def test_cancelled_run_releases_its_worker_within_the_guest_limit() -> None:
    """A cancelled run releases its worker once the guest limit ends the block.

    Cancellation cannot stop a turn already running — the pool exposes no kill —
    so ``run`` unwinds only when a bound ends it.
    """
    limit = 2.0
    async with _standalone_provider(
        limits={"max_duration_secs": limit},
        max_processes=1,
        checkout_timeout=10.0,
    ) as provider:
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


async def test_pool_is_not_started_until_first_run() -> None:
    """A deployment that never calls ``execute`` never spawns a worker."""
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime)
    assert provider._runtime._pool is None
    await runtime.aclose()
    assert provider._runtime._pool is None


async def test_runtime_close_drains_running_blocks_and_rejects_new_work() -> None:
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime)
    entered = asyncio.Event()
    release = asyncio.Event()

    async def block() -> int:
        entered.set()
        await release.wait()
        return 42

    running = asyncio.create_task(
        provider.run(
            "return await block()",
            external_functions={"block": block},
        )
    )
    await asyncio.wait_for(entered.wait(), timeout=5.0)
    closing = asyncio.create_task(runtime.aclose())
    await asyncio.sleep(0)

    assert not closing.done()
    with pytest.raises(ToolError, match="shutting down"):
        await provider.run("return 1")

    release.set()
    assert await running == 42
    await closing


async def test_runtime_close_forces_pool_close_after_grace_period(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("phoenix.server.monty_runtime.SHUTDOWN_GRACE_TIMEOUT", 0.1)
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime, limits={"max_duration_secs": 3.0})
    running = asyncio.create_task(provider.run("while True:\n    pass"))
    try:
        await asyncio.sleep(0.5)
        started = asyncio.get_running_loop().time()
        await runtime.aclose()
        assert asyncio.get_running_loop().time() - started < 1.0
        await asyncio.wait_for(runtime.aclose(), timeout=0.1)
    finally:
        running.cancel()
        await asyncio.gather(running, return_exceptions=True)


async def test_runtime_close_is_idempotent_and_refuses_later_runs() -> None:
    runtime = MontyRuntime()
    provider = MontyPoolSandboxProvider(runtime=runtime)
    assert await provider.run("return 1") == 1
    await runtime.aclose()
    await runtime.aclose()
    with pytest.raises(ToolError, match="shutting down"):
        await provider.run("return 1")


async def test_default_limits_are_not_shared_between_providers() -> None:
    """Mutating one provider's limits must not change the defaults or another's."""
    runtime = MontyRuntime()
    try:
        first = MontyPoolSandboxProvider(runtime=runtime)
        assert first.limits is not None
        first.limits["max_memory"] = 1
        second = MontyPoolSandboxProvider(runtime=runtime)
        assert second.limits is not None
        assert second.limits.get("max_memory") == DEFAULT_LIMITS.get("max_memory")
        assert DEFAULT_LIMITS.get("max_memory") != 1
    finally:
        await runtime.aclose()


def test_partial_consumer_limits_merge_with_defaults() -> None:
    runtime = MontyRuntime(consumer_limits={"mcp": 1})

    assert set(runtime._consumer_slots) == {"mcp", "agent", "evaluator", "validation"}
    assert runtime._consumer_slots["mcp"]._value == 1


def test_unknown_consumer_limit_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unknown Monty consumers"):
        MontyRuntime(consumer_limits={"unknown": 1})  # type: ignore[dict-item]
