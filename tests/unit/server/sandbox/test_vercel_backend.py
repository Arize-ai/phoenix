from __future__ import annotations

import asyncio
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, SecretStr

from phoenix.db.models import LanguageName
from phoenix.server.sandbox import vercel_backend as _vercel_backend
from phoenix.server.sandbox.types import (
    VercelConfig,
    VercelCredentials,
    VercelDeployment,
)
from phoenix.server.sandbox.vercel_backend import VercelSandboxBackend


@pytest.fixture(autouse=True)
def _clear_vercel_session_id_map() -> Any:
    """Reset the module-level session_key→sandbox_id map between tests.

    The Vercel backend reuses sessions across ephemeral wrapper instances by
    looking up sandbox ids in a process-local dict; tests would otherwise leak
    state into each other.
    """
    _vercel_backend._session_id_map.clear()
    try:
        yield
    finally:
        _vercel_backend._session_id_map.clear()


_VERCEL_DEPLOY = VercelDeployment()

_TOKEN = SecretStr("t")
_PROJECT = SecretStr("p")
_TEAM = SecretStr("m")


def _make_vercel_sdk_mock(
    captured_kwargs: list[dict[str, Any]] | None = None,
) -> MagicMock:
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
    captured_kwargs: list[dict[str, Any]] = []
    sdk = _make_vercel_sdk_mock(captured_kwargs=captured_kwargs)
    parent = MagicMock()
    parent.sandbox = sdk
    with patch.dict(sys.modules, {"vercel": parent, "vercel.sandbox": sdk}):
        yield captured_kwargs


def test_constructor_rejects_missing_credentials() -> None:
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
    await backend.find_or_create_session("s1")

    assert captured == [("python3", ["-m", "pip", "install", "--user", "requests", "numpy"])]
    assert "s1" in _vercel_backend._session_id_map


@pytest.mark.asyncio
async def test_start_session_installs_typescript_packages_with_npm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    await backend.find_or_create_session("s1")

    assert captured == [("npm", ["install", "lodash"])]
    assert "s1" in _vercel_backend._session_id_map


@pytest.mark.asyncio
async def test_start_session_install_failure_stops_sandbox_and_does_not_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        await backend.find_or_create_session("s1")

    sandbox_mock.stop.assert_awaited_once()
    sandbox_mock.client.aclose.assert_awaited_once()
    assert "s1" not in _vercel_backend._session_id_map


@pytest.mark.asyncio
async def test_ephemeral_execute_runs_install_before_user_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    assert "ephemeral" not in _vercel_backend._session_id_map
    assert result.error is None or result.error == ""


@pytest.mark.asyncio
async def test_ephemeral_execute_install_failure_surfaces_as_execution_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    assert "ephemeral" not in _vercel_backend._session_id_map


@pytest.mark.asyncio
async def test_create_sandbox_forwards_access_token_triple_as_kwargs(
    patched_vercel_sdk_with_kwargs: list[dict[str, Any]],
) -> None:
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
async def test_execute_strips_ansi_from_all_three_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )

    async def _explode() -> Any:
        raise RuntimeError("\x1b[31mprovider error\x1b[0m")

    monkeypatch.setattr(backend, "_create_sandbox", _explode)
    result = await backend.execute("noop", session_key="ephemeral")

    assert result.error == "provider error"
    assert result.stderr == "provider error"


# ---------------------------------------------------------------------------
# Per-execute timeout
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_exec_code_with_timeout_uses_detached_command() -> None:
    """Happy path: with a timeout, ``_exec_code`` uses
    ``run_command_detached`` (the only Vercel primitive that supports
    bounded waits) and returns the command's output on completion."""
    command_result = MagicMock()
    command_result.exit_code = 0
    command_result.stdout = AsyncMock(return_value="done\n")
    command_result.stderr = AsyncMock(return_value="")

    command = MagicMock()
    command.wait = AsyncMock(return_value=command_result)
    command.kill = AsyncMock()

    sandbox = MagicMock()
    sandbox.run_command_detached = AsyncMock(return_value=command)

    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    result = await backend._exec_code(sandbox, "print('done')", env=None, timeout=5)

    sandbox.run_command_detached.assert_awaited_once()
    command.kill.assert_not_awaited()
    assert result.stdout == "done\n"
    assert result.error is None


@pytest.mark.asyncio
async def test_exec_code_kills_detached_command_on_outer_cancellation() -> None:
    """Regression guard for PR #13378's missed cancellation: when the
    outer ``asyncio.wait_for`` cancels this coroutine, the inner
    ``command.wait()`` raises ``CancelledError`` — which is NOT
    ``TimeoutError``. ``command.kill()`` must still run via the
    ``finally``-with-sentinel pattern, otherwise the detached subprocess
    survives until the whole sandbox is stopped.
    """

    async def _hang() -> Any:
        await asyncio.sleep(10)

    command = MagicMock()
    command.wait = AsyncMock(side_effect=_hang)
    command.kill = AsyncMock()

    sandbox = MagicMock()
    sandbox.run_command_detached = AsyncMock(return_value=command)

    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )

    async def _drive() -> Any:
        return await backend._exec_code(sandbox, "while True: pass", env=None, timeout=100)

    task = asyncio.create_task(_drive())
    await asyncio.sleep(0.05)  # let the task enter ``command.wait()``
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    command.kill.assert_awaited_once()


def test_run_command_has_no_timeout_kwarg() -> None:
    """SDK shape guard: bounding a Vercel command requires
    ``run_command_detached`` + explicit ``kill``. If the SDK ever adds
    ``timeout`` directly to ``run_command`` we should simplify.

    Catches the failure mode in PR #13321 — ``run_command(..., timeout=...)``
    raises TypeError because the real SDK accepts only ``cwd``, ``env``,
    ``sudo``.
    """
    import inspect

    pytest.importorskip("vercel")
    from vercel.sandbox.sandbox import AsyncSandbox

    sig = inspect.signature(AsyncSandbox.run_command)
    assert "timeout" not in sig.parameters, (
        f"Vercel SDK now accepts ``timeout`` on ``run_command`` ({list(sig.parameters)}). "
        "Consider simplifying the backend to use it directly instead of detached + kill."
    )


@pytest.mark.parametrize("language", _LANGUAGES)
def test_build_backend_wires_packages_to_backend(language: LanguageName) -> None:
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    adapter = VercelAdapter()
    packages = ["requests", "numpy"]
    backend = adapter.build_backend(
        _vercel_config({"dependencies": {"packages": packages}}, language),  # type: ignore[arg-type]
        credentials=_vercel_creds(),
        deployment=_VERCEL_DEPLOY,
    )
    assert backend._packages == packages  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# is_session_gone classifier + narrowed execute_in_session handler
# ---------------------------------------------------------------------------


def _make_sandbox_not_found_error() -> Exception:
    """Construct a real ``vercel.sandbox.SandboxNotFoundError``.

    The SDK's ``APIError`` ``__init__`` expects an ``httpx.Response``; we stub
    one with a ``MagicMock`` since the classifier only checks the exception
    type. ``SandboxNotFoundError`` is the SDK's typed signal that a 404 was
    returned for a sandbox-scoped endpoint (e.g. ``run_command``).
    """
    from vercel.sandbox import SandboxNotFoundError

    response = MagicMock()
    response.status_code = 404
    return SandboxNotFoundError(response, "HTTP 404")


def _make_sandbox_server_error() -> Exception:
    """Construct a real ``vercel.sandbox.SandboxServerError`` (5xx).

    Used to verify a sibling ``APIError`` subclass is NOT classified as
    session-gone — transient infra failures must continue to wrap as
    ``ExecutionResult(error=...)``.
    """
    from vercel.sandbox import SandboxServerError

    response = MagicMock()
    response.status_code = 503
    return SandboxServerError(response, "HTTP 503")


def test_is_session_gone_classifies_sandbox_not_found() -> None:
    """SandboxNotFoundError → True; plain RuntimeError → False.

    SandboxNotFoundError is the Vercel SDK's typed 404 signal — the sandbox
    id no longer resolves. Unrelated user-code errors must NOT classify, so
    the manager doesn't churn fresh sessions on every failed evaluation.
    """
    pytest.importorskip("vercel")
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    assert backend.is_session_gone(_make_sandbox_not_found_error()) is True
    assert backend.is_session_gone(RuntimeError("user oops")) is False


def test_is_session_gone_does_not_classify_sibling_api_error() -> None:
    """A 5xx ``SandboxServerError`` shares the ``APIError`` base but is not
    session-gone — under-classification preserves the existing wrap path for
    transient infra failures.
    """
    pytest.importorskip("vercel")
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    assert backend.is_session_gone(_make_sandbox_server_error()) is False


@pytest.mark.asyncio
async def test_execute_in_session_propagates_session_gone_exception() -> None:
    """A classified SDK exception inside ``run_command`` must propagate, not wrap.

    Without the narrow re-raise the manager has no signal to retry against —
    every SDK failure arrives as ``ExecutionResult(error=...)``, indistinguishable
    from user code.
    """
    pytest.importorskip("vercel")
    from vercel.sandbox import SandboxNotFoundError

    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )
    error = _make_sandbox_not_found_error()

    async def _explode(*_args: Any, **_kwargs: Any) -> Any:
        raise error

    sandbox = MagicMock()
    sandbox.run_command = _explode

    with pytest.raises(SandboxNotFoundError) as excinfo:
        await backend.execute_in_session(sandbox, "print(1)")
    assert excinfo.value is error


@pytest.mark.asyncio
async def test_execute_in_session_wraps_non_session_gone_exception() -> None:
    """Non-classified exceptions continue to surface as
    ``ExecutionResult(error=...)`` — the existing failure shape is preserved
    for everything outside the SandboxNotFoundError class.
    """
    backend = VercelSandboxBackend(
        token=_TOKEN, project_id=_PROJECT, team_id=_TEAM, language="PYTHON"
    )

    async def _explode(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("transient")

    sandbox = MagicMock()
    sandbox.run_command = _explode

    result = await backend.execute_in_session(sandbox, "print(1)")
    assert result.error is not None and "transient" in result.error
