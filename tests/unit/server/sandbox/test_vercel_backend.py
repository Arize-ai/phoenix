"""Tests for VercelSandboxBackend and VercelAdapter language routing.

Tests verify that build_backend() and execute() route correctly for both
PYTHON and TYPESCRIPT languages without importing the real vercel SDK.

The vercel SDK is mocked at the module level via unittest.mock.patch, so
these tests run even without the vercel-sandbox extra installed.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from phoenix.server.sandbox.types import ExecutionResult, SandboxBackend
from phoenix.server.sandbox.vercel_backend import (
    _DEFAULT_LANGUAGE,
    _LANGUAGE_CONFIGS,
    VercelAdapter,
    VercelSandboxBackend,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_sandbox(
    stdout: str = "output", stderr: str = "", exit_code: int = 0
) -> tuple[MagicMock, MagicMock]:
    """Return a mock AsyncSandbox context manager."""
    result = MagicMock()
    result.stdout = AsyncMock(return_value=stdout)
    result.stderr = AsyncMock(return_value=stderr)
    result.exit_code = exit_code

    sandbox = MagicMock()
    sandbox.run_command = AsyncMock(return_value=result)

    @asynccontextmanager
    async def _ctx(*args: Any, **kwargs: Any):  # type: ignore[no-untyped-def]
        yield sandbox

    mock_class = MagicMock()
    mock_class.create = AsyncMock(return_value=_ctx())
    return mock_class, sandbox


# ---------------------------------------------------------------------------
# VercelAdapter
# ---------------------------------------------------------------------------


class TestVercelAdapter:
    def test_key(self) -> None:
        assert VercelAdapter.key == "VERCEL"

    def test_supported_languages_includes_python_and_typescript(self) -> None:
        assert "PYTHON" in VercelAdapter.supported_languages
        assert "TYPESCRIPT" in VercelAdapter.supported_languages

    def test_build_backend_returns_sandbox_backend(self) -> None:
        adapter = VercelAdapter()
        backend = adapter.build_backend({"language": "PYTHON"})
        assert isinstance(backend, SandboxBackend)
        assert isinstance(backend, VercelSandboxBackend)

    def test_build_backend_python_language(self) -> None:
        adapter = VercelAdapter()
        backend = adapter.build_backend({"language": "PYTHON"})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._language == "PYTHON"

    def test_build_backend_typescript_language(self) -> None:
        adapter = VercelAdapter()
        backend = adapter.build_backend({"language": "TYPESCRIPT"})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._language == "TYPESCRIPT"

    def test_build_backend_defaults_to_typescript(self) -> None:
        adapter = VercelAdapter()
        backend = adapter.build_backend({})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._language == _DEFAULT_LANGUAGE

    def test_build_backend_language_is_uppercased(self) -> None:
        adapter = VercelAdapter()
        backend = adapter.build_backend({"language": "python"})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._language == "PYTHON"

    def test_build_backend_uses_config_api_key(self) -> None:
        adapter = VercelAdapter()
        backend = adapter.build_backend(
            {"PHOENIX_SANDBOX_VERCEL_API_KEY": "test-key", "language": "PYTHON"}
        )
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._token == "test-key"


# ---------------------------------------------------------------------------
# VercelSandboxBackend — runtime and command routing
# ---------------------------------------------------------------------------


class TestVercelSandboxBackendLanguageRouting:
    async def test_python_uses_python3_runtime(self) -> None:
        mock_class, sandbox = _make_mock_sandbox()

        with patch(
            "phoenix.server.sandbox.vercel_backend.AsyncSandbox",
            mock_class,
            create=True,
        ):
            # We need to patch the deferred import inside execute()
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
