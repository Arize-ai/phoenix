"""Unit tests for VercelSandboxBackend.

Scope: Vercel-specific SDK kwarg shapes and OIDC token forwarding.
Cross-adapter capability conformance lives in test_unified_config_contract.py.
"""

from __future__ import annotations

import os
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox.vercel_backend import (
    ENV_VERCEL_OIDC_TOKEN,
    VercelSandboxBackend,
)


def _make_vercel_sdk_mock() -> tuple[MagicMock, list[str | None]]:
    """Return (sdk module mock, list capturing os.environ[VERCEL_OIDC_TOKEN]
    snapshots taken at AsyncSandbox.create() invocation time).

    The captured snapshots let tests assert what the SDK would have read from
    the env synchronously at the top of create() — i.e. whether Phoenix's env
    injection actually took effect at the moment the SDK reads it.
    """
    captured_env: list[str | None] = []

    async def _create(**_: Any) -> Any:
        captured_env.append(os.environ.get(ENV_VERCEL_OIDC_TOKEN))
        sandbox = MagicMock()
        sandbox.stop = AsyncMock()
        sandbox.client = MagicMock()
        sandbox.client.aclose = AsyncMock()
        return sandbox

    sdk = MagicMock()
    sdk.AsyncSandbox = MagicMock()
    sdk.AsyncSandbox.create = _create
    return sdk, captured_env


@pytest.fixture
def patched_vercel_sdk() -> Any:
    """Patch the vercel.sandbox module in sys.modules so the deferred import
    inside _create_sandbox resolves to our mock.
    """
    sdk, captured_env = _make_vercel_sdk_mock()
    parent = MagicMock()
    parent.sandbox = sdk
    with patch.dict(sys.modules, {"vercel": parent, "vercel.sandbox": sdk}):
        yield sdk, captured_env


@pytest.mark.asyncio
async def test_oidc_token_injected_into_env_around_create(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When oidc_token is provided, _create_sandbox must place it in
    os.environ[VERCEL_OIDC_TOKEN] BEFORE invoking AsyncSandbox.create().

    Regression guard: previously the adapter passed use_oidc_env=True without
    the token value, leaving _create_sandbox to call AsyncSandbox.create()
    with no auth — the SDK then read an empty VERCEL_OIDC_TOKEN from env when
    the token was sourced from the DB rather than the process environment.
    """
    _, captured_env = patched_vercel_sdk
    monkeypatch.delenv(ENV_VERCEL_OIDC_TOKEN, raising=False)

    backend = VercelSandboxBackend(oidc_token="db-resolved-token", language="PYTHON")
    await backend._create_sandbox()

    assert captured_env == ["db-resolved-token"], (
        "AsyncSandbox.create() must observe the resolved OIDC token in "
        f"os.environ[VERCEL_OIDC_TOKEN]; got {captured_env!r}"
    )


@pytest.mark.asyncio
async def test_oidc_token_env_restored_after_create(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After _create_sandbox returns, os.environ must be restored — set if it
    was set, unset if it was unset. Otherwise per-evaluator OIDC tokens leak
    process-wide.
    """
    monkeypatch.delenv(ENV_VERCEL_OIDC_TOKEN, raising=False)
    backend = VercelSandboxBackend(oidc_token="ephemeral-token", language="PYTHON")
    await backend._create_sandbox()
    assert os.environ.get(ENV_VERCEL_OIDC_TOKEN) is None, (
        "VERCEL_OIDC_TOKEN must be removed from env after create when it was "
        "absent before — Phoenix's resolved token must not leak."
    )


@pytest.mark.asyncio
async def test_preexisting_oidc_env_value_restored_after_create(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If VERCEL_OIDC_TOKEN was already set in env (e.g. user-provided),
    _create_sandbox must restore that value after temporarily overriding it.
    """
    monkeypatch.setenv(ENV_VERCEL_OIDC_TOKEN, "user-env-token")
    backend = VercelSandboxBackend(oidc_token="db-token", language="PYTHON")
    _, captured_env = patched_vercel_sdk
    await backend._create_sandbox()
    # SDK saw the DB-sourced token (Phoenix's resolution wins).
    assert captured_env == ["db-token"]
    # Original env value is restored.
    assert os.environ.get(ENV_VERCEL_OIDC_TOKEN) == "user-env-token"


@pytest.mark.asyncio
async def test_access_token_path_does_not_touch_oidc_env(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Access-token triple path passes credentials as create() kwargs; it must
    NOT mutate VERCEL_OIDC_TOKEN env even briefly.
    """
    monkeypatch.delenv(ENV_VERCEL_OIDC_TOKEN, raising=False)
    backend = VercelSandboxBackend(token="t", project_id="p", team_id="m", language="PYTHON")
    _, captured_env = patched_vercel_sdk
    await backend._create_sandbox()
    # Env was never set during create.
    assert captured_env == [None]
    assert os.environ.get(ENV_VERCEL_OIDC_TOKEN) is None


def test_constructor_rejects_no_credentials() -> None:
    with pytest.raises(ValueError, match="oidc_token"):
        VercelSandboxBackend(language="PYTHON")


# ---------------------------------------------------------------------------
# Package install — language-routed run_command argv shape
# ---------------------------------------------------------------------------


def _make_install_sandbox_mock(
    install_exit_code: int = 0,
    install_stderr: str = "",
) -> tuple[MagicMock, list[tuple[str, list[str]]]]:
    """Return (sandbox mock, list of (cmd, args) captured from run_command calls).

    The first run_command call records the install command shape; subsequent
    calls record exec invocations. exit_code/stderr on the install result are
    configurable to exercise the failure path.
    """
    captured: list[tuple[str, list[str]]] = []

    async def _run_command(cmd: str, args: list[str], **kwargs: Any) -> Any:
        captured.append((cmd, list(args)))
        result = MagicMock()
        # First call is the install; subsequent (exec) calls behave normally.
        is_install = len(captured) == 1
        result.exit_code = install_exit_code if is_install else 0
        result.stdout = AsyncMock(return_value="")
        result.stderr = AsyncMock(return_value=install_stderr if is_install else "")
        return result

    sandbox = MagicMock()
    sandbox.run_command = _run_command
    sandbox.stop = AsyncMock()
    sandbox.client = MagicMock()
    sandbox.client.aclose = AsyncMock()
    return sandbox, captured


@pytest.mark.asyncio
async def test_start_session_installs_python_packages_with_pip_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PYTHON + packages → start_session issues `python3 -m pip install --user <pkgs>`."""
    sandbox_mock, captured = _make_install_sandbox_mock()
    backend = VercelSandboxBackend(
        oidc_token="t",
        language="PYTHON",
        packages=["requests", "numpy"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)
    await backend.start_session("s1")

    assert captured == [("python3", ["-m", "pip", "install", "--user", "requests", "numpy"])], (
        f"Expected python3 -m pip install --user argv; got {captured!r}"
    )
    assert "s1" in backend._sessions


@pytest.mark.asyncio
async def test_start_session_installs_typescript_packages_with_npm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """TYPESCRIPT + packages → start_session issues `npm install <pkgs>`."""
    sandbox_mock, captured = _make_install_sandbox_mock()
    backend = VercelSandboxBackend(
        oidc_token="t",
        language="TYPESCRIPT",
        packages=["lodash"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)
    await backend.start_session("s1")

    assert captured == [("npm", ["install", "lodash"])], (
        f"Expected npm install argv; got {captured!r}"
    )
    assert "s1" in backend._sessions


@pytest.mark.asyncio
async def test_start_session_install_failure_stops_sandbox_and_does_not_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When _install_packages raises, start_session must stop the sandbox,
    aclose the client, NOT cache the session, and propagate the RuntimeError.
    """
    sandbox_mock, _captured = _make_install_sandbox_mock(
        install_exit_code=1,
        install_stderr="pip: package not found",
    )
    backend = VercelSandboxBackend(
        oidc_token="t",
        language="PYTHON",
        packages=["nonexistent-package"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)

    with pytest.raises(RuntimeError, match="pip: package not found"):
        await backend.start_session("s1")

    sandbox_mock.stop.assert_awaited_once()
    sandbox_mock.client.aclose.assert_awaited_once()
    assert "s1" not in backend._sessions, (
        "Failed install must not leave a session cached in self._sessions"
    )


@pytest.mark.asyncio
async def test_ephemeral_execute_runs_install_before_user_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When execute() runs without a cached session, the ephemeral branch must
    issue the install run_command before the user-code run_command, then stop
    the sandbox and aclose the client in the finally block.
    """
    sandbox_mock, captured = _make_install_sandbox_mock()
    backend = VercelSandboxBackend(
        oidc_token="t",
        language="PYTHON",
        packages=["requests"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)

    result = await backend.execute("print('hello')", session_key="ephemeral")

    # First run_command call is the install; second is the user-code exec.
    assert len(captured) >= 2, f"Expected install + exec calls; got {captured!r}"
    assert captured[0] == ("python3", ["-m", "pip", "install", "--user", "requests"]), (
        f"Install must run before user code; first call was {captured[0]!r}"
    )
    # Ephemeral path always stops + acloses the sandbox in finally.
    sandbox_mock.stop.assert_awaited_once()
    sandbox_mock.client.aclose.assert_awaited_once()
    # Nothing is cached on the ephemeral path.
    assert "ephemeral" not in backend._sessions
    # Successful exec returns a normal ExecutionResult (no error).
    assert result.error is None or result.error == ""


@pytest.mark.asyncio
async def test_ephemeral_execute_install_failure_surfaces_as_execution_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An install failure on the ephemeral path must surface as
    ExecutionResult.error (not a raised exception) while stop + aclose still
    run in the finally block.
    """
    sandbox_mock, _captured = _make_install_sandbox_mock(
        install_exit_code=1,
        install_stderr="pip: package not found",
    )
    backend = VercelSandboxBackend(
        oidc_token="t",
        language="PYTHON",
        packages=["nonexistent-package"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)

    result = await backend.execute("print('hello')", session_key="ephemeral")

    assert result.error is not None and "pip: package not found" in result.error
    sandbox_mock.stop.assert_awaited_once()
    sandbox_mock.client.aclose.assert_awaited_once()
    assert "ephemeral" not in backend._sessions
