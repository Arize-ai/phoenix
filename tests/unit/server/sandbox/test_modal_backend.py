"""Unit tests for ModalSandboxBackend focusing on kwarg forwarding invariants.

Scope: Modal-specific SDK kwarg shapes that parametrized capability-matrix tests
can't express — `env` vs `env_dict`, `block_network`, `Image.pip_install` wiring.
Generic "capability rejected when unsupported" coverage lives in
test_capability_matrix.py.
"""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_modal_mock() -> MagicMock:
    modal = MagicMock()
    modal.App.lookup.return_value = MagicMock()
    modal.Image.debian_slim.return_value = MagicMock()
    modal.Sandbox.create = MagicMock()
    modal.Sandbox.create.aio = AsyncMock(return_value=MagicMock())
    return modal


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "user_env,expect_env_kwarg",
    [
        ({"KEY": "value"}, {"KEY": "value"}),
        ({}, None),
        (None, None),
    ],
)
async def test_user_env_reaches_sandbox_create_as_env_kwarg(
    user_env: dict[str, str] | None, expect_env_kwarg: dict[str, str] | None
) -> None:
    """user_env must reach Sandbox.create.aio() as `env`, not `env_dict`; absent when empty/None."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(user_env=user_env)
        await backend._create_sandbox()

    _, kwargs = modal_mock.Sandbox.create.aio.call_args
    assert "env_dict" not in kwargs, f"env_dict is not a valid kwarg; got {kwargs}"
    if expect_env_kwarg is None:
        assert "env" not in kwargs, f"env should be absent; got {kwargs}"
    else:
        assert kwargs.get("env") == expect_env_kwarg


def test_pip_install_invoked_only_when_packages_present() -> None:
    """Non-empty packages → Image.pip_install called with list; empty/None → not called."""
    modal_mock = _make_modal_mock()
    slim_image = modal_mock.Image.debian_slim.return_value
    installed_image = MagicMock()
    slim_image.pip_install.return_value = installed_image

    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        adapter = ModalAdapter()
        with_pkgs: Any = adapter.build_backend({"dependencies": {"packages": ["cowsay"]}})
        slim_image.pip_install.assert_called_once_with(["cowsay"])
        assert with_pkgs._image is installed_image

        slim_image.pip_install.reset_mock()
        without_pkgs: Any = adapter.build_backend({"dependencies": {"packages": []}})
        slim_image.pip_install.assert_not_called()
        assert without_pkgs._image is slim_image


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "block_network,expect_kwarg",
    [(True, True), (False, None)],
)
async def test_block_network_kwarg_forwarding(
    block_network: bool, expect_kwarg: bool | None
) -> None:
    """block_network=True reaches SDK; block_network=False omits the kwarg entirely."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(block_network=block_network)
        await backend._create_sandbox()

    _, kwargs = modal_mock.Sandbox.create.aio.call_args
    if expect_kwarg is None:
        assert "block_network" not in kwargs
    else:
        assert kwargs.get("block_network") is expect_kwarg


@pytest.mark.parametrize(
    "config,expected",
    [
        ({"internet_access": {"mode": "deny"}}, True),
        ({"internet_access": {"mode": "allow"}}, False),
        ({}, False),
    ],
)
def test_build_backend_sets_block_network_from_internet_access(
    config: dict[str, Any], expected: bool
) -> None:
    """ModalAdapter.build_backend translates internet_access.mode → backend._block_network."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        adapter = ModalAdapter()
        backend: Any = adapter.build_backend(config)
    assert backend._block_network is expected
