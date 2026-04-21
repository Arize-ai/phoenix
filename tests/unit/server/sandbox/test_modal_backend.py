"""Tests for ModalSandboxBackend session lifecycle and ModalAdapter.

Per-adapter test files exist only for adapters with genuinely unique lifecycle
not captured by cross-adapter conformance (test_unified_config_contract.py) or
forwarding (test_user_env_forwarding.py). E2B, Deno, WASM do NOT have dedicated
files because their execution is uniform enough to be covered by conformance +
forwarding. Modal warrants a dedicated file due to its app/function lifecycle
distinct from other adapters.

Modal SDK is mocked via sys.modules patching since the import happens at
__init__ time (not deferred), so the mock must be in place before constructing
the backend.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from phoenix.server.sandbox.types import ExecutionResult, SandboxBackend

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_modal_mock() -> tuple[MagicMock, MagicMock]:
    """Return (modal_module_mock, sandbox_instance_mock).

    The modal_module_mock has:
    - modal.App.lookup() returning a MagicMock app
    - modal.Image.debian_slim() returning a MagicMock image
    - modal.Sandbox.create.aio() as an AsyncMock returning sandbox_instance
    """
    sandbox_instance = MagicMock()
    sandbox_instance.terminate = MagicMock()
    sandbox_instance.terminate.aio = AsyncMock()

    proc = MagicMock()
    proc.stdout = MagicMock()
    proc.stdout.read = MagicMock()
    proc.stdout.read.aio = AsyncMock(return_value="output")
    proc.stderr = MagicMock()
    proc.stderr.read = MagicMock()
    proc.stderr.read.aio = AsyncMock(return_value="")
    proc.wait = MagicMock()
    proc.wait.aio = AsyncMock()
    proc.returncode = 0
    sandbox_instance.exec = MagicMock()
    sandbox_instance.exec.aio = AsyncMock(return_value=proc)

    modal_mock = MagicMock()
    modal_mock.App.lookup = MagicMock(return_value=MagicMock())
    modal_mock.Image.debian_slim = MagicMock(return_value=MagicMock())
    modal_mock.Sandbox = MagicMock()
    modal_mock.Sandbox.create = MagicMock()
    modal_mock.Sandbox.create.aio = AsyncMock(return_value=sandbox_instance)

    return modal_mock, sandbox_instance


def _make_backend(**kwargs: Any) -> Any:
    """Construct a ModalSandboxBackend with modal mocked."""
    from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

    modal_mock, sandbox_instance = _make_modal_mock()
    with patch.dict("sys.modules", {"modal": modal_mock}):
        backend = ModalSandboxBackend(**kwargs)
    # Patch _create_sandbox to return fresh sandbox_instance on each call
    backend._create_sandbox = AsyncMock(return_value=sandbox_instance)  # type: ignore[method-assign]
    return backend, sandbox_instance, modal_mock


# ---------------------------------------------------------------------------
# ModalAdapter
# ---------------------------------------------------------------------------


class TestModalAdapter:
    def test_key(self) -> None:
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        assert ModalAdapter.key == "MODAL"

    def test_language(self) -> None:
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        assert ModalAdapter.language == "PYTHON"

    def test_build_backend_returns_sandbox_backend(self) -> None:
        from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

        modal_mock, _ = _make_modal_mock()
        with patch.dict("sys.modules", {"modal": modal_mock}):
            adapter = ModalAdapter()
            backend = adapter.build_backend({})
        assert isinstance(backend, SandboxBackend)
        assert isinstance(backend, ModalSandboxBackend)

    def test_build_backend_uses_default_timeouts(self) -> None:
        from phoenix.server.sandbox.modal_backend import (
            _DEFAULT_IDLE_TIMEOUT,
            _DEFAULT_TIMEOUT,
            ModalAdapter,
            ModalSandboxBackend,
        )

        modal_mock, _ = _make_modal_mock()
        with patch.dict("sys.modules", {"modal": modal_mock}):
            adapter = ModalAdapter()
            backend = adapter.build_backend({})
        assert isinstance(backend, ModalSandboxBackend)
        assert backend._timeout == _DEFAULT_TIMEOUT
        assert backend._idle_timeout == _DEFAULT_IDLE_TIMEOUT

    def test_build_backend_custom_timeouts(self) -> None:
        from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

        modal_mock, _ = _make_modal_mock()
        with patch.dict("sys.modules", {"modal": modal_mock}):
            adapter = ModalAdapter()
            backend = adapter.build_backend({"timeout": "120", "idle_timeout": "60"})
        assert isinstance(backend, ModalSandboxBackend)
        assert backend._timeout == 120
        assert backend._idle_timeout == 60


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------


class TestModalSandboxBackendSessionLifecycle:
    async def test_start_session_creates_and_caches_sandbox(self) -> None:
        backend, sandbox_instance, _ = _make_backend()

        await backend.start_session("key-1")

        assert "key-1" in backend._sessions
        assert backend._sessions["key-1"] is sandbox_instance

    async def test_start_session_reuses_existing_session(self) -> None:
        backend, sandbox_instance, _ = _make_backend()

        await backend.start_session("key-1")
        await backend.start_session("key-1")  # second call — should not create again

        backend._create_sandbox.assert_awaited_once()

    async def test_stop_session_terminates_sandbox(self) -> None:
        backend, sandbox_instance, _ = _make_backend()

        await backend.start_session("key-1")
        await backend.stop_session("key-1")

        sandbox_instance.terminate.aio.assert_awaited_once()
        assert "key-1" not in backend._sessions

    async def test_stop_session_unknown_key_does_not_raise(self) -> None:
        backend, _, _ = _make_backend()
        await backend.stop_session("nonexistent")  # should not raise

    async def test_close_terminates_all_sessions(self) -> None:
        backend, _, _ = _make_backend()
        sb1, sb2 = MagicMock(), MagicMock()
        sb1.terminate = MagicMock()
        sb1.terminate.aio = AsyncMock()
        sb2.terminate = MagicMock()
        sb2.terminate.aio = AsyncMock()
        backend._sessions = {"k1": sb1, "k2": sb2}

        await backend.close()

        sb1.terminate.aio.assert_awaited_once()
        sb2.terminate.aio.assert_awaited_once()
        assert backend._sessions == {}


# ---------------------------------------------------------------------------
# Execute — session-based and ephemeral paths
# ---------------------------------------------------------------------------


class TestModalSandboxBackendExecute:
    async def test_execute_uses_existing_session(self) -> None:
        backend, sandbox_instance, _ = _make_backend()

        await backend.start_session("s1")
        result = await backend.execute("print(1)", session_key="s1")

        assert isinstance(result, ExecutionResult)
        sandbox_instance.exec.aio.assert_awaited_once_with("python", "-c", "print(1)")
        # Ephemeral terminate should NOT have been called
        assert sandbox_instance.terminate.aio.await_count == 0

    async def test_execute_ephemeral_creates_and_terminates_sandbox(self) -> None:
        backend, sandbox_instance, _ = _make_backend()

        # No start_session — ephemeral path
        result = await backend.execute("print(1)", session_key="ephemeral-key")

        assert isinstance(result, ExecutionResult)
        backend._create_sandbox.assert_awaited_once()
        sandbox_instance.terminate.aio.assert_awaited_once()

    async def test_execute_returns_stdout(self) -> None:
        backend, sandbox_instance, _ = _make_backend()
        sandbox_instance.exec.aio.return_value.stdout.read.aio.return_value = "hello\n"

        await backend.start_session("s1")
        result = await backend.execute("print('hello')", session_key="s1")

        assert result.stdout == "hello\n"
        assert result.error is None

    async def test_execute_sets_error_on_nonzero_exit(self) -> None:
        backend, sandbox_instance, _ = _make_backend()
        sandbox_instance.exec.aio.return_value.stderr.read.aio.return_value = "traceback"
        sandbox_instance.exec.aio.return_value.returncode = 1

        await backend.start_session("s1")
        result = await backend.execute("bad code", session_key="s1")

        assert result.error == "traceback"

    async def test_execute_returns_error_result_on_exception(self) -> None:
        backend, _, _ = _make_backend()
        backend._create_sandbox = AsyncMock(side_effect=RuntimeError("network error"))

        result = await backend.execute("x", session_key="no-session")

        assert result.error is not None
        assert "network error" in result.error

    async def test_idle_timeout_set_on_create(self) -> None:
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        modal_mock, sandbox_instance = _make_modal_mock()
        with patch.dict("sys.modules", {"modal": modal_mock}):
            backend = ModalSandboxBackend(timeout=60, idle_timeout=30)
            await backend._create_sandbox()

        modal_mock.Sandbox.create.aio.assert_awaited_once()
        call_kwargs = modal_mock.Sandbox.create.aio.call_args.kwargs
        assert call_kwargs["idle_timeout"] == 30
        assert call_kwargs["timeout"] == 60
