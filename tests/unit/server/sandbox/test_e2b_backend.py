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
async def test_package_specs_pass_through_to_subprocess_unmodified() -> None:
    """Version specifiers and extras must reach pip exactly as configured.

    The generated code calls ``subprocess.run`` with a list (no shell), so each
    package spec is passed as a single argv element with no shell interpretation.
    Earlier versions of this helper used ``shlex.quote`` which corrupted any
    spec containing shell metacharacters (``>=``, ``[extras]``, whitespace) by
    baking literal single-quote characters into the argv element — pip then
    rejected ``'numpy>=1.0'`` as an invalid package name.
    """
    mock_cls = _make_mock_sandbox_cls()
    specs = ["numpy>=1.0", "requests[security]", "pandas==2.1.0"]
    backend = E2BSandboxBackend(api_key="k", template="base", packages=specs)
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.start_session("s1")
    code_arg = mock_cls.create.return_value.run_code.call_args.args[0]
    # The list literal embedded in the generated code must be repr(specs),
    # i.e. each spec wrapped in Python string quotes — never wrapped a second
    # time in literal single-quote characters.
    for spec in specs:
        assert repr(spec) in code_arg, (
            f"Expected {spec!r} (Python repr) in generated code; got: {code_arg}"
        )
        assert f"'{spec}'" not in code_arg.replace(repr(spec), ""), (
            f"Found double-quoted form of {spec!r} — shlex.quote regression"
        )


@pytest.mark.asyncio
async def test_ephemeral_execute_installs_packages_before_run_code() -> None:
    """Ephemeral execute() must install configured packages before user code.

    The evaluator path enters via execute() without ever calling start_session(),
    so a missing _install_packages call here means dependencies.packages is
    silently dropped for every E2B evaluation. Regression guard for that bug.
    """
    mock_cls = _make_mock_sandbox_cls()
    sandbox_instance = mock_cls.create.return_value
    # Make the context-manager protocol work for `async with await create(...)`.
    sandbox_instance.__aenter__ = AsyncMock(return_value=sandbox_instance)
    sandbox_instance.__aexit__ = AsyncMock(return_value=None)
    backend = E2BSandboxBackend(api_key="k", template="base", packages=["cowsay"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.execute("print('hi')", session_key="s1")
    # Two run_code calls are expected: pip install (first), then user code.
    assert sandbox_instance.run_code.await_count == 2
    install_code = sandbox_instance.run_code.call_args_list[0].args[0]
    user_code = sandbox_instance.run_code.call_args_list[1].args[0]
    assert "pip" in install_code and "cowsay" in install_code
    assert user_code == "print('hi')"


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
