"""Tests for DaytonaSandboxBackend ephemeral execute and package install.

Per-adapter test files exist only for adapters with genuinely unique lifecycle
not captured by cross-adapter conformance (test_unified_config_contract.py) or
forwarding (test_user_env_forwarding.py). E2B, Deno, WASM do NOT have dedicated
files because their execution is uniform enough to be covered by conformance +
forwarding. Daytona warrants a dedicated file due to its session-vs-ephemeral
lifecycle bifurcation.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from phoenix.server.sandbox.types import ExecutionResult

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_workspace(exit_code: int = 0) -> MagicMock:
    """Return a workspace mock with process.code_run as AsyncMock."""
    code_run_result = MagicMock()
    code_run_result.exit_code = exit_code
    code_run_result.stdout = "output"
    code_run_result.stderr = ""

    process = MagicMock()
    process.code_run = AsyncMock(return_value=code_run_result)

    workspace = MagicMock()
    workspace.process = process
    return workspace


def _make_client(workspace: Any) -> MagicMock:
    """Return a Daytona client mock whose create() returns the given workspace."""
    client = MagicMock()
    client.create = AsyncMock(return_value=workspace)
    client.remove = AsyncMock()
    return client


def _make_backend(packages: list[str] | None = None, **kwargs: Any) -> Any:
    from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

    return DaytonaSandboxBackend(api_key="test-key", packages=packages or [], **kwargs)


# ---------------------------------------------------------------------------
# Ephemeral execute — package install ordering
# ---------------------------------------------------------------------------


class TestDaytonaSandboxBackendEphemeralInstall:
    async def test_ephemeral_execute_installs_before_code_run_when_packages_set(
        self,
    ) -> None:
        workspace = _make_workspace()
        client = _make_client(workspace)

        backend = _make_backend(packages=["numpy"])
        with patch.object(backend, "_get_client", return_value=client):
            result = await backend.execute("print(1)", session_key="ephemeral-key")

        assert isinstance(result, ExecutionResult)
        # code_run called twice: once for install, once for user code
        assert workspace.process.code_run.await_count == 2
        install_call, user_call = workspace.process.code_run.call_args_list
        # Install call passes no envs (positional only)
        assert "numpy" in install_call.args[0]
        # User code call
        assert user_call.args[0] == "print(1)"

    async def test_ephemeral_execute_skips_install_when_no_packages(self) -> None:
        workspace = _make_workspace()
        client = _make_client(workspace)

        backend = _make_backend(packages=[])
        with patch.object(backend, "_get_client", return_value=client):
            await backend.execute("print(1)", session_key="ephemeral-key")

        # Only the user code call — no install call
        workspace.process.code_run.assert_awaited_once_with("print(1)", envs={})

    async def test_session_path_install_still_called_on_start_session(self) -> None:
        workspace = _make_workspace()
        client = _make_client(workspace)

        backend = _make_backend(packages=["pandas"])
        with patch.object(backend, "_get_client", return_value=client):
            await backend.start_session("s1")
            await backend.execute("x = 1", session_key="s1")

        # install during start_session + user code in execute — still 2 calls total
        assert workspace.process.code_run.await_count == 2

    async def test_session_path_install_not_repeated_on_second_execute(self) -> None:
        workspace = _make_workspace()
        client = _make_client(workspace)

        backend = _make_backend(packages=["requests"])
        with patch.object(backend, "_get_client", return_value=client):
            await backend.start_session("s1")
            await backend.execute("x = 1", session_key="s1")
            await backend.execute("print(x)", session_key="s1")

        # install once + two user code calls = 3 total
        assert workspace.process.code_run.await_count == 3
