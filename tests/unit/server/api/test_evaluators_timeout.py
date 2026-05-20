from __future__ import annotations

import asyncio
import logging
from typing import ClassVar

import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.evaluators import (
    _PHOENIX_RESULT_BEGIN,
    _PHOENIX_RESULT_END,
    CodeEvaluatorRunner,
)
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import ExecutionResult, SandboxBackend


def _fenced(payload: str) -> str:
    return f"{_PHOENIX_RESULT_BEGIN}\n{payload}\n{_PHOENIX_RESULT_END}\n"


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


def _make_runner(
    backend: SandboxBackend,
    timeout: int = 1,
    manager: SandboxSessionManager | None = None,
) -> CodeEvaluatorRunner:
    test_manager = manager if manager is not None else SandboxSessionManager()
    test_manager.eviction_grace_seconds = 0.05
    return CodeEvaluatorRunner(
        name="test-runner",
        description=None,
        source_code='def evaluate(**kw): return "pass"',
        stored_output_configs=[_categorical_config()],
        sandbox_backend=backend,
        language="PYTHON",
        timeout=timeout,
        sandbox_session_manager=test_manager,
        session_key="evaluator:test-runner",
    )


_EMPTY_MAPPING = InputMapping(literal_mapping={}, path_mapping={})


class _SlowBackend(SandboxBackend):
    # CodeEvaluatorRunner reads secret_values to seed SandboxSecretMasker;
    # real backends get this attached by build_sandbox_backend(). Direct
    # test fixtures must declare it themselves.
    secret_values: frozenset[str] = frozenset()
    family: ClassVar[str] = "TEST"

    def __init__(self, close_raises: Exception | None = None) -> None:
        self.close_session_calls: list[str] = []
        self._close_raises = close_raises

    def config_fingerprint(self) -> str:
        return "slow"

    async def find_or_create_session(self, session_key: str) -> object:
        return object()

    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: int | None = None,
    ) -> ExecutionResult:
        await asyncio.sleep(60)
        return ExecutionResult(stdout='"pass"', stderr="", error=None)

    async def close_session(self, session_key: str) -> None:
        self.close_session_calls.append(session_key)
        if self._close_raises is not None:
            raise self._close_raises

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
    # See _SlowBackend.secret_values for rationale.
    secret_values: frozenset[str] = frozenset()
    family: ClassVar[str] = "TEST"

    def __init__(self, result: ExecutionResult) -> None:
        self._result = result
        self.close_session_calls: list[str] = []

    def config_fingerprint(self) -> str:
        return "fast"

    async def find_or_create_session(self, session_key: str) -> object:
        return object()

    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: int | None = None,
    ) -> ExecutionResult:
        return self._result

    async def close_session(self, session_key: str) -> None:
        self.close_session_calls.append(session_key)

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
    async def test_slow_backend_schedules_close_session(self) -> None:
        backend = _SlowBackend()
        runner = _make_runner(backend, timeout=1)
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        await asyncio.sleep(0)
        assert len(backend.stop_session_calls) == 1

    @pytest.mark.asyncio
    async def test_close_session_exception_during_timeout_does_not_propagate(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        backend = _SlowBackend(close_raises=RuntimeError("close failed"))
        runner = _make_runner(backend, timeout=1)

        with caplog.at_level(logging.WARNING):
            results = await runner.evaluate(
                context={},
                input_mapping=_EMPTY_MAPPING,
                name="test",
                output_configs=[_categorical_config()],
            )
            await asyncio.sleep(0)

        assert len(results) == 1
        assert results[0]["error"] == "timeout"
        assert any("close" in r.message.lower() for r in caplog.records)

    @pytest.mark.asyncio
    async def test_fast_backend_result_passes_through_unchanged(self) -> None:
        backend = _FastBackend(ExecutionResult(stdout=_fenced('"pass"'), stderr="", error=None))
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
        assert len(backend.close_session_calls) == 0

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
        assert len(backend.close_session_calls) == 0


class TestSessionInvalidatedRetry:
    """``SessionInvalidated`` is a transient admit refusal raised against a
    mid-drain tracked entry; the runner must wait for drain and retry once
    before surfacing as terminal."""

    @pytest.mark.asyncio
    async def test_retry_after_drain_succeeds(self) -> None:
        """A SessionInvalidated raised on the first acquire, with the drain
        completing within ``eviction_grace_seconds * 2``, must surface as a
        successful execute on the retry — not as a terminal error."""
        backend = _FastBackend(ExecutionResult(stdout=_fenced('"pass"'), stderr="", error=None))
        manager = SandboxSessionManager()
        manager.eviction_grace_seconds = 0.05

        # Pre-populate a marked-for-eviction tracked entry so the first
        # acquire raises SessionInvalidated. We schedule the entry's removal
        # before the runner's retry-wait would time out, simulating the last
        # release popping it.
        composite = "evaluator:test-runner#fast"
        async with manager.acquire(backend, "evaluator:test-runner"):
            pass
        manager._tracked[composite].marked_for_eviction = True

        async def _release_after_delay() -> None:
            await asyncio.sleep(0.02)
            manager._tracked.pop(composite, None)

        asyncio.create_task(_release_after_delay())

        runner = _make_runner(backend, timeout=5, manager=manager)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] is None
        assert results[0]["label"] == "pass"

    @pytest.mark.asyncio
    async def test_retry_with_undrained_entry_surfaces_terminal(self) -> None:
        """If the marked entry stays in-flight past the wait_for_drain
        timeout, ``wait_for_drain`` raises ``asyncio.TimeoutError`` which
        surfaces as a sandbox-execution-failure terminal error result — NOT
        as a hang."""
        backend = _FastBackend(ExecutionResult(stdout=_fenced('"pass"'), stderr="", error=None))
        manager = SandboxSessionManager()
        manager.eviction_grace_seconds = 0.01

        composite = "evaluator:test-runner#fast"
        async with manager.acquire(backend, "evaluator:test-runner"):
            pass
        manager._tracked[composite].marked_for_eviction = True
        # Bump in_flight_count so it can't be popped by _release on its own.
        manager._tracked[composite].in_flight_count = 1

        runner = _make_runner(backend, timeout=5, manager=manager)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        # The wait_for_drain TimeoutError surfaces as a generic sandbox
        # execution failure; the important contract is that it does NOT hang
        # and DOES produce a result.
        assert results[0]["error"] is not None


class TestTimeoutTeardownKeying:
    """Regression tests for the timeout teardown path.

    Guards two bugs:

    1. Wrong session key (resource leak). When ``session_key`` is overridden
       (the inline-preview path, where the mutation derives the key from
       ``(user_id, sandbox_config_id, language)`` server-side instead of
       using ``self._name``), teardown must use the override key — not
       ``self._name``. Otherwise the backend's ``close_session`` looks up a
       non-existent key and leaks the sandbox.

    2. Manager state desync (dead-session reuse). Teardown must route through
       ``schedule_eviction(session_key, backend)`` so the manager's
       ``_tracked`` entry is removed atomically with the provider-side
       teardown. The caller passes the bound backend; it does not compose
       the composite key itself.
    """

    @pytest.mark.asyncio
    async def test_override_session_key_used_for_teardown(self) -> None:
        backend = _SlowBackend()
        manager = SandboxSessionManager()
        manager.eviction_grace_seconds = 0.05
        # Realistic inline-preview key shape: derived server-side from
        # (user_id, sandbox_config_id, language). Format is manager-internal
        # — chosen here so the test documents what real overrides look like.
        override = "inline:42:U2FuZGJveENvbmZpZzox:python"
        runner = CodeEvaluatorRunner(
            name="test-runner",
            description=None,
            source_code='def evaluate(**kw): return "pass"',
            stored_output_configs=[_categorical_config()],
            sandbox_backend=backend,
            language="PYTHON",
            timeout=1,
            session_key=override,
            sandbox_session_manager=manager,
        )

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        for _ in range(50):
            await asyncio.sleep(0.01)
            if backend.close_session_calls:
                break

        # close_session must be called with a composite key derived from the
        # override key — NOT self._name. The manager composes
        # f"{session_key}#{backend.config_fingerprint()}" internally.
        assert backend.close_session_calls == [f"{override}#slow"]

    @pytest.mark.asyncio
    async def test_manager_teardown_evicts_tracked_entry(self) -> None:
        backend = _SlowBackend()
        manager = SandboxSessionManager()
        manager.eviction_grace_seconds = 0.05

        runner = CodeEvaluatorRunner(
            name="test-runner",
            description=None,
            source_code='def evaluate(**kw): return "pass"',
            stored_output_configs=[_categorical_config()],
            sandbox_backend=backend,
            language="PYTHON",
            timeout=1,
            sandbox_session_manager=manager,
            session_key="evaluator:test-runner",
        )

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        for _ in range(50):
            await asyncio.sleep(0.01)
            if backend.close_session_calls and not manager._tracked:
                break

        assert backend.close_session_calls == ["evaluator:test-runner#slow"]
        assert manager._tracked == {}

    @pytest.mark.asyncio
    async def test_timeout_caller_passes_session_key_and_backend(self) -> None:
        """The timeout-teardown call site must invoke
        ``schedule_eviction(session_key, backend)`` — passing the bound
        backend, not a pre-composed composite key.

        Regression guard: the manager owns the composite-key composition.
        If a caller ever reaches into ``_composite_key`` or fabricates the
        ``"{key}#{fingerprint}"`` string itself, this test would catch the
        leak.
        """
        backend = _SlowBackend()
        manager = SandboxSessionManager()
        manager.eviction_grace_seconds = 0.05
        calls: list[tuple[str, SandboxBackend]] = []
        original = manager.schedule_eviction

        def _spy(session_key: str, b: SandboxBackend) -> None:
            calls.append((session_key, b))
            original(session_key, b)

        manager.schedule_eviction = _spy  # type: ignore[method-assign,assignment]

        runner = _make_runner(backend, timeout=1, manager=manager)
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )

        assert len(calls) == 1
        session_key_arg, backend_arg = calls[0]
        assert session_key_arg == "evaluator:test-runner"
        assert backend_arg is backend
        assert "#" not in session_key_arg
