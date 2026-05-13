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
from starlette.datastructures import Secret

from phoenix.server.sandbox.vercel_backend import VercelSandboxBackend

_TOKEN = Secret("t")
_PROJECT = Secret("p")
_TEAM = Secret("m")


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
            token=Secret(""), project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
        )
    with pytest.raises(ValueError, match="token, project_id, and team_id"):
        VercelSandboxBackend(token=_TOKEN, project_id=Secret(""), team_id=_TEAM, language="PYTHON")
    with pytest.raises(ValueError, match="token, project_id, and team_id"):
        VercelSandboxBackend(
            token=_TOKEN, project_id=_PROJECT, team_id=Secret(""), language="PYTHON"
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
        token=Secret("db-resolved-token"),
        project_id=Secret("proj-id"),
        team_id=Secret("team-id"),
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


@pytest.mark.parametrize(
    "adapter_module_path,adapter_cls_name,language",
    [
        ("phoenix.server.sandbox.vercel_backend", "VercelPythonAdapter", "PYTHON"),
        ("phoenix.server.sandbox.vercel_backend", "VercelTypescriptAdapter", "TYPESCRIPT"),
    ],
)
def test_adapter_build_backend_maps_internet_access_allow(
    adapter_module_path: str, adapter_cls_name: str, language: str
) -> None:
    import importlib

    mod = importlib.import_module(adapter_module_path)
    adapter = getattr(mod, adapter_cls_name)()
    backend = adapter.build_backend(
        {
            "internet_access": {"mode": "allow"},
            "VERCEL_TOKEN": "t",
            "VERCEL_PROJECT_ID": "p",
            "VERCEL_TEAM_ID": "m",
        }
    )
    assert backend._internet_access is True
    assert backend._language == language


@pytest.mark.parametrize(
    "adapter_module_path,adapter_cls_name",
    [
        ("phoenix.server.sandbox.vercel_backend", "VercelPythonAdapter"),
        ("phoenix.server.sandbox.vercel_backend", "VercelTypescriptAdapter"),
    ],
)
def test_adapter_build_backend_maps_internet_access_deny_no_packages(
    adapter_module_path: str, adapter_cls_name: str
) -> None:
    import importlib

    mod = importlib.import_module(adapter_module_path)
    adapter = getattr(mod, adapter_cls_name)()
    backend = adapter.build_backend(
        {
            "internet_access": {"mode": "deny"},
            "VERCEL_TOKEN": "t",
            "VERCEL_PROJECT_ID": "p",
            "VERCEL_TEAM_ID": "m",
        }
    )
    assert backend._internet_access is False


@pytest.mark.parametrize(
    "adapter_module_path,adapter_cls_name",
    [
        ("phoenix.server.sandbox.vercel_backend", "VercelPythonAdapter"),
        ("phoenix.server.sandbox.vercel_backend", "VercelTypescriptAdapter"),
    ],
)
def test_adapter_build_backend_omits_internet_access_when_absent(
    adapter_module_path: str, adapter_cls_name: str
) -> None:
    import importlib

    mod = importlib.import_module(adapter_module_path)
    adapter = getattr(mod, adapter_cls_name)()
    backend = adapter.build_backend(
        {
            "VERCEL_TOKEN": "t",
            "VERCEL_PROJECT_ID": "p",
            "VERCEL_TEAM_ID": "m",
        }
    )
    assert backend._internet_access is None


@pytest.mark.parametrize(
    "adapter_cls_name",
    ["VercelPythonAdapter", "VercelTypescriptAdapter"],
)
def test_adapter_build_backend_fails_closed_on_missing_triple(adapter_cls_name: str) -> None:
    """Missing any of the three credentials must raise ValueError before SDK call."""
    import importlib

    mod = importlib.import_module("phoenix.server.sandbox.vercel_backend")
    adapter = getattr(mod, adapter_cls_name)()
    with pytest.raises(ValueError, match="Vercel sandbox authentication is not configured"):
        adapter.build_backend({"VERCEL_TOKEN": "t"})
