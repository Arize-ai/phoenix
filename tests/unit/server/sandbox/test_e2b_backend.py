"""Unit tests for E2BSandboxBackend and E2BAdapter.

Scope: E2B-specific SDK kwarg shapes and pip-install-via-run_code wiring.
Metadata and cross-adapter rejection coverage lives in test_capability_matrix.py.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox.e2b_backend import E2BAdapter, E2BSandboxBackend


def _make_mock_sandbox_cls(create_result: Any = None) -> MagicMock:
    sandbox_instance = MagicMock()
    sandbox_instance.run_code = AsyncMock(
        return_value=MagicMock(logs=MagicMock(stdout=[], stderr=[]), error=None)
    )
    sandbox_instance.close = AsyncMock()
    sandbox_cls = MagicMock()
    sandbox_cls.create = AsyncMock(return_value=create_result or sandbox_instance)
    return sandbox_cls


def test_create_kwargs_defaults_to_allow_true() -> None:
    """Default allow_internet_access must be True when not specified."""
    backend = E2BSandboxBackend(api_key="k", template="base")
    assert backend._create_kwargs()["allow_internet_access"] is True


@pytest.mark.parametrize("allow", [True, False])
def test_create_kwargs_forwards_allow_internet_access(allow: bool) -> None:
    backend = E2BSandboxBackend(api_key="k", template="base", allow_internet_access=allow)
    assert backend._create_kwargs()["allow_internet_access"] is allow


@pytest.mark.parametrize(
    "config,expected",
    [
        ({"internet_access": {"mode": "deny"}}, False),
        ({"internet_access": {"mode": "allow"}}, True),
        ({}, True),  # no internet_access → default permissive
    ],
)
def test_build_backend_translates_internet_access_to_allow_flag(
    config: dict[str, Any], expected: bool
) -> None:
    """E2BAdapter.build_backend translates internet_access.mode → allow_internet_access kwarg."""
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        {"PHOENIX_SANDBOX_E2B_API_KEY": "k", **config}
    )
    assert backend._create_kwargs()["allow_internet_access"] is expected


@pytest.mark.asyncio
@pytest.mark.parametrize("allow", [True, False])
async def test_start_session_forwards_allow_internet_access(allow: bool) -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", allow_internet_access=allow)
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    assert mock_cls.create.call_args.kwargs["allow_internet_access"] is allow


@pytest.mark.asyncio
async def test_start_session_installs_packages_via_run_code() -> None:
    """Non-empty packages trigger a pip install run_code; absent otherwise."""
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", packages=["cowsay"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    sandbox_instance = mock_cls.create.return_value
    sandbox_instance.run_code.assert_called_once()
    code_arg = sandbox_instance.run_code.call_args.args[0]
    assert "pip" in code_arg and "cowsay" in code_arg


@pytest.mark.asyncio
async def test_start_session_without_packages_skips_run_code() -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", packages=None)
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    mock_cls.create.return_value.run_code.assert_not_called()


@pytest.mark.asyncio
async def test_pip_install_failure_raises_and_leaves_no_cached_session() -> None:
    mock_cls = _make_mock_sandbox_cls()
    mock_cls.create.return_value.run_code = AsyncMock(
        return_value=MagicMock(
            logs=MagicMock(stdout=[], stderr=[]),
            error="ModuleNotFoundError: No module named pip",
        )
    )
    backend = E2BSandboxBackend(api_key="k", template="base", packages=["bad-pkg"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        with pytest.raises(RuntimeError):
            await backend.start_session("s1")
    assert "s1" not in backend._sessions


@pytest.mark.asyncio
async def test_package_names_with_shell_metachars_are_quoted() -> None:
    """Shell injection guard: a package name with metachars must not be interpolated raw."""
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key="k", template="base", packages=["evil; rm -rf /"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    code_arg = mock_cls.create.return_value.run_code.call_args.args[0]
    # metacharacters may only appear inside a shell-quoted form
    assert "rm -rf /" not in code_arg or "'evil; rm -rf /'" in code_arg


@pytest.mark.parametrize(
    "config,expected_packages",
    [
        ({"dependencies": {"packages": ["cowsay"]}}, ["cowsay"]),
        ({}, []),
    ],
)
def test_build_backend_wires_packages(config: dict[str, Any], expected_packages: list[str]) -> None:
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        {"PHOENIX_SANDBOX_E2B_API_KEY": "k", **config}
    )
    assert backend._packages == expected_packages
