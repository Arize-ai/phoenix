"""Unit tests for ModalSandboxBackend focusing on kwarg forwarding invariants.

Scope: Modal-specific SDK kwarg shapes that parametrized capability-matrix tests
can't express — `env` vs `env_dict`, `block_network`, `Image.pip_install` wiring,
and the explicit-client auth path (no os.environ mutation).
Generic "capability rejected when unsupported" coverage lives in
test_capability_matrix.py.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Mapping
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.datastructures import Secret


def _make_modal_mock() -> MagicMock:
    """Mock the modal SDK surface used by ModalSandboxBackend.

    Covers both sync and async (``.aio``) call shapes for ``Client.from_credentials``,
    ``App.lookup``, and ``Sandbox.create`` — Phoenix uses the async wrappers
    everywhere, but the sync forms are mocked for completeness.
    """
    modal = MagicMock()
    modal.App.lookup = MagicMock()
    modal.App.lookup.aio = AsyncMock(return_value=MagicMock())
    modal.Image.debian_slim.return_value = MagicMock()
    modal.Client.from_credentials = MagicMock()
    modal.Client.from_credentials.aio = AsyncMock(return_value=MagicMock())
    modal.Sandbox.create = MagicMock()
    modal.Sandbox.create.aio = AsyncMock(return_value=MagicMock())
    return modal


_TOKEN_ID_RAW = "ak-test-id"
_TOKEN_SECRET_RAW = "as-test-secret"
_TOKEN_ID = Secret(_TOKEN_ID_RAW)
_TOKEN_SECRET = Secret(_TOKEN_SECRET_RAW)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "user_env,expect_env_kwarg",
    [
        ({"KEY": "value"}, {"KEY": "value"}),
        ({}, None),
    ],
)
async def test_user_env_reaches_sandbox_create_as_env_kwarg(
    user_env: Mapping[str, str], expect_env_kwarg: dict[str, str] | None
) -> None:
    """user_env must reach Sandbox.create.aio() as `env`, not `env_dict`; absent when empty."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(
            token_id=_TOKEN_ID, token_secret=_TOKEN_SECRET, user_env=user_env
        )
        await backend._create_sandbox()

    _, kwargs = modal_mock.Sandbox.create.aio.call_args
    assert "env_dict" not in kwargs
    if expect_env_kwarg is None:
        assert "env" not in kwargs
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
        with_pkgs: Any = adapter.build_backend(
            {
                "dependencies": {"packages": ["cowsay"]},
                "MODAL_TOKEN_ID": _TOKEN_ID_RAW,
                "MODAL_TOKEN_SECRET": _TOKEN_SECRET_RAW,
            }
        )
        slim_image.pip_install.assert_called_once_with(["cowsay"])
        assert with_pkgs._image is installed_image

        slim_image.pip_install.reset_mock()
        without_pkgs: Any = adapter.build_backend(
            {
                "dependencies": {"packages": []},
                "MODAL_TOKEN_ID": _TOKEN_ID_RAW,
                "MODAL_TOKEN_SECRET": _TOKEN_SECRET_RAW,
            }
        )
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

        backend = ModalSandboxBackend(
            token_id=_TOKEN_ID, token_secret=_TOKEN_SECRET, block_network=block_network
        )
        await backend._create_sandbox()

    _, kwargs = modal_mock.Sandbox.create.aio.call_args
    if expect_kwarg is None:
        assert "block_network" not in kwargs
    else:
        assert kwargs.get("block_network") is expect_kwarg


@pytest.mark.parametrize(
    "config,expected",
    [
        (
            {
                "internet_access": {"mode": "deny"},
                "MODAL_TOKEN_ID": _TOKEN_ID_RAW,
                "MODAL_TOKEN_SECRET": _TOKEN_SECRET_RAW,
            },
            True,
        ),
        (
            {
                "internet_access": {"mode": "allow"},
                "MODAL_TOKEN_ID": _TOKEN_ID_RAW,
                "MODAL_TOKEN_SECRET": _TOKEN_SECRET_RAW,
            },
            False,
        ),
        (
            {
                "MODAL_TOKEN_ID": _TOKEN_ID_RAW,
                "MODAL_TOKEN_SECRET": _TOKEN_SECRET_RAW,
            },
            False,
        ),
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


def test_build_backend_requires_both_tokens() -> None:
    """Missing either token must raise ValueError at adapter.build_backend time."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        adapter = ModalAdapter()
        with pytest.raises(ValueError, match="MODAL_TOKEN_ID"):
            adapter.build_backend({"MODAL_TOKEN_SECRET": _TOKEN_SECRET_RAW})
        with pytest.raises(ValueError, match="MODAL_TOKEN_ID"):
            adapter.build_backend({"MODAL_TOKEN_ID": _TOKEN_ID_RAW})


@pytest.mark.asyncio
async def test_credentials_passed_to_sdk_via_explicit_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The backend must construct ``modal.Client.from_credentials.aio(token_id, token_secret)``
    and thread that client into App.lookup + Sandbox.create as the ``client=`` kwarg —
    rather than mutating os.environ.
    """
    monkeypatch.delenv("MODAL_TOKEN_ID", raising=False)
    monkeypatch.delenv("MODAL_TOKEN_SECRET", raising=False)

    modal_mock = _make_modal_mock()
    sentinel_client = MagicMock(name="modal-client")
    modal_mock.Client.from_credentials.aio = AsyncMock(return_value=sentinel_client)
    sentinel_app = MagicMock(name="modal-app")
    modal_mock.App.lookup.aio = AsyncMock(return_value=sentinel_app)

    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(token_id=_TOKEN_ID, token_secret=_TOKEN_SECRET)
        await backend._create_sandbox()

    modal_mock.Client.from_credentials.aio.assert_awaited_once_with(
        _TOKEN_ID_RAW, _TOKEN_SECRET_RAW
    )
    _, lookup_kwargs = modal_mock.App.lookup.aio.call_args
    assert lookup_kwargs.get("client") is sentinel_client
    _, create_kwargs = modal_mock.Sandbox.create.aio.call_args
    assert create_kwargs.get("client") is sentinel_client
    assert create_kwargs.get("app") is sentinel_app
    assert "MODAL_TOKEN_ID" not in os.environ
    assert "MODAL_TOKEN_SECRET" not in os.environ


@pytest.mark.asyncio
async def test_client_construction_is_memoized_across_sandbox_creates() -> None:
    """Two _create_sandbox() calls on the same backend must reuse the same client + app,
    not re-construct them per call."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(token_id=_TOKEN_ID, token_secret=_TOKEN_SECRET)
        await backend._create_sandbox()
        await backend._create_sandbox()

    assert modal_mock.Client.from_credentials.aio.await_count == 1
    assert modal_mock.App.lookup.aio.await_count == 1
    assert modal_mock.Sandbox.create.aio.await_count == 2
