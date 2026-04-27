from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox.deno_backend import DenoAdapter, DenoSandboxBackend


class _StubProcess:
    def __init__(
        self,
        *,
        stdout: bytes = b"",
        stderr: bytes = b"",
        returncode: int = 0,
    ) -> None:
        self._stdout = stdout
        self._stderr = stderr
        self.returncode = returncode
        self.communicate = AsyncMock(return_value=(stdout, stderr))
        self.kill = MagicMock()
        self.wait = AsyncMock()


class TestDenoAdapter:
    def test_build_backend_requires_deno_on_path(self) -> None:
        adapter = DenoAdapter()

        with patch("phoenix.server.sandbox.deno_backend.shutil.which", return_value=None):
            with pytest.raises(ValueError, match="Deno is not installed"):
                adapter.build_backend({})

    def test_build_backend_uses_resolved_deno_path(self) -> None:
        adapter = DenoAdapter()

        with patch(
            "phoenix.server.sandbox.deno_backend.shutil.which",
            return_value="/opt/homebrew/bin/deno",
        ):
            backend = adapter.build_backend({}, user_env={"TOKEN": "value"})

        assert isinstance(backend, DenoSandboxBackend)
        assert backend._build_command() == [
            "/opt/homebrew/bin/deno",
            "run",
            "--no-prompt",
            "--allow-env=TOKEN",
            "-",
        ]


class TestDenoSandboxBackend:
    def test_build_command_scopes_env_permissions_exactly(self) -> None:
        backend = DenoSandboxBackend(
            deno_executable="/usr/local/bin/deno",
            user_env={"B": "2", "A": "1"},
        )

        assert backend._build_command() == [
            "/usr/local/bin/deno",
            "run",
            "--no-prompt",
            "--allow-env=A,B",
            "-",
        ]

    def test_build_subprocess_env_includes_only_user_env(self) -> None:
        backend = DenoSandboxBackend(
            deno_executable="/usr/local/bin/deno",
            user_env={"SECRET": "value"},
        )

        assert backend._build_subprocess_env() == {"SECRET": "value"}

    @pytest.mark.asyncio
    async def test_execute_successfully_runs_deno_process(self) -> None:
        backend = DenoSandboxBackend(
            deno_executable="/usr/local/bin/deno",
            user_env={"TOKEN": "secret", "FOO": "bar"},
        )
        proc = _StubProcess(stdout=b"ok\n", stderr=b"", returncode=0)

        with patch(
            "phoenix.server.sandbox.deno_backend.asyncio.create_subprocess_exec",
            AsyncMock(return_value=proc),
        ) as create_subprocess_exec:
            result = await backend.execute("console.log('ok')", session_key="test", timeout=5)

        assert result.stdout == "ok\n"
        assert result.stderr == ""
        assert result.error is None
        proc.communicate.assert_awaited_once_with(b"console.log('ok')")
        assert create_subprocess_exec.await_args.kwargs["env"] == {
            "TOKEN": "secret",
            "FOO": "bar",
        }
        assert create_subprocess_exec.await_args.args == (
            "/usr/local/bin/deno",
            "run",
            "--no-prompt",
            "--allow-env=FOO,TOKEN",
            "-",
        )

    @pytest.mark.asyncio
    async def test_execute_nonzero_exit_returns_error(self) -> None:
        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")
        proc = _StubProcess(stderr=b"permission denied\n", returncode=1)

        with patch(
            "phoenix.server.sandbox.deno_backend.asyncio.create_subprocess_exec",
            AsyncMock(return_value=proc),
        ):
            result = await backend.execute("console.log('x')", session_key="test", timeout=5)

        assert result.stdout == ""
        assert result.stderr == "permission denied\n"
        assert result.error == "permission denied\n"

    @pytest.mark.asyncio
    async def test_execute_strips_ansi_sequences_from_stderr(self) -> None:
        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")
        proc = _StubProcess(
            stderr=(b"\x1b[0m\x1b[1m\x1b[31merror\x1b[0m: Uncaught (in promise) NotCapable\n"),
            returncode=1,
        )

        with patch(
            "phoenix.server.sandbox.deno_backend.asyncio.create_subprocess_exec",
            AsyncMock(return_value=proc),
        ):
            result = await backend.execute("console.log('x')", session_key="test", timeout=5)

        assert result.stderr == "error: Uncaught (in promise) NotCapable\n"
        assert result.error == "error: Uncaught (in promise) NotCapable\n"

    @pytest.mark.asyncio
    async def test_execute_timeout_kills_process_and_returns_error(self) -> None:
        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")
        proc = _StubProcess()
        proc.communicate = AsyncMock(side_effect=asyncio.TimeoutError)

        with patch(
            "phoenix.server.sandbox.deno_backend.asyncio.create_subprocess_exec",
            AsyncMock(return_value=proc),
        ):
            result = await backend.execute("console.log('x')", session_key="test", timeout=7)

        proc.kill.assert_called_once_with()
        proc.wait.assert_awaited_once()
        assert result.error == "Execution timed out after 7s"
        assert result.stderr == "Execution timed out after 7s"

    @pytest.mark.asyncio
    async def test_execute_missing_binary_returns_error(self) -> None:
        backend = DenoSandboxBackend(deno_executable="/missing/deno")

        with patch(
            "phoenix.server.sandbox.deno_backend.asyncio.create_subprocess_exec",
            AsyncMock(side_effect=FileNotFoundError),
        ):
            result = await backend.execute("console.log('x')", session_key="test", timeout=5)

        assert result.stdout == ""
        assert "Deno executable not found" in result.stderr
        assert "Deno executable not found" in result.error
