from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import SecretStr

pytest.importorskip("islo")

from islo.core.api_error import ApiError  # noqa: E402
from islo.errors import ConflictError, NotFoundError  # noqa: E402
from islo.types import ErrorCode, ErrorResponse, LifecyclePolicy  # noqa: E402

import phoenix.server.sandbox.islo_backend as islo_backend_module  # noqa: E402
from phoenix.server.sandbox.islo_backend import (  # noqa: E402
    _DEFAULT_IMAGE,
    _SESSION_DELETE_AFTER_SECONDS,
    IsloAdapter,
    IsloSandboxBackend,
)
from phoenix.server.sandbox.types import (  # noqa: E402
    IsloConfig,
    IsloCredentials,
    IsloDeployment,
)

_API_KEY_RAW = "ak-test-key"
_API_KEY = SecretStr(_API_KEY_RAW)
_ISLO_CREDS = IsloCredentials(ISLO_API_KEY=_API_KEY_RAW)
_ISLO_DEPLOY = IsloDeployment()


def _islo_config(payload: Optional[dict[str, Any]] = None) -> IsloConfig:
    fields = dict(payload or {})
    fields.setdefault("language", "PYTHON")
    return IsloConfig.model_validate(fields)


def _sandbox_response(status: str = "running") -> SimpleNamespace:
    return SimpleNamespace(id="sbx-1", name="phx-x", image=_DEFAULT_IMAGE, status=status)


def _exec_response(exec_id: str = "exec-1") -> SimpleNamespace:
    return SimpleNamespace(exec_id=exec_id, sandbox_id="sbx-1", status="running")


def _exec_result(
    status: str = "completed",
    exit_code: Optional[int] = 0,
    stdout: str = "",
    stderr: str = "",
    truncated: bool = False,
) -> SimpleNamespace:
    return SimpleNamespace(
        exec_id="exec-1",
        status=status,
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        truncated=truncated,
    )


def _make_islo_client_mock() -> MagicMock:
    client = MagicMock(name="islo-client")
    client.sandboxes.create_sandbox = AsyncMock(return_value=_sandbox_response("starting"))
    client.sandboxes.get_sandbox = AsyncMock(return_value=_sandbox_response("running"))
    client.sandboxes.delete_sandbox = AsyncMock(return_value=None)
    client.sandboxes.resume_sandbox = AsyncMock(return_value=_sandbox_response("starting"))
    client.sandboxes.exec_in_sandbox = AsyncMock(return_value=_exec_response())
    client.sandboxes.get_exec_result = AsyncMock(return_value=_exec_result())
    return client


def _make_backend(**kwargs: Any) -> tuple[IsloSandboxBackend, MagicMock]:
    """Build a backend with the SDK client replaced by a mock (never hits the network)."""
    backend = IsloSandboxBackend(api_key=_API_KEY, **kwargs)
    client = _make_islo_client_mock()
    backend._client = client
    return backend, client


def test_build_backend_requires_api_key() -> None:
    """Fail-closed: empty key must raise, never fall back to the SDK's env-var lookup."""
    adapter = IsloAdapter()
    with pytest.raises(ValueError, match="ISLO_API_KEY"):
        adapter.build_backend(
            _islo_config(),
            credentials=IsloCredentials(ISLO_API_KEY=""),
            deployment=_ISLO_DEPLOY,
        )


@pytest.mark.parametrize(
    "config,expected",
    [
        ({"internet_access": {"mode": "deny"}}, False),
        ({"internet_access": {"mode": "allow"}}, True),
        ({}, True),
    ],
)
def test_build_backend_sets_internet_access_from_config(
    config: dict[str, Any], expected: bool
) -> None:
    adapter = IsloAdapter()
    backend: Any = adapter.build_backend(
        _islo_config(config),
        credentials=_ISLO_CREDS,
        deployment=_ISLO_DEPLOY,
    )
    assert backend._allow_internet_access is expected


def test_build_backend_wires_packages() -> None:
    adapter = IsloAdapter()
    backend: Any = adapter.build_backend(
        _islo_config({"dependencies": {"packages": ["numpy>=1.0"]}}),
        credentials=_ISLO_CREDS,
        deployment=_ISLO_DEPLOY,
    )
    assert backend._packages == ["numpy>=1.0"]


@pytest.mark.asyncio
async def test_create_sandbox_kwargs() -> None:
    backend, client = _make_backend(allow_internet_access=False)
    await backend._create_sandbox("phx-test")

    _, kwargs = client.sandboxes.create_sandbox.call_args
    assert kwargs["name"] == "phx-test"
    assert kwargs["image"] == _DEFAULT_IMAGE
    assert kwargs["internet_enabled"] is False
    assert kwargs["lifecycle"] == LifecyclePolicy(delete_after=_SESSION_DELETE_AFTER_SECONDS)


def test_config_fingerprint_stability() -> None:
    backend_a, _ = _make_backend(packages=["numpy"])
    backend_b, _ = _make_backend(packages=["numpy"])
    assert backend_a.config_fingerprint() == backend_b.config_fingerprint()

    with_more_packages, _ = _make_backend(packages=["numpy", "pandas"])
    assert with_more_packages.config_fingerprint() != backend_a.config_fingerprint()

    no_internet, _ = _make_backend(packages=["numpy"], allow_internet_access=False)
    assert no_internet.config_fingerprint() != backend_a.config_fingerprint()

    # Env-var value changes must NOT fragment sessions.
    with_env, _ = _make_backend(packages=["numpy"], user_env={"KEY": "value"})
    assert with_env.config_fingerprint() == backend_a.config_fingerprint()


def test_provider_session_id_is_deterministic_and_provider_safe() -> None:
    backend, _ = _make_backend()
    session_id = backend.provider_session_id("session-key")
    assert session_id == backend.provider_session_id("session-key")
    assert session_id != backend.provider_session_id("other-key")
    assert session_id.startswith("phx-")
    suffix = session_id.removeprefix("phx-")
    assert len(suffix) == 32
    assert all(c in "0123456789abcdef" for c in suffix)


@pytest.mark.asyncio
async def test_find_or_create_session_reuses_running_sandbox() -> None:
    backend, client = _make_backend()
    handle = await backend.find_or_create_session("session-key")

    assert handle == backend.provider_session_id("session-key")
    client.sandboxes.create_sandbox.assert_not_called()
    client.sandboxes.resume_sandbox.assert_not_called()


@pytest.mark.asyncio
async def test_find_or_create_session_resumes_paused_sandbox(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(islo_backend_module, "_EXEC_POLL_INTERVAL_SECONDS", 0.0)
    backend, client = _make_backend()
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[_sandbox_response("paused"), _sandbox_response("running")]
    )

    handle = await backend.find_or_create_session("session-key")

    assert handle == backend.provider_session_id("session-key")
    client.sandboxes.resume_sandbox.assert_awaited_once_with(sandbox_name=handle)
    client.sandboxes.create_sandbox.assert_not_called()


@pytest.mark.asyncio
async def test_find_or_create_session_creates_and_installs_packages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(islo_backend_module, "_EXEC_POLL_INTERVAL_SECONDS", 0.0)
    backend, client = _make_backend(packages=["numpy>=1.0"])
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[
            NotFoundError(body=None),
            _sandbox_response("starting"),
            _sandbox_response("running"),
        ]
    )

    handle = await backend.find_or_create_session("session-key")

    assert handle == backend.provider_session_id("session-key")
    _, create_kwargs = client.sandboxes.create_sandbox.call_args
    assert create_kwargs["name"] == handle
    assert create_kwargs["image"] == _DEFAULT_IMAGE
    assert create_kwargs["internet_enabled"] is True
    assert create_kwargs["lifecycle"] == LifecyclePolicy(delete_after=_SESSION_DELETE_AFTER_SECONDS)
    # List-form argv keeps specs like 'numpy>=1.0' unquoted (no shell).
    _, exec_kwargs = client.sandboxes.exec_in_sandbox.call_args
    assert exec_kwargs["command"] == ["python3", "-m", "pip", "install", "numpy>=1.0"]


@pytest.mark.asyncio
async def test_find_or_create_session_skips_install_without_packages() -> None:
    backend, client = _make_backend()
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[NotFoundError(body=None), _sandbox_response("running")]
    )

    await backend.find_or_create_session("session-key")

    client.sandboxes.create_sandbox.assert_awaited_once()
    client.sandboxes.exec_in_sandbox.assert_not_called()


@pytest.mark.asyncio
async def test_find_or_create_session_conflict_reattaches() -> None:
    """Concurrent winner from another replica: the loser re-attaches by name."""
    backend, client = _make_backend()
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[NotFoundError(body=None), _sandbox_response("running")]
    )
    client.sandboxes.create_sandbox = AsyncMock(
        side_effect=ConflictError(
            body=ErrorResponse(code=ErrorCode.SANDBOX_ALREADY_EXISTS, message="already exists")
        )
    )

    handle = await backend.find_or_create_session("session-key")

    assert handle == backend.provider_session_id("session-key")
    # The loser must never delete the winner's sandbox.
    client.sandboxes.delete_sandbox.assert_not_called()


@pytest.mark.asyncio
async def test_find_or_create_session_raises_and_cleans_up_on_dead_boot() -> None:
    """A sandbox that dies while booting must be deleted so the name is freed."""
    backend, client = _make_backend()
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[NotFoundError(body=None), _sandbox_response("failed")]
    )

    with pytest.raises(RuntimeError, match="terminal state"):
        await backend.find_or_create_session("session-key")

    client.sandboxes.delete_sandbox.assert_awaited_once_with(
        sandbox_name=backend.provider_session_id("session-key")
    )


@pytest.mark.asyncio
async def test_create_path_cleans_up_sandbox_when_pip_install_fails() -> None:
    """A sandbox whose package install fails must be deleted so the name is freed."""
    backend, client = _make_backend(packages=["numpy"])
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[NotFoundError(body=None), _sandbox_response("running")]
    )
    client.sandboxes.get_exec_result = AsyncMock(
        return_value=_exec_result(status="failed", exit_code=1, stderr="no matching distribution")
    )

    with pytest.raises(RuntimeError, match="pip install failed"):
        await backend.find_or_create_session("session-key")

    client.sandboxes.delete_sandbox.assert_awaited_once_with(
        sandbox_name=backend.provider_session_id("session-key")
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("dead_status", ["failed", "stopped", "deleted"])
async def test_find_or_create_session_recovers_from_dead_sandbox(dead_status: str) -> None:
    """A dead-but-still-present sandbox is deleted and recreated, not raised on.

    Islo names are unique among non-deleted sandboxes, so a 'failed'/'stopped'
    sandbox blocks recreation under the deterministic session name until it is
    deleted — raising here would hard-fail every execution for this session
    until the delete_after lifecycle reaps it.
    """
    backend, client = _make_backend()
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[_sandbox_response(dead_status), _sandbox_response("running")]
    )

    handle = await backend.find_or_create_session("session-key")

    assert handle == backend.provider_session_id("session-key")
    client.sandboxes.delete_sandbox.assert_awaited_once_with(sandbox_name=handle)
    client.sandboxes.create_sandbox.assert_awaited_once()
    client.sandboxes.resume_sandbox.assert_not_called()


@pytest.mark.asyncio
async def test_find_or_create_session_dead_sandbox_recovery_tolerates_missing_delete() -> None:
    """The recovery delete swallows NotFoundError (sandbox reaped between calls)."""
    backend, client = _make_backend()
    client.sandboxes.get_sandbox = AsyncMock(
        side_effect=[_sandbox_response("stopped"), _sandbox_response("running")]
    )
    client.sandboxes.delete_sandbox = AsyncMock(side_effect=NotFoundError(body=None))

    handle = await backend.find_or_create_session("session-key")

    assert handle == backend.provider_session_id("session-key")
    client.sandboxes.create_sandbox.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_in_session_sends_command_env_and_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(islo_backend_module, "_EXEC_POLL_INTERVAL_SECONDS", 0.0)
    backend, client = _make_backend(user_env={"KEY": "value"})
    # Non-terminal poll first, then terminal: exercises the poll loop.
    client.sandboxes.get_exec_result = AsyncMock(
        side_effect=[
            _exec_result(status="running", exit_code=None),
            _exec_result(status="completed", exit_code=0, stdout="ok"),
        ]
    )

    result = await backend.execute_in_session("phx-handle", "print('hi')", timeout=60)

    _, exec_kwargs = client.sandboxes.exec_in_sandbox.call_args
    assert exec_kwargs["sandbox_name"] == "phx-handle"
    assert exec_kwargs["command"] == ["python3", "-c", "print('hi')"]
    assert exec_kwargs["env"] == {"KEY": "value"}
    assert exec_kwargs["timeout_secs"] == 60
    assert client.sandboxes.get_exec_result.await_count == 2
    assert result.error is None
    assert result.stdout == "ok"


@pytest.mark.asyncio
async def test_execute_in_session_omits_env_when_empty() -> None:
    backend, client = _make_backend()
    await backend.execute_in_session("phx-handle", "print('hi')")
    _, exec_kwargs = client.sandboxes.exec_in_sandbox.call_args
    assert exec_kwargs["env"] is None
    assert exec_kwargs["timeout_secs"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "exec_result,expected_error",
    [
        (_exec_result(status="completed", exit_code=0, stdout="ok"), None),
        (
            _exec_result(status="completed", exit_code=1, stderr="Traceback: boom"),
            "Traceback: boom",
        ),
        (_exec_result(status="completed", exit_code=2, stderr=""), "exit code 2"),
        (
            _exec_result(status="failed", exit_code=None, stderr=""),
            "Execution failed (status='failed')",
        ),
        (_exec_result(status="timeout", exit_code=None, stderr=""), "Execution timed out"),
        (
            _exec_result(status="timeout", exit_code=None, stderr="killed"),
            "killed",
        ),
        (
            _exec_result(status="completed", exit_code=1, stderr="boom", truncated=True),
            "boom\n[output truncated]",
        ),
    ],
)
async def test_execute_in_session_maps_exec_result(
    exec_result: SimpleNamespace, expected_error: Optional[str]
) -> None:
    backend, client = _make_backend()
    client.sandboxes.get_exec_result = AsyncMock(return_value=exec_result)

    result = await backend.execute_in_session("phx-handle", "noop")

    assert result.error == expected_error
    assert result.stdout == exec_result.stdout
    assert result.stderr == exec_result.stderr


@pytest.mark.asyncio
async def test_server_side_timeout_includes_timeout_seconds_when_known() -> None:
    """A server-side 'timeout' status must surface a timeout message, not 'exit code None'."""
    backend, client = _make_backend()
    client.sandboxes.get_exec_result = AsyncMock(
        return_value=_exec_result(status="timeout", exit_code=None)
    )

    result = await backend.execute_in_session("phx-handle", "while True: pass", timeout=30)

    assert result.error == "Execution timed out after 30s"


@pytest.mark.asyncio
async def test_exec_client_side_deadline_returns_timeout_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The exec poll loop must enforce the timeout itself (timeout_secs is a hint only)."""
    monkeypatch.setattr(islo_backend_module, "_EXEC_POLL_INTERVAL_SECONDS", 0.0)
    backend, client = _make_backend()
    client.sandboxes.get_exec_result = AsyncMock(
        return_value=_exec_result(status="running", exit_code=None)
    )

    result = await backend.execute_in_session("phx-handle", "while True: pass", timeout=0)

    assert result.error == "Execution timed out after 0s"
    assert result.stdout == ""


def test_is_session_gone_classifies_not_found_only() -> None:
    """NotFoundError → True; 5xx / auth / generic errors → False.

    Deliberately under-classifies: a false ``True`` triggers an unnecessary
    rebind, and auth/5xx errors recur on a fresh session anyway.
    """
    backend, _ = _make_backend()
    assert backend.is_session_gone(NotFoundError(body=None)) is True
    assert backend.is_session_gone(ApiError(status_code=500, body="server error")) is False
    assert backend.is_session_gone(RuntimeError("user oops")) is False


@pytest.mark.asyncio
async def test_execute_in_session_propagates_session_gone_exception() -> None:
    backend, client = _make_backend()
    client.sandboxes.exec_in_sandbox = AsyncMock(side_effect=NotFoundError(body=None))

    with pytest.raises(NotFoundError):
        await backend.execute_in_session("phx-handle", "print('hi')")


@pytest.mark.asyncio
async def test_execute_in_session_wraps_non_session_gone_exception() -> None:
    backend, client = _make_backend()
    client.sandboxes.exec_in_sandbox = AsyncMock(side_effect=RuntimeError("user oops"))

    result = await backend.execute_in_session("phx-handle", "print('hi')")

    assert result.error == "user oops"
    assert result.stderr == "user oops"


@pytest.mark.asyncio
async def test_close_session_deletes_hashed_name_and_is_idempotent() -> None:
    backend, client = _make_backend()
    await backend.close_session("session-key")
    client.sandboxes.delete_sandbox.assert_awaited_once_with(
        sandbox_name=backend.provider_session_id("session-key")
    )

    client.sandboxes.delete_sandbox = AsyncMock(side_effect=NotFoundError(body=None))
    await backend.close_session("session-key")  # must not raise


@pytest.mark.asyncio
async def test_ephemeral_execute_creates_and_deletes_sandbox() -> None:
    backend, client = _make_backend()
    result = await backend.execute("print('hi')", session_key="ephemeral")

    assert result.error is None
    _, create_kwargs = client.sandboxes.create_sandbox.call_args
    assert create_kwargs["name"].startswith("phx-ephemeral-")
    client.sandboxes.delete_sandbox.assert_awaited_once_with(sandbox_name=create_kwargs["name"])


@pytest.mark.asyncio
async def test_ephemeral_execute_deletes_sandbox_even_when_exec_raises() -> None:
    backend, client = _make_backend()
    client.sandboxes.exec_in_sandbox = AsyncMock(side_effect=RuntimeError("provider error"))

    result = await backend.execute("print('hi')", session_key="ephemeral")

    assert result.error == "provider error"
    client.sandboxes.delete_sandbox.assert_awaited_once()


@pytest.mark.asyncio
async def test_ephemeral_execute_never_raises() -> None:
    backend, client = _make_backend()
    client.sandboxes.create_sandbox = AsyncMock(side_effect=RuntimeError("quota exceeded"))

    result = await backend.execute("print('hi')", session_key="ephemeral")

    assert result.error == "quota exceeded"
    assert result.stderr == "quota exceeded"


def test_secret_values_contains_api_key_and_user_env_plaintexts() -> None:
    backend, _ = _make_backend(user_env={"SECRET_TOKEN": "user-env-plaintext"})
    assert _API_KEY_RAW in backend.secret_values
    assert "user-env-plaintext" in backend.secret_values


@pytest.mark.asyncio
async def test_client_construction_is_memoized_and_uses_explicit_api_key() -> None:
    backend = IsloSandboxBackend(api_key=_API_KEY)
    client_cls = MagicMock(name="AsyncIslo", return_value=_make_islo_client_mock())
    backend._get_client_cls = lambda: client_cls  # type: ignore[method-assign]

    first = await backend._ensure_client()
    second = await backend._ensure_client()

    assert first is second
    client_cls.assert_called_once_with(api_key=_API_KEY_RAW)
