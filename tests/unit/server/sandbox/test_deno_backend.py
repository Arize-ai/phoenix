from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox.deno_backend import DenoAdapter, DenoSandboxBackend
from phoenix.server.sandbox.types import DenoConfig, DenoDeployment, NoCredentials

_DENO_CFG = DenoConfig(language="TYPESCRIPT")
_DENO_CREDS = NoCredentials()
_DENO_DEPLOY = DenoDeployment()


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
                adapter.build_backend(
                    _DENO_CFG,
                    credentials=_DENO_CREDS,
                    deployment=_DENO_DEPLOY,
                )

    def test_build_backend_uses_resolved_deno_path(self) -> None:
        adapter = DenoAdapter()

        with patch(
            "phoenix.server.sandbox.deno_backend.shutil.which",
            return_value="/opt/homebrew/bin/deno",
        ):
            backend = adapter.build_backend(
                _DENO_CFG,
                credentials=_DENO_CREDS,
                deployment=_DENO_DEPLOY,
            )

        assert isinstance(backend, DenoSandboxBackend)
        assert backend._build_command() == [
            "/opt/homebrew/bin/deno",
            "run",
            "--no-prompt",
            "--no-config",
            "--no-remote",
            "--no-npm",
            "-",
        ]

    def test_build_backend_rejects_user_env(self) -> None:
        """Defense-in-depth: even if a caller passes user_env, the Deno adapter
        refuses to construct a backend that could leak env vars to the
        subprocess."""
        adapter = DenoAdapter()

        with patch(
            "phoenix.server.sandbox.deno_backend.shutil.which",
            return_value="/opt/homebrew/bin/deno",
        ):
            with pytest.raises(
                ValueError, match="do not support user-supplied environment variables"
            ):
                adapter.build_backend(
                    _DENO_CFG,
                    credentials=_DENO_CREDS,
                    deployment=_DENO_DEPLOY,
                    user_env={"TOKEN": "value"},
                )


class TestDenoSandboxBackend:
    def test_build_command_has_no_allow_env(self) -> None:
        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")

        assert backend._build_command() == [
            "/usr/local/bin/deno",
            "run",
            "--no-prompt",
            "--no-config",
            "--no-remote",
            "--no-npm",
            "-",
        ]

    def test_build_subprocess_env_is_empty(self) -> None:
        """Deno sandboxes never receive any environment variables — the child
        process runs with an empty env so it cannot read the Phoenix server's
        ambient process env either."""
        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")

        assert backend._build_subprocess_env() == {}

    @pytest.mark.asyncio
    async def test_execute_successfully_runs_deno_process(self) -> None:
        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")
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
        assert create_subprocess_exec.await_args is not None
        assert create_subprocess_exec.await_args.kwargs["env"] == {}
        assert create_subprocess_exec.await_args.args == (
            "/usr/local/bin/deno",
            "run",
            "--no-prompt",
            "--no-config",
            "--no-remote",
            "--no-npm",
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
        assert result.error is not None
        assert "Deno executable not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_caps_concurrent_subprocesses(self) -> None:
        """No more than _MAX_CONCURRENT_DENO_EXECUTIONS Deno subprocesses run
        at once, so a large fan-out cannot exhaust the Phoenix host."""
        from phoenix.server.sandbox import deno_backend

        cap = deno_backend._MAX_CONCURRENT_DENO_EXECUTIONS
        live = 0
        peak = 0
        gate = asyncio.Event()
        reached_cap = asyncio.Event()

        async def _communicate(_input: bytes) -> tuple[bytes, bytes]:
            nonlocal live, peak
            live += 1
            peak = max(peak, live)
            if live >= cap:
                reached_cap.set()
            try:
                await gate.wait()
            finally:
                live -= 1
            return (b"ok\n", b"")

        def _make_proc(*_args: object, **_kwargs: object) -> _StubProcess:
            proc = _StubProcess(stdout=b"ok\n")
            proc.communicate = _communicate  # type: ignore[assignment]
            return proc

        backend = DenoSandboxBackend(deno_executable="/usr/local/bin/deno")
        with patch(
            "phoenix.server.sandbox.deno_backend.asyncio.create_subprocess_exec",
            AsyncMock(side_effect=_make_proc),
        ):
            tasks = [
                asyncio.create_task(backend.execute("x", session_key="s", timeout=5))
                for _ in range(cap * 3)
            ]
            # Once `cap` tasks are in-flight, give any tasks that a broken cap
            # would let through a window to start before asserting.
            await asyncio.wait_for(reached_cap.wait(), timeout=2)
            await asyncio.sleep(0.05)
            assert live == cap
            assert peak == cap

            gate.set()
            results = await asyncio.gather(*tasks)

        assert len(results) == cap * 3
        assert all(r.stdout == "ok\n" and r.error is None for r in results)
