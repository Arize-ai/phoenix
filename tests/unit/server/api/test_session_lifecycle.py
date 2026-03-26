"""Tests for sandbox session lifecycle helpers in subscriptions.py.

Covers _cleanup_sandbox_sessions:
- stop_session is called once per CodeEvaluatorRunner with the correct key
- non-CodeEvaluatorRunner evaluators are skipped
- errors from stop_session are swallowed (not re-raised)
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.server.api.subscriptions import _cleanup_sandbox_sessions


def _make_code_runner(stop_side_effect: Any = None) -> Any:
    """Return a mock CodeEvaluatorRunner with a mock sandbox backend."""
    from phoenix.server.api.evaluators import CodeEvaluatorRunner

    backend = AsyncMock()
    backend.stop_session = AsyncMock(side_effect=stop_side_effect)

    runner = MagicMock(spec=CodeEvaluatorRunner)
    runner._sandbox_backend = backend
    return runner


def _make_llm_evaluator() -> Any:
    """Return a mock LLMEvaluator (not CodeEvaluatorRunner)."""
    from phoenix.server.api.evaluators import LLMEvaluator

    return MagicMock(spec=LLMEvaluator)


class TestCleanupSandboxSessions:
    async def test_calls_stop_session_for_code_runner(self) -> None:
        runner = _make_code_runner()
        await _cleanup_sandbox_sessions([runner], session_key="test-key")
        runner._sandbox_backend.stop_session.assert_awaited_once_with("test-key")

    async def test_skips_non_code_runner_evaluators(self) -> None:
        llm = _make_llm_evaluator()
        runner = _make_code_runner()
        await _cleanup_sandbox_sessions([llm, runner], session_key="test-key")
        runner._sandbox_backend.stop_session.assert_awaited_once_with("test-key")
        assert not hasattr(llm, "_sandbox_backend") or not llm._sandbox_backend.stop_session.called

    async def test_calls_stop_for_each_code_runner(self) -> None:
        runner1 = _make_code_runner()
        runner2 = _make_code_runner()
        await _cleanup_sandbox_sessions([runner1, runner2], session_key="k")
        runner1._sandbox_backend.stop_session.assert_awaited_once_with("k")
        runner2._sandbox_backend.stop_session.assert_awaited_once_with("k")

    async def test_swallows_stop_session_errors(self) -> None:
        runner = _make_code_runner(stop_side_effect=RuntimeError("backend unavailable"))
        # Should not raise even when stop_session fails
        await _cleanup_sandbox_sessions([runner], session_key="fail-key")

    async def test_empty_evaluators_list(self) -> None:
        # No evaluators — should complete without error
        await _cleanup_sandbox_sessions([], session_key="empty")

    async def test_session_key_is_passed_through(self) -> None:
        runner = _make_code_runner()
        key = "experiment-42-abc123de"
        await _cleanup_sandbox_sessions([runner], session_key=key)
        runner._sandbox_backend.stop_session.assert_awaited_once_with(key)

    async def test_second_runner_called_even_if_first_fails(self) -> None:
        runner1 = _make_code_runner(stop_side_effect=Exception("first fails"))
        runner2 = _make_code_runner()
        await _cleanup_sandbox_sessions([runner1, runner2], session_key="k")
        runner2._sandbox_backend.stop_session.assert_awaited_once_with("k")


@pytest.mark.parametrize("session_key", ["", "experiment-1-ffffffff"])
async def test_cleanup_with_parametrized_keys(session_key: str) -> None:
    runner = _make_code_runner()
    await _cleanup_sandbox_sessions([runner], session_key=session_key)
    runner._sandbox_backend.stop_session.assert_awaited_once_with(session_key)
