from __future__ import annotations

import sys
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend
from phoenix.server.sandbox.e2b_backend import E2BSandboxBackend

# -- Helpers ------------------------------------------------------------------


@contextmanager
def _fake_e2b_module(mock_async_sandbox: MagicMock) -> Iterator[None]:
    """Inject a fake ``e2b_code_interpreter`` module so the lazy import succeeds."""
    mod = MagicMock()
    mod.AsyncSandbox = mock_async_sandbox
    prev = sys.modules.get("e2b_code_interpreter")
    sys.modules["e2b_code_interpreter"] = mod
    try:
        yield
    finally:
        if prev is None:
            sys.modules.pop("e2b_code_interpreter", None)
        else:
            sys.modules["e2b_code_interpreter"] = prev


@contextmanager
def _fake_daytona_module(mock_client: MagicMock) -> Iterator[None]:
    """Inject a fake ``daytona`` module so the lazy import succeeds."""
    mod = MagicMock()
    mod.AsyncDaytona = MagicMock(return_value=mock_client)
    mod.DaytonaConfig = MagicMock()
    prev = sys.modules.get("daytona")
    sys.modules["daytona"] = mod
    try:
        yield
    finally:
        if prev is None:
            sys.modules.pop("daytona", None)
        else:
            sys.modules["daytona"] = prev


def _mock_e2b_execution(stdout: list[str] | None = None, stderr: list[str] | None = None) -> Any:
    """Build a fake E2B execution result."""
    exec_result = MagicMock()
    exec_result.logs.stdout = stdout or ["hello"]
    exec_result.logs.stderr = stderr or []
    exec_result.error = None
    exec_result.exit_code = 0
    return exec_result


def _mock_daytona_result() -> MagicMock:
    """Build a fake Daytona code_run result."""
    result = MagicMock()
    result.result = "hello"
    result.exit_code = 0
    return result


# -- Task 14: execute with unknown session_key raises RuntimeError ------------


class TestExecuteUnknownSessionKey:
    @pytest.mark.asyncio
    async def test_e2b_unknown_session_key_raises(self) -> None:
        backend = E2BSandboxBackend(api_key="fake-key")
        mock_cls = MagicMock()
        with _fake_e2b_module(mock_cls):
            with pytest.raises(RuntimeError, match="No session found for key 'nonexistent'"):
                await backend.execute("print(1)", session_key="nonexistent")

    @pytest.mark.asyncio
    async def test_daytona_unknown_session_key_raises(self) -> None:
        backend = DaytonaSandboxBackend(api_key="fake-key")
        mock_client = AsyncMock()
        with _fake_daytona_module(mock_client):
            with pytest.raises(RuntimeError, match="No sandbox for session 'nonexistent'"):
                await backend.execute("print(1)", session_key="nonexistent")


# -- Task 15: execute with session_key=None runs ephemerally ------------------


class TestExecuteEphemeral:
    @pytest.mark.asyncio
    async def test_e2b_ephemeral_creates_and_destroys_sandbox(self) -> None:
        exec_result = _mock_e2b_execution(stdout=["42"])

        mock_sandbox = AsyncMock()
        mock_sandbox.run_code = AsyncMock(return_value=exec_result)
        mock_sandbox.__aenter__ = AsyncMock(return_value=mock_sandbox)
        mock_sandbox.__aexit__ = AsyncMock(return_value=False)

        mock_cls = MagicMock()
        mock_cls.create = AsyncMock(return_value=mock_sandbox)

        with _fake_e2b_module(mock_cls):
            backend = E2BSandboxBackend(api_key="fake-key")
            result = await backend.execute("print(42)", session_key=None)

        assert result.stdout == "42"
        assert result.exit_code == 0
        assert result.error is None
        mock_cls.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_e2b_ephemeral_does_not_affect_sessions(self) -> None:
        exec_result = _mock_e2b_execution()

        mock_sandbox = AsyncMock()
        mock_sandbox.run_code = AsyncMock(return_value=exec_result)
        mock_sandbox.__aenter__ = AsyncMock(return_value=mock_sandbox)
        mock_sandbox.__aexit__ = AsyncMock(return_value=False)

        mock_cls = MagicMock()
        mock_cls.create = AsyncMock(return_value=mock_sandbox)

        with _fake_e2b_module(mock_cls):
            backend = E2BSandboxBackend(api_key="fake-key")
            await backend.execute("print(1)", session_key=None)

        assert len(backend._sessions) == 0

    @pytest.mark.asyncio
    async def test_daytona_ephemeral_creates_and_destroys_sandbox(self) -> None:
        mock_sandbox = MagicMock()
        mock_sandbox.process.code_run = AsyncMock(return_value=_mock_daytona_result())

        mock_client = AsyncMock()
        mock_client.create = AsyncMock(return_value=mock_sandbox)
        mock_client.delete = AsyncMock()

        with _fake_daytona_module(mock_client):
            backend = DaytonaSandboxBackend(api_key="fake-key")
            result = await backend.execute("print(42)", session_key=None)

        assert result.stdout == "hello"
        assert result.exit_code == 0
        mock_client.create.assert_awaited_once()
        mock_client.delete.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_daytona_ephemeral_does_not_affect_sessions(self) -> None:
        mock_sandbox = MagicMock()
        mock_sandbox.process.code_run = AsyncMock(return_value=_mock_daytona_result())

        mock_client = AsyncMock()
        mock_client.create = AsyncMock(return_value=mock_sandbox)
        mock_client.delete = AsyncMock()

        with _fake_daytona_module(mock_client):
            backend = DaytonaSandboxBackend(api_key="fake-key")
            await backend.execute("print(1)", session_key=None)

        assert len(backend._sessions) == 0


# -- Task 16: start_session + execute + stop_session happy path ---------------


class TestSessionLifecycleHappyPath:
    @pytest.mark.asyncio
    async def test_e2b_full_lifecycle(self) -> None:
        exec_result = _mock_e2b_execution(stdout=["session_output"])

        mock_sandbox = AsyncMock()
        mock_sandbox.run_code = AsyncMock(return_value=exec_result)
        mock_sandbox.close = AsyncMock()

        mock_cls = MagicMock()
        mock_cls.create = AsyncMock(return_value=mock_sandbox)

        with _fake_e2b_module(mock_cls):
            backend = E2BSandboxBackend(api_key="fake-key")

            # start_session creates and stores the sandbox
            await backend.start_session("my-session")
            assert "my-session" in backend._sessions

            # execute reuses the stored sandbox
            result = await backend.execute("print('hi')", session_key="my-session")
            assert result.stdout == "session_output"
            assert result.exit_code == 0
            mock_sandbox.run_code.assert_awaited_once_with("print('hi')", timeout=30.0)

            # stop_session removes and closes the sandbox
            await backend.stop_session("my-session")
            assert "my-session" not in backend._sessions
            mock_sandbox.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_e2b_execute_after_stop_raises(self) -> None:
        mock_sandbox = AsyncMock()
        mock_sandbox.close = AsyncMock()

        mock_cls = MagicMock()
        mock_cls.create = AsyncMock(return_value=mock_sandbox)

        with _fake_e2b_module(mock_cls):
            backend = E2BSandboxBackend(api_key="fake-key")
            await backend.start_session("my-session")
            await backend.stop_session("my-session")

            with pytest.raises(RuntimeError, match="No session found"):
                await backend.execute("print(1)", session_key="my-session")

    @pytest.mark.asyncio
    async def test_daytona_full_lifecycle(self) -> None:
        mock_sandbox = MagicMock()
        mock_sandbox.process.code_run = AsyncMock(return_value=_mock_daytona_result())

        mock_client = AsyncMock()
        mock_client.create = AsyncMock(return_value=mock_sandbox)
        mock_client.delete = AsyncMock()

        with _fake_daytona_module(mock_client):
            backend = DaytonaSandboxBackend(api_key="fake-key")

            # start_session creates and stores the sandbox
            await backend.start_session("my-session")
            assert "my-session" in backend._sessions

            # execute reuses the stored sandbox
            result = await backend.execute("print('hi')", session_key="my-session")
            assert result.stdout == "hello"
            assert result.exit_code == 0

            # stop_session removes the sandbox and deletes it
            await backend.stop_session("my-session")
            assert "my-session" not in backend._sessions
            mock_client.delete.assert_awaited()

    @pytest.mark.asyncio
    async def test_daytona_execute_after_stop_raises(self) -> None:
        mock_sandbox = MagicMock()
        mock_sandbox.process.code_run = AsyncMock(return_value=_mock_daytona_result())

        mock_client = AsyncMock()
        mock_client.create = AsyncMock(return_value=mock_sandbox)
        mock_client.delete = AsyncMock()

        with _fake_daytona_module(mock_client):
            backend = DaytonaSandboxBackend(api_key="fake-key")
            await backend.start_session("my-session")
            await backend.stop_session("my-session")

            with pytest.raises(RuntimeError, match="No sandbox for session"):
                await backend.execute("print(1)", session_key="my-session")


# -- Task 17: close() tears down all open sessions ----------------------------


class TestCloseTeardownAllSessions:
    @pytest.mark.asyncio
    async def test_e2b_close_tears_down_all_sessions(self) -> None:
        mock_sandbox_1 = AsyncMock()
        mock_sandbox_2 = AsyncMock()

        backend = E2BSandboxBackend(api_key="fake-key")
        backend._sessions = {"key-1": mock_sandbox_1, "key-2": mock_sandbox_2}

        await backend.close()

        mock_sandbox_1.close.assert_awaited_once()
        mock_sandbox_2.close.assert_awaited_once()
        assert len(backend._sessions) == 0

    @pytest.mark.asyncio
    async def test_daytona_close_tears_down_all_sessions(self) -> None:
        mock_sandbox_1 = MagicMock()
        mock_sandbox_2 = MagicMock()

        mock_client = AsyncMock()
        mock_client.delete = AsyncMock()

        with _fake_daytona_module(mock_client):
            backend = DaytonaSandboxBackend(api_key="fake-key")
            backend._sessions = {"key-1": mock_sandbox_1, "key-2": mock_sandbox_2}

            await backend.close()

        assert mock_client.delete.await_count == 2
        assert len(backend._sessions) == 0

    @pytest.mark.asyncio
    async def test_close_on_empty_sessions_is_noop(self) -> None:
        backend = E2BSandboxBackend(api_key="fake-key")
        await backend.close()  # should not raise
        assert len(backend._sessions) == 0


# -- Task 18: WASM/Vercel start_session/stop_session are no-ops ---------------


class TestNoOpSessions:
    @pytest.mark.asyncio
    async def test_base_no_session_backend_start_session_is_noop(self) -> None:
        from phoenix.server.sandbox.types import BaseNoSessionBackend

        backend = BaseNoSessionBackend()
        await backend.start_session("any-key")  # should not raise

    @pytest.mark.asyncio
    async def test_base_no_session_backend_stop_session_is_noop(self) -> None:
        from phoenix.server.sandbox.types import BaseNoSessionBackend

        backend = BaseNoSessionBackend()
        await backend.stop_session("any-key")  # should not raise

    @pytest.mark.asyncio
    async def test_base_no_session_backend_multiple_calls_do_not_raise(self) -> None:
        from phoenix.server.sandbox.types import BaseNoSessionBackend

        backend = BaseNoSessionBackend()
        # Duplicate start_session and stop_session on nonexistent keys are fine
        await backend.start_session("key-1")
        await backend.start_session("key-1")  # no error (no-op)
        await backend.stop_session("nonexistent")  # no error (no-op)


# -- Task 19: start_session with duplicate key raises RuntimeError -------------


class TestDuplicateSessionKey:
    @pytest.mark.asyncio
    async def test_e2b_duplicate_session_key_raises(self) -> None:
        backend = E2BSandboxBackend(api_key="fake-key")
        backend._sessions["existing-key"] = MagicMock()

        mock_cls = MagicMock()
        with _fake_e2b_module(mock_cls):
            with pytest.raises(RuntimeError, match="already exists"):
                await backend.start_session("existing-key")

    @pytest.mark.asyncio
    async def test_daytona_duplicate_session_key_raises(self) -> None:
        backend = DaytonaSandboxBackend(api_key="fake-key")
        backend._sessions["existing-key"] = MagicMock()

        mock_client = AsyncMock()
        with _fake_daytona_module(mock_client):
            with pytest.raises(RuntimeError, match="already exists"):
                await backend.start_session("existing-key")

    @pytest.mark.asyncio
    async def test_e2b_different_keys_do_not_conflict(self) -> None:
        mock_sandbox_1 = AsyncMock()
        mock_sandbox_2 = AsyncMock()

        mock_cls = MagicMock()
        mock_cls.create = AsyncMock(side_effect=[mock_sandbox_1, mock_sandbox_2])

        with _fake_e2b_module(mock_cls):
            backend = E2BSandboxBackend(api_key="fake-key")
            await backend.start_session("key-1")
            await backend.start_session("key-2")

        assert "key-1" in backend._sessions
        assert "key-2" in backend._sessions
        assert backend._sessions["key-1"] is mock_sandbox_1
        assert backend._sessions["key-2"] is mock_sandbox_2
