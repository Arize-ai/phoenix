"""Tests for the asyncio.wait_for timeout wrapper in CodeEvaluatorRunner.evaluate."""

from __future__ import annotations

import asyncio
import logging

import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.evaluators import CodeEvaluatorRunner
from phoenix.server.sandbox.types import ExecutionResult, SandboxBackend


def _categorical_config() -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name="score",
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description="",
        values=[
            CategoricalAnnotationValue(label="pass", score=1.0),
            CategoricalAnnotationValue(label="fail", score=0.0),
        ],
    )


def _make_runner(backend: SandboxBackend, timeout: int = 1) -> CodeEvaluatorRunner:
    return CodeEvaluatorRunner(
        name="test-runner",
        description=None,
        source_code='def evaluate(**kw): return "pass"',
        stored_output_configs=[_categorical_config()],
        sandbox_backend=backend,
        language="PYTHON",
        timeout=timeout,
    )


_EMPTY_MAPPING = InputMapping(literal_mapping={}, path_mapping={})


class _SlowBackend(SandboxBackend):
    """Backend whose execute sleeps indefinitely; stop_session is tracked."""

    def __init__(self, stop_raises: Exception | None = None) -> None:
        self.stop_session_calls: list[str] = []
        self._stop_raises = stop_raises

    async def start_session(self, session_key: str) -> None:
        pass

    async def stop_session(self, session_key: str) -> None:
        self.stop_session_calls.append(session_key)
        if self._stop_raises is not None:
            raise self._stop_raises

    async def execute(
        self,
        code: str,
        session_key: str = "",
        timeout: int | None = None,
    ) -> ExecutionResult:
        await asyncio.sleep(60)
        return ExecutionResult(stdout='"pass"', stderr="", error=None)

    async def close(self) -> None:
        pass


class _FastBackend(SandboxBackend):
    """Backend that returns immediately with a configurable result."""

    def __init__(self, result: ExecutionResult) -> None:
        self._result = result
        self.stop_session_calls: list[str] = []

    async def start_session(self, session_key: str) -> None:
        pass

    async def stop_session(self, session_key: str) -> None:
        self.stop_session_calls.append(session_key)

    async def execute(
        self,
        code: str,
        session_key: str = "",
        timeout: int | None = None,
    ) -> ExecutionResult:
        return self._result

    async def close(self) -> None:
        pass


class TestTimeoutWrapper:
    @pytest.mark.asyncio
    async def test_slow_backend_returns_timeout_execution_result(self) -> None:
        backend = _SlowBackend()
        runner = _make_runner(backend, timeout=1)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] == "timeout"

    @pytest.mark.asyncio
    async def test_slow_backend_schedules_stop_session(self) -> None:
        backend = _SlowBackend()
        runner = _make_runner(backend, timeout=1)
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        # Allow the fire-and-forget task to run
        await asyncio.sleep(0)
        assert len(backend.stop_session_calls) == 1

    @pytest.mark.asyncio
    async def test_stop_session_exception_during_timeout_does_not_propagate(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        backend = _SlowBackend(stop_raises=RuntimeError("stop failed"))
        runner = _make_runner(backend, timeout=1)

        with caplog.at_level(logging.WARNING):
            results = await runner.evaluate(
                context={},
                input_mapping=_EMPTY_MAPPING,
                name="test",
                output_configs=[_categorical_config()],
            )
            # Let the fire-and-forget task run and log
            await asyncio.sleep(0)

        assert len(results) == 1
        assert results[0]["error"] == "timeout"
        assert any("stop_session" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_fast_backend_result_passes_through_unchanged(self) -> None:
        backend = _FastBackend(ExecutionResult(stdout='"pass"', stderr="", error=None))
        runner = _make_runner(backend, timeout=30)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] is None
        assert results[0]["label"] == "pass"
        assert len(backend.stop_session_calls) == 0

    @pytest.mark.asyncio
    async def test_fast_backend_with_error_field_passes_through_unchanged(self) -> None:
        backend = _FastBackend(ExecutionResult(stdout="", stderr="", error="runtime error"))
        runner = _make_runner(backend, timeout=30)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] == "runtime error"
        assert len(backend.stop_session_calls) == 0
