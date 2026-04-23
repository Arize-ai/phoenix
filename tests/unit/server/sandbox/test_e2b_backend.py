"""Unit tests for E2BSandboxBackend and E2BAdapter."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
from phoenix.server.sandbox.e2b_backend import E2BAdapter, E2BSandboxBackend


def _make_mock_sandbox_cls(create_result: Any = None) -> MagicMock:
    """Return a mock AsyncSandbox class with a tracked create() coroutine."""
    sandbox_instance = MagicMock()
    sandbox_instance.run_code = AsyncMock(
        return_value=MagicMock(
            logs=MagicMock(stdout=[], stderr=[]),
            error=None,
        )
    )
    sandbox_instance.close = AsyncMock()
    sandbox_cls = MagicMock()
    sandbox_cls.create = AsyncMock(return_value=create_result or sandbox_instance)
    return sandbox_cls


# ---------------------------------------------------------------------------
# Metadata contract
# ---------------------------------------------------------------------------


def test_e2b_internet_access_capability_is_boolean() -> None:
    assert SANDBOX_ADAPTER_METADATA["E2B"].internet_access_capability == "boolean"


# ---------------------------------------------------------------------------
# _create_kwargs / allow_internet_access
# ---------------------------------------------------------------------------


def test_create_kwargs_allow_internet_access_default_true() -> None:
    backend = E2BSandboxBackend(api_key="k", template="base")
    kwargs = backend._create_kwargs()
    assert kwargs["allow_internet_access"] is True


def test_create_kwargs_allow_internet_access_false_when_set() -> None:
    backend = E2BSandboxBackend(api_key="k", template="base", allow_internet_access=False)
    kwargs = backend._create_kwargs()
    assert kwargs["allow_internet_access"] is False


# ---------------------------------------------------------------------------
# build_backend → AsyncSandbox.create receives correct allow_internet_access
# ---------------------------------------------------------------------------


def _build_and_get_create_kwargs(config: dict[str, Any]) -> dict[str, Any]:
    """Build a backend from config and return the kwargs passed to AsyncSandbox.create()."""
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(config)  # type: ignore[assignment]
    return backend._create_kwargs()


def test_build_backend_deny_mode_passes_allow_internet_access_false() -> None:
    config = {
        "PHOENIX_SANDBOX_E2B_API_KEY": "test-key",
        "internet_access": {"mode": "deny"},
    }
    kwargs = _build_and_get_create_kwargs(config)
    assert kwargs["allow_internet_access"] is False


def test_build_backend_allow_mode_passes_allow_internet_access_true() -> None:
    config = {
        "PHOENIX_SANDBOX_E2B_API_KEY": "test-key",
        "internet_access": {"mode": "allow"},
    }
    kwargs = _build_and_get_create_kwargs(config)
    assert kwargs["allow_internet_access"] is True


def test_build_backend_no_internet_access_block_defaults_to_true() -> None:
    config = {"PHOENIX_SANDBOX_E2B_API_KEY": "test-key"}
    kwargs = _build_and_get_create_kwargs(config)
    assert kwargs["allow_internet_access"] is True


# ---------------------------------------------------------------------------
# start_session forwards allow_internet_access to AsyncSandbox.create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_session_deny_passes_allow_internet_access_false() -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", allow_internet_access=False)
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    call_kwargs = mock_cls.create.call_args.kwargs
    assert call_kwargs["allow_internet_access"] is False


@pytest.mark.asyncio
async def test_start_session_allow_passes_allow_internet_access_true() -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", allow_internet_access=True)
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    call_kwargs = mock_cls.create.call_args.kwargs
    assert call_kwargs["allow_internet_access"] is True


# ---------------------------------------------------------------------------
# dependencies_language metadata
# ---------------------------------------------------------------------------


def test_e2b_dependencies_language_is_python() -> None:
    assert SANDBOX_ADAPTER_METADATA["E2B"].dependencies_language == "PYTHON"


# ---------------------------------------------------------------------------
# _install_packages / packages wiring
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_session_with_packages_calls_run_code() -> None:
    """packages=["cowsay"] must trigger a run_code pip install call."""
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", packages=["cowsay"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    sandbox_instance = mock_cls.create.return_value
    sandbox_instance.run_code.assert_called_once()
    code_arg = sandbox_instance.run_code.call_args.args[0]
    assert "pip" in code_arg
    assert "cowsay" in code_arg


@pytest.mark.asyncio
async def test_start_session_no_packages_skips_run_code() -> None:
    """No packages → run_code must NOT be called during start_session."""
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", packages=None)
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    sandbox_instance = mock_cls.create.return_value
    sandbox_instance.run_code.assert_not_called()


@pytest.mark.asyncio
async def test_start_session_install_failure_propagates_and_session_absent() -> None:
    """If run_code returns an error, start_session must raise and not cache the session."""
    error_result = MagicMock(
        logs=MagicMock(stdout=[], stderr=[]),
        error="ModuleNotFoundError: No module named pip",
    )
    mock_cls = _make_mock_sandbox_cls()
    mock_cls.create.return_value.run_code = AsyncMock(return_value=error_result)

    backend = E2BSandboxBackend(api_key="k", template="base", packages=["bad-pkg"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        with pytest.raises(RuntimeError):
            await backend.start_session("s1")
    assert "s1" not in backend._sessions


@pytest.mark.asyncio
async def test_package_with_shell_metachar_is_quoted() -> None:
    """A package name containing shell metacharacters must be shlex-quoted, not raw-interpolated."""
    # This would be dangerous if passed as raw shell: "evil; rm -rf /"
    # shlex.quote produces "'evil; rm -rf /'" — harmless as a Python string literal
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", packages=["evil; rm -rf /"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    sandbox_instance = mock_cls.create.return_value
    code_arg = sandbox_instance.run_code.call_args.args[0]
    # The metachar must appear only inside a quoted form, not raw
    assert "rm -rf /" not in code_arg or "'evil; rm -rf /'" in code_arg


def test_build_backend_with_packages_wires_to_backend() -> None:
    """build_backend with dependencies.packages passes them to E2BSandboxBackend._packages."""
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        {"PHOENIX_SANDBOX_E2B_API_KEY": "k", "dependencies": {"packages": ["cowsay"]}}
    )
    assert backend._packages == ["cowsay"]


def test_build_backend_without_packages_empty_packages() -> None:
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        {"PHOENIX_SANDBOX_E2B_API_KEY": "k"}
    )
    assert backend._packages == []
