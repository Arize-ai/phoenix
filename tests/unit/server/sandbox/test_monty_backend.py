from __future__ import annotations

import json
import time
from typing import AsyncIterator
from unittest.mock import AsyncMock

import pytest

from phoenix.server.api.evaluators import _extract_fenced_result
from phoenix.server.monty_runtime import (
    DEFAULT_GUEST_MAX_MEMORY_BYTES,
    DEFAULT_GUEST_MAX_RECURSION_DEPTH,
    MontyBusy,
    MontyRuntime,
)
from phoenix.server.sandbox.monty_backend import (
    DEFAULT_RESULT_BYTES,
    DEFAULT_STREAM_OUTPUT_BYTES,
    MontyAdapter,
    MontySandboxBackend,
    _BoundedTextSink,
)
from phoenix.server.sandbox.types import (
    MontyConfig,
    SandboxRuntimeContext,
    SandboxValidationUnavailable,
)


@pytest.fixture
async def runtime() -> AsyncIterator[MontyRuntime]:
    runtime = MontyRuntime()
    try:
        yield runtime
    finally:
        await runtime.aclose()


def test_bounded_text_sink_never_retains_more_than_its_limit() -> None:
    sink = _BoundedTextSink(limit=8)

    sink.write("aaaa")
    sink.write("bbbb")
    sink.write("cccc")

    assert len(sink._buffer) == 8
    assert sink.getvalue() == "[output truncated: 4 earlier bytes dropped]\nbbbbcccc"


async def test_execute_serializes_returned_value_after_unterminated_stdout(
    runtime: MontyRuntime,
) -> None:
    backend = MontySandboxBackend(runtime)

    result = await backend.execute(
        "print('running', end='')\n{'label': 'pass', 'score': 1}",
        session_key="",
        timeout=1,
    )

    fenced_result, stdout = _extract_fenced_result(result.stdout)

    assert result.success
    assert fenced_result is not None
    assert json.loads(fenced_result) == {"label": "pass", "score": 1}
    assert stdout == "running"


async def test_validate_code_runs_in_worker(runtime: MontyRuntime) -> None:
    error = await MontyAdapter().validate_code(
        MontyConfig(),
        "import definitely_missing\ndef evaluate(output):\n    return output",
        runtime=SandboxRuntimeContext(monty=runtime),
    )

    assert error is not None
    assert "ModuleNotFoundError" in error


async def test_validate_code_reports_unavailable_runtime(runtime: MontyRuntime) -> None:
    runtime.run = AsyncMock(side_effect=MontyBusy("validation capacity is busy"))  # type: ignore[method-assign]

    with pytest.raises(SandboxValidationUnavailable, match="retry shortly"):
        await MontyAdapter().validate_code(
            MontyConfig(),
            "def evaluate(output):\n    return output",
            runtime=SandboxRuntimeContext(monty=runtime),
        )

    assert runtime.run.call_args.kwargs["consumer"] == "validation"


async def test_execute_propagates_infrastructure_failure(runtime: MontyRuntime) -> None:
    runtime.run = AsyncMock(side_effect=MontyBusy("evaluator capacity is busy"))  # type: ignore[method-assign]

    with pytest.raises(MontyBusy, match="capacity is busy"):
        await MontySandboxBackend(runtime).execute("return 1", session_key="", timeout=1)


async def test_execute_applies_resource_limits(runtime: MontyRuntime) -> None:
    runtime.run = AsyncMock(return_value=1)  # type: ignore[method-assign]

    result = await MontySandboxBackend(runtime).execute("return 1", session_key="", timeout=7)

    assert result.success
    assert runtime.run.call_args.kwargs["limits"] == {
        "max_duration_secs": 7.0,
        "max_memory": DEFAULT_GUEST_MAX_MEMORY_BYTES,
        "max_recursion_depth": DEFAULT_GUEST_MAX_RECURSION_DEPTH,
    }


async def test_execute_truncates_guest_output(runtime: MontyRuntime) -> None:
    async def run_with_output(*args: object, **kwargs: object) -> int:
        del args
        callback = kwargs["print_callback"]
        assert callable(callback)
        callback("stdout", "x" * (DEFAULT_STREAM_OUTPUT_BYTES + 10))
        return 1

    runtime.run = AsyncMock(side_effect=run_with_output)  # type: ignore[method-assign]

    result = await MontySandboxBackend(runtime).execute("return 1", session_key="", timeout=1)

    assert result.success
    assert result.stdout.startswith("[output truncated: 10 earlier bytes dropped]")
    assert "===PHOENIX_RESULT_BEGIN===" in result.stdout


async def test_execute_rejects_oversized_result(runtime: MontyRuntime) -> None:
    runtime.run = AsyncMock(return_value="x" * DEFAULT_RESULT_BYTES)  # type: ignore[method-assign]

    result = await MontySandboxBackend(runtime).execute("return 1", session_key="", timeout=1)

    assert not result.success
    assert result.error == f"Monty result exceeded the {DEFAULT_RESULT_BYTES}-byte output limit"


async def test_execute_interrupts_runaway_loop_in_worker(runtime: MontyRuntime) -> None:
    started_at = time.monotonic()

    result = await MontySandboxBackend(runtime).execute(
        "while True:\n    pass",
        session_key="",
        timeout=1,
    )

    assert not result.success
    assert time.monotonic() - started_at < 5
    assert result.error is not None
    assert "TimeoutError" in result.error
    assert "time limit exceeded" in result.error


def test_adapter_requires_application_runtime() -> None:
    with pytest.raises(ValueError, match="runtime is unavailable"):
        MontyAdapter().build_backend(
            MontyConfig(),
            credentials=MontyAdapter.credentials_model(),
            deployment=MontyAdapter.deployment_config_model(),
        )


def test_adapter_uses_application_runtime(runtime: MontyRuntime) -> None:
    backend = MontyAdapter().build_backend(
        MontyConfig(),
        credentials=MontyAdapter.credentials_model(),
        deployment=MontyAdapter.deployment_config_model(),
        runtime=SandboxRuntimeContext(monty=runtime),
    )

    assert isinstance(backend, MontySandboxBackend)
    assert backend._runtime is runtime
