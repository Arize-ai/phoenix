"""Unit tests for VercelSandboxBackend.

Scope: Vercel-specific SDK kwarg shapes, runtime package install, and
network_policy forwarding. Cross-adapter capability conformance lives in
test_unified_config_contract.py.
"""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, SecretStr

from phoenix.db.models import LanguageName
from phoenix.server.sandbox.types import (
    VercelConfig,
    VercelCredentials,
    VercelDeployment,
)
from phoenix.server.sandbox.vercel_backend import VercelSandboxBackend

_VERCEL_DEPLOY = VercelDeployment()

_TOKEN = SecretStr("t")
_PROJECT = SecretStr("p")
_TEAM = SecretStr("m")


def _make_vercel_sdk_mock(
    captured_kwargs: list[dict[str, Any]] | None = None,
) -> MagicMock:
    """Return a mock vercel.sandbox module suitable for ``patch.dict``.

    If ``captured_kwargs`` is provided, every ``AsyncSandbox.create()`` call
    appends a snapshot of its kwargs dict so tests can assert the SDK kwarg
    shape (e.g., network_policy presence/value).
    """

    async def _create(**kwargs: Any) -> Any:
        if captured_kwargs is not None:
            captured_kwargs.append(dict(kwargs))
        sandbox = MagicMock()
        sandbox.stop = AsyncMock()
        sandbox.client = MagicMock()
        sandbox.client.aclose = AsyncMock()
        return sandbox

    sdk = MagicMock()
    sdk.AsyncSandbox = MagicMock()
    sdk.AsyncSandbox.create = _create
    return sdk


@pytest.fixture
def patched_vercel_sdk_with_kwargs() -> Any:
    """Patch the vercel.sandbox module in sys.modules so the deferred import
    inside _create_sandbox resolves to our mock, and yield a list capturing
    the kwargs passed to every AsyncSandbox.create() call.
    """
    captured_kwargs: list[dict[str, Any]] = []
    sdk = _make_vercel_sdk_mock(captured_kwargs=captured_kwargs)
    parent = MagicMock()
    parent.sandbox = sdk
    with patch.dict(sys.modules, {"vercel": parent, "vercel.sandbox": sdk}):
        yield captured_kwargs


def test_constructor_rejects_missing_credentials() -> None:
    """All three of token/project_id/team_id are required — empty Secret or
    empty string for any of them raises at __init__.
    """
    with pytest.raises(ValueError, match="token, project_id, and team_id"):
        VercelSandboxBackend(
            token=SecretStr(""), project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
        )
    with pytest.raises(ValueError, match="token, project_id, and team_id"):
        VercelSandboxBackend(
            token=_TOKEN, project_id=SecretStr(""), team_id=_TEAM, language="PYTHON"
        )
    with pytest.raises(ValueError, match="token, project_id, and team_id"):
        VercelSandboxBackend(
            token=_TOKEN, project_id=_PROJECT, team_id=SecretStr(""), language="PYTHON"
        )


# ---------------------------------------------------------------------------
# Package install — language-routed run_command argv shape
# ---------------------------------------------------------------------------


def _make_install_sandbox_mock(
    install_exit_code: int = 0,
    install_stderr: str = "",
) -> tuple[MagicMock, list[tuple[str, list[str]]]]:
    captured: list[tuple[str, list[str]]] = []

    async def _run_command(cmd: str, args: list[str], **kwargs: Any) -> Any:
        captured.append((cmd, list(args)))
        result = MagicMock()
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
        token=_TOKEN,
        project_id=_PROJECT,
        team_id=_TEAM,
        language="PYTHON",
        packages=["requests", "numpy"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)
    await backend.start_session("s1")

    assert captured == [("python3", ["-m", "pip", "install", "--user", "requests", "numpy"])]
    assert "s1" in backend._sessions


@pytest.mark.asyncio
async def test_start_session_installs_typescript_packages_with_npm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """TYPESCRIPT + packages → start_session issues `npm install <pkgs>`."""
    sandbox_mock, captured = _make_install_sandbox_mock()
    backend = VercelSandboxBackend(
        token=_TOKEN,
        project_id=_PROJECT,
        team_id=_TEAM,
        language="TYPESCRIPT",
        packages=["lodash"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)
    await backend.start_session("s1")

    assert captured == [("npm", ["install", "lodash"])]
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
        token=_TOKEN,
        project_id=_PROJECT,
        team_id=_TEAM,
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
    assert "s1" not in backend._sessions


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
        token=_TOKEN,
        project_id=_PROJECT,
        team_id=_TEAM,
        language="PYTHON",
        packages=["requests"],
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox_mock

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)

    result = await backend.execute("print('hello')", session_key="ephemeral")

    assert len(captured) >= 2
    assert captured[0] == ("python3", ["-m", "pip", "install", "--user", "requests"])
    sandbox_mock.stop.assert_awaited_once()
    sandbox_mock.client.aclose.assert_awaited_once()
    assert "ephemeral" not in backend._sessions
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
        token=_TOKEN,
        project_id=_PROJECT,
        team_id=_TEAM,
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


# ---------------------------------------------------------------------------
# Credential forwarding — token/project_id/team_id reach AsyncSandbox.create as kwargs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_sandbox_forwards_access_token_triple_as_kwargs(
    patched_vercel_sdk_with_kwargs: list[dict[str, Any]],
) -> None:
    """The resolved access-token triple is forwarded to AsyncSandbox.create as
    explicit token/project_id/team_id kwargs. No os.environ mutation.
    """
    captured_kwargs = patched_vercel_sdk_with_kwargs
    backend = VercelSandboxBackend(
        token=SecretStr("db-resolved-token"),
        project_id=SecretStr("proj-id"),
        team_id=SecretStr("team-id"),
        language="PYTHON",
    )
    await backend._create_sandbox()
    assert len(captured_kwargs) == 1
    kwargs = captured_kwargs[0]
    assert kwargs.get("token") == "db-resolved-token"
    assert kwargs.get("project_id") == "proj-id"
    assert kwargs.get("team_id") == "team-id"
    assert backend.secret_values == frozenset({"db-resolved-token", "proj-id", "team-id"})


# ---------------------------------------------------------------------------
# network_policy forwarding — internet_access → AsyncSandbox.create(network_policy=)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_sandbox_forwards_network_policy_allow_all(
    patched_vercel_sdk_with_kwargs: list[dict[str, Any]],
) -> None:
    captured_kwargs = patched_vercel_sdk_with_kwargs
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON", internet_access=True
    )
    await backend._create_sandbox()
    assert len(captured_kwargs) == 1
    assert captured_kwargs[0].get("network_policy") == "allow-all"


@pytest.mark.asyncio
async def test_create_sandbox_forwards_network_policy_deny_all(
    patched_vercel_sdk_with_kwargs: list[dict[str, Any]],
) -> None:
    captured_kwargs = patched_vercel_sdk_with_kwargs
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON", internet_access=False
    )
    await backend._create_sandbox()
    assert len(captured_kwargs) == 1
    assert captured_kwargs[0].get("network_policy") == "deny-all"


@pytest.mark.asyncio
async def test_create_sandbox_omits_network_policy_when_internet_access_unset(
    patched_vercel_sdk_with_kwargs: list[dict[str, Any]],
) -> None:
    captured_kwargs = patched_vercel_sdk_with_kwargs
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    await backend._create_sandbox()
    assert len(captured_kwargs) == 1
    assert "network_policy" not in captured_kwargs[0]


# ---------------------------------------------------------------------------
# Adapter-level wiring — config internet_access.mode → backend internet_access
# ---------------------------------------------------------------------------


_LANGUAGES: list[LanguageName] = ["PYTHON", "TYPESCRIPT"]


def _vercel_creds() -> "VercelCredentials":
    from phoenix.server.sandbox.types import VercelCredentials

    return VercelCredentials(VERCEL_TOKEN="t", VERCEL_PROJECT_ID="p", VERCEL_TEAM_ID="m")


def _vercel_config(payload: dict[str, Any], language: LanguageName) -> "BaseModel":
    return VercelConfig.model_validate({**payload, "language": language})


@pytest.mark.parametrize("language", _LANGUAGES)
def test_adapter_build_backend_maps_internet_access_allow(language: LanguageName) -> None:
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    adapter = VercelAdapter()
    backend = adapter.build_backend(
        _vercel_config({"internet_access": {"mode": "allow"}}, language),  # type: ignore[arg-type]
        credentials=_vercel_creds(),
        deployment=_VERCEL_DEPLOY,
    )
    assert isinstance(backend, VercelSandboxBackend)
    assert backend._internet_access is True
    assert backend._language == language


@pytest.mark.parametrize("language", _LANGUAGES)
def test_adapter_build_backend_maps_internet_access_deny_no_packages(
    language: LanguageName,
) -> None:
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    adapter = VercelAdapter()
    backend = adapter.build_backend(
        _vercel_config({"internet_access": {"mode": "deny"}}, language),  # type: ignore[arg-type]
        credentials=_vercel_creds(),
        deployment=_VERCEL_DEPLOY,
    )
    assert isinstance(backend, VercelSandboxBackend)
    assert backend._internet_access is False


@pytest.mark.parametrize("language", _LANGUAGES)
def test_adapter_build_backend_omits_internet_access_when_absent(
    language: LanguageName,
) -> None:
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    adapter = VercelAdapter()
    backend = adapter.build_backend(
        _vercel_config({}, language),  # type: ignore[arg-type]
        credentials=_vercel_creds(),
        deployment=_VERCEL_DEPLOY,
    )
    assert isinstance(backend, VercelSandboxBackend)
    assert backend._internet_access is None


@pytest.mark.parametrize("language", _LANGUAGES)
def test_adapter_build_backend_fails_closed_on_missing_triple(language: LanguageName) -> None:
    """Missing any of the three credentials must raise ValueError before SDK call."""
    from phoenix.server.sandbox.types import VercelCredentials
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    adapter = VercelAdapter()
    partial_creds = VercelCredentials(
        VERCEL_TOKEN=SecretStr("t"),
        VERCEL_PROJECT_ID=SecretStr(""),
        VERCEL_TEAM_ID=SecretStr(""),
    )
    with pytest.raises(ValueError, match="Vercel sandbox authentication is not configured"):
        adapter.build_backend(
            _vercel_config({}, language),  # type: ignore[arg-type]
            credentials=partial_creds,
            deployment=_VERCEL_DEPLOY,
        )


@pytest.mark.asyncio
async def test_exec_code_forwards_timeout_to_run_command() -> None:
    """Per-execute timeout must reach the Vercel run_command call."""
    captured_kwargs: list[dict[str, Any]] = []

    async def _run_command(cmd: str, args: list[str], **kwargs: Any) -> Any:
        captured_kwargs.append(dict(kwargs))
        result = MagicMock()
        result.exit_code = 0
        result.stdout = AsyncMock(return_value="ok\n")
        result.stderr = AsyncMock(return_value="")
        return result

    sandbox = MagicMock()
    sandbox.run_command = _run_command
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )

    result = await backend._exec_code(sandbox, "print('ok')", env={"A": "B"}, timeout=13)

    assert result.error is None
    assert captured_kwargs == [{"env": {"A": "B"}, "timeout": 13}]


@pytest.mark.asyncio
async def test_execute_forwards_timeout_to_cached_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Session reuse path must not drop the per-execute timeout."""
    sandbox = MagicMock()
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    backend._sessions["s1"] = sandbox
    mock_exec = AsyncMock(return_value=MagicMock(error=None))
    monkeypatch.setattr(backend, "_exec_code", mock_exec)

    await backend.execute("print('ok')", session_key="s1", timeout=17)

    mock_exec.assert_awaited_once_with(sandbox, "print('ok')", env=None, timeout=17)


@pytest.mark.asyncio
async def test_execute_forwards_timeout_to_ephemeral_sandbox(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ephemeral Vercel executions must enforce the same per-execute timeout."""
    sandbox = MagicMock()
    sandbox.stop = AsyncMock()
    sandbox.client = MagicMock()
    sandbox.client.aclose = AsyncMock()
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    mock_create = AsyncMock(return_value=sandbox)
    mock_install = AsyncMock()
    mock_exec = AsyncMock(return_value=MagicMock(error=None))
    monkeypatch.setattr(backend, "_create_sandbox", mock_create)
    monkeypatch.setattr(backend, "_install_packages", mock_install)
    monkeypatch.setattr(backend, "_exec_code", mock_exec)

    await backend.execute("print('ok')", session_key="ephemeral", timeout=19)

    mock_exec.assert_awaited_once_with(sandbox, "print('ok')", env=None, timeout=19)
    sandbox.stop.assert_awaited_once()
    sandbox.client.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_strips_ansi_from_all_three_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """stdout, stderr, and error returned by the Vercel backend are ANSI-stripped."""
    sandbox = MagicMock()
    sandbox.stop = AsyncMock()
    sandbox.client = MagicMock()
    sandbox.client.aclose = AsyncMock()

    async def _run_command(cmd: str, args: list[str], **kwargs: Any) -> Any:
        result = MagicMock()
        result.exit_code = 2
        result.stdout = AsyncMock(return_value="\x1b[32mok\x1b[0m\n")
        result.stderr = AsyncMock(return_value="\x1b[31mboom\x1b[0m: failed\n")
        return result

    sandbox.run_command = _run_command
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )

    async def _fake_create_sandbox() -> Any:
        return sandbox

    monkeypatch.setattr(backend, "_create_sandbox", _fake_create_sandbox)
    result = await backend.execute("noop", session_key="ephemeral")

    assert result.stdout == "ok\n"
    assert result.stderr == "boom: failed\n"
    assert result.error == "boom: failed\n"


@pytest.mark.asyncio
async def test_execute_strips_ansi_in_raised_exception_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When an exception is raised inside execute(), its str() lands on
    stderr/error — ANSI bytes in the exception message must be stripped."""
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )

    async def _explode() -> Any:
        raise RuntimeError("\x1b[31mprovider error\x1b[0m")

    monkeypatch.setattr(backend, "_create_sandbox", _explode)
    result = await backend.execute("noop", session_key="ephemeral")

    assert result.error == "provider error"
    assert result.stderr == "provider error"


@pytest.mark.parametrize("language", _LANGUAGES)
def test_build_backend_wires_packages_to_backend(language: LanguageName) -> None:
    """``VercelAdapter.build_backend`` forwards ``config.dependencies.packages``
    onto the returned ``VercelSandboxBackend._packages`` for each execution
    language."""
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    adapter = VercelAdapter()
    packages = ["requests", "numpy"]
    backend = adapter.build_backend(
        _vercel_config({"dependencies": {"packages": packages}}, language),  # type: ignore[arg-type]
        credentials=_vercel_creds(),
        deployment=_VERCEL_DEPLOY,
    )
    assert backend._packages == packages  # type: ignore[attr-defined]
