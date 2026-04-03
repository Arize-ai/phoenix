"""Tests for VercelSandboxBackend and VercelPythonAdapter language routing.

Tests verify that build_backend() and execute() route correctly for PYTHON
without importing the real vercel SDK.

The vercel SDK is mocked at the module level via unittest.mock.patch, so
these tests run even without the vercel extra installed.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from phoenix.server.sandbox.types import ExecutionResult, SandboxBackend
from phoenix.server.sandbox.vercel_backend import (
    _DEFAULT_LANGUAGE,
    _LANGUAGE_CONFIGS,
    VercelPythonAdapter,
    VercelSandboxBackend,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_sandbox(
    stdout: str = "output", stderr: str = "", exit_code: int = 0
) -> tuple[MagicMock, MagicMock]:
    """Return (mock_AsyncSandbox_class, mock_sandbox_instance).

    mock_class.create is an AsyncMock that returns mock_sandbox directly,
    matching the real usage: sandbox = await AsyncSandbox.create(**kwargs)
    """
    result = MagicMock()
    result.stdout = AsyncMock(return_value=stdout)
    result.stderr = AsyncMock(return_value=stderr)
    result.exit_code = exit_code

    sandbox = MagicMock()
    sandbox.run_command = AsyncMock(return_value=result)
    sandbox.stop = AsyncMock()
    sandbox.client = MagicMock()
    sandbox.client.aclose = AsyncMock()

    mock_class = MagicMock()
    mock_class.create = AsyncMock(return_value=sandbox)
    return mock_class, sandbox


def _make_session_sandbox(
    stdout: str = "output", stderr: str = "", exit_code: int = 0
) -> MagicMock:
    """Return a plain sandbox mock (same shape as _make_mock_sandbox's sandbox)."""
    _, sandbox = _make_mock_sandbox(stdout=stdout, stderr=stderr, exit_code=exit_code)
    return sandbox


# ---------------------------------------------------------------------------
# VercelAdapter
# ---------------------------------------------------------------------------


class TestVercelPythonAdapter:
    def test_key(self) -> None:
        assert VercelPythonAdapter.key == "VERCEL_PYTHON"

    def test_language_is_python(self) -> None:
        assert VercelPythonAdapter.language == "PYTHON"

    def test_build_backend_returns_sandbox_backend(self) -> None:
        adapter = VercelPythonAdapter()
        backend = adapter.build_backend({"PHOENIX_SANDBOX_VERCEL_API_KEY": "tok"})
        assert isinstance(backend, SandboxBackend)
        assert isinstance(backend, VercelSandboxBackend)

    def test_build_backend_python_language(self) -> None:
        adapter = VercelPythonAdapter()
        backend = adapter.build_backend({"PHOENIX_SANDBOX_VERCEL_API_KEY": "tok"})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._language == "PYTHON"

    def test_build_backend_uses_config_api_key(self) -> None:
        adapter = VercelPythonAdapter()
        backend = adapter.build_backend({"PHOENIX_SANDBOX_VERCEL_API_KEY": "test-key"})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._token == "test-key"

    def test_build_backend_raises_without_token(self) -> None:
        import pytest

        adapter = VercelPythonAdapter()
        with pytest.raises(ValueError, match="token"):
            adapter.build_backend({})


# ---------------------------------------------------------------------------
# VercelSandboxBackend — runtime and command routing
# ---------------------------------------------------------------------------


class TestVercelSandboxBackendLanguageRouting:
    async def test_python_uses_python3_runtime(self) -> None:
        mock_class, _ = _make_mock_sandbox()

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.execute("print(1)", session_key="s")

        call_kwargs = mock_class.create.call_args.kwargs
        assert call_kwargs["runtime"] == _LANGUAGE_CONFIGS["PYTHON"]["runtime"]

    async def test_python_runs_python3_command(self) -> None:
        mock_class, sandbox = _make_mock_sandbox()

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.execute("print(1)", session_key="s")

        cmd, args = sandbox.run_command.call_args.args
        assert cmd == _LANGUAGE_CONFIGS["PYTHON"]["cmd"]
        assert args[0] == _LANGUAGE_CONFIGS["PYTHON"]["args_prefix"][0]
        assert args[-1] == "print(1)"

    async def test_typescript_uses_node_runtime(self) -> None:
        mock_class, sandbox = _make_mock_sandbox()

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="TYPESCRIPT")
            await backend.execute("console.log(1)", session_key="s")

        call_kwargs = mock_class.create.call_args.kwargs
        assert call_kwargs["runtime"] == _LANGUAGE_CONFIGS["TYPESCRIPT"]["runtime"]

    async def test_typescript_runs_node_command(self) -> None:
        mock_class, sandbox = _make_mock_sandbox()

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="TYPESCRIPT")
            await backend.execute("console.log(1)", session_key="s")

        cmd, args = sandbox.run_command.call_args.args
        assert cmd == _LANGUAGE_CONFIGS["TYPESCRIPT"]["cmd"]
        assert args[-1] == "console.log(1)"

    async def test_unknown_language_falls_back_to_default(self) -> None:
        mock_class, sandbox = _make_mock_sandbox()

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="COBOL")
            await backend.execute("x", session_key="s")

        call_kwargs = mock_class.create.call_args.kwargs
        assert call_kwargs["runtime"] == _LANGUAGE_CONFIGS[_DEFAULT_LANGUAGE]["runtime"]


# ---------------------------------------------------------------------------
# VercelSandboxBackend — ExecutionResult mapping
# ---------------------------------------------------------------------------


class TestVercelSandboxBackendResult:
    async def test_success_result(self) -> None:
        mock_class, _ = _make_mock_sandbox(stdout="hello", stderr="", exit_code=0)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            result = await backend.execute("print('hello')", session_key="s")

        assert isinstance(result, ExecutionResult)
        assert result.stdout == "hello"
        assert result.error is None

    async def test_nonzero_exit_sets_error(self) -> None:
        mock_class, _ = _make_mock_sandbox(stdout="", stderr="boom", exit_code=1)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            result = await backend.execute("bad code", session_key="s")

        assert result.error == "boom"

    async def test_exception_returns_error_result(self) -> None:
        mock_class = MagicMock()
        mock_class.create = AsyncMock(side_effect=RuntimeError("network error"))

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            result = await backend.execute("x", session_key="s")

        assert result.error is not None
        assert "network error" in result.error

    async def test_close_does_not_raise(self) -> None:
        backend = VercelSandboxBackend(token="tok")
        await backend.close()


# ---------------------------------------------------------------------------
# VercelSandboxBackend — session lifecycle
# ---------------------------------------------------------------------------


class TestVercelSandboxBackendSessions:
    async def test_start_session_creates_sandbox(self) -> None:
        sandbox = _make_session_sandbox()
        mock_class = MagicMock()
        mock_class.create = AsyncMock(return_value=sandbox)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.start_session("sess1")

        mock_class.create.assert_called_once()
        assert backend._sessions["sess1"] is sandbox

    async def test_start_session_is_idempotent(self) -> None:
        sandbox = _make_session_sandbox()
        mock_class = MagicMock()
        mock_class.create = AsyncMock(return_value=sandbox)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.start_session("sess1")
            await backend.start_session("sess1")

        # create() called exactly once — second call is a no-op
        mock_class.create.assert_called_once()

    async def test_execute_reuses_session_sandbox(self) -> None:
        sandbox = _make_session_sandbox(stdout="result")
        mock_class = MagicMock()
        mock_class.create = AsyncMock(return_value=sandbox)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.start_session("sess1")
            result = await backend.execute("print(1)", session_key="sess1")

        # create() only called by start_session, not by execute()
        mock_class.create.assert_called_once()
        sandbox.run_command.assert_called_once()
        assert result.stdout == "result"

    async def test_execute_reuses_sandbox_across_multiple_calls(self) -> None:
        sandbox = _make_session_sandbox(stdout="ok")
        mock_class = MagicMock()
        mock_class.create = AsyncMock(return_value=sandbox)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.start_session("sess1")
            await backend.execute("x = 1", session_key="sess1")
            await backend.execute("print(x)", session_key="sess1")

        # sandbox created once, run_command called twice
        mock_class.create.assert_called_once()
        assert sandbox.run_command.call_count == 2

    async def test_stop_session_terminates_sandbox(self) -> None:
        sandbox = _make_session_sandbox()
        mock_class = MagicMock()
        mock_class.create = AsyncMock(return_value=sandbox)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.start_session("sess1")
            await backend.stop_session("sess1")

        sandbox.stop.assert_called_once()
        sandbox.client.aclose.assert_called_once()
        assert "sess1" not in backend._sessions

    async def test_stop_session_noop_for_unknown_key(self) -> None:
        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock()},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            # Should not raise
            await backend.stop_session("nonexistent")

    async def test_ephemeral_execute_creates_and_tears_down(self) -> None:
        sandbox = _make_session_sandbox(stdout="ephemeral")
        mock_class = MagicMock()
        mock_class.create = AsyncMock(return_value=sandbox)

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            # No start_session — ephemeral execution
            result = await backend.execute("print(1)", session_key="ephemeral-key")

        mock_class.create.assert_called_once()
        sandbox.run_command.assert_called_once()
        # sandbox torn down after ephemeral use
        sandbox.stop.assert_called_once()
        sandbox.client.aclose.assert_called_once()
        assert result.stdout == "ephemeral"

    async def test_close_terminates_all_sessions(self) -> None:
        sandbox_a = _make_session_sandbox()
        sandbox_b = _make_session_sandbox()
        sandboxes = [sandbox_a, sandbox_b]
        mock_class = MagicMock()
        mock_class.create = AsyncMock(side_effect=lambda **kw: sandboxes.pop(0))

        with patch.dict(
            "sys.modules",
            {"vercel": MagicMock(), "vercel.sandbox": MagicMock(AsyncSandbox=mock_class)},
        ):
            backend = VercelSandboxBackend(token="tok", language="PYTHON")
            await backend.start_session("a")
            await backend.start_session("b")
            await backend.close()

        sandbox_a.stop.assert_called_once()
        sandbox_a.client.aclose.assert_called_once()
        sandbox_b.stop.assert_called_once()
        sandbox_b.client.aclose.assert_called_once()
        assert backend._sessions == {}
