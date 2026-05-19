"""Unit tests for ModalSandboxBackend focusing on kwarg forwarding.

Scope: Modal-specific SDK kwarg shapes that parametrized capability-matrix tests
can't express — `env` vs `env_dict`, `block_network`, `Image.pip_install` wiring,
and the explicit-client auth path (no os.environ mutation).
Generic "capability rejected when unsupported" coverage lives in
test_unified_config_contract.py.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Mapping
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr


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
_TOKEN_ID = SecretStr(_TOKEN_ID_RAW)
_TOKEN_SECRET = SecretStr(_TOKEN_SECRET_RAW)
_CANONICAL_TOKEN_ID = "MODAL_TOKEN_ID"
_CANONICAL_TOKEN_SECRET = "MODAL_TOKEN_SECRET"

from phoenix.server.sandbox.types import (  # noqa: E402
    ModalConfig,
    ModalCredentials,
    ModalDeployment,
)

_MODAL_CREDS = ModalCredentials(
    MODAL_TOKEN_ID=_TOKEN_ID_RAW,
    MODAL_TOKEN_SECRET=_TOKEN_SECRET_RAW,
)
_MODAL_DEPLOY = ModalDeployment()


def _modal_config(payload: dict[str, Any]) -> ModalConfig:
    """Strip credential keys from a legacy dict-shaped config and validate."""
    user_only = {
        k: v for k, v in payload.items() if k not in {_CANONICAL_TOKEN_ID, _CANONICAL_TOKEN_SECRET}
    }
    user_only.setdefault("language", "PYTHON")
    return ModalConfig.model_validate(user_only)


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
            _modal_config({"dependencies": {"packages": ["cowsay"]}}),
            credentials=_MODAL_CREDS,
            deployment=_MODAL_DEPLOY,
        )
        slim_image.pip_install.assert_called_once_with(["cowsay"])
        assert with_pkgs._image is installed_image

        slim_image.pip_install.reset_mock()
        without_pkgs: Any = adapter.build_backend(
            _modal_config({"dependencies": {"packages": []}}),
            credentials=_MODAL_CREDS,
            deployment=_MODAL_DEPLOY,
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
                _CANONICAL_TOKEN_ID: _TOKEN_ID_RAW,
                _CANONICAL_TOKEN_SECRET: _TOKEN_SECRET_RAW,
            },
            True,
        ),
        (
            {
                "internet_access": {"mode": "allow"},
                _CANONICAL_TOKEN_ID: _TOKEN_ID_RAW,
                _CANONICAL_TOKEN_SECRET: _TOKEN_SECRET_RAW,
            },
            False,
        ),
        (
            {
                _CANONICAL_TOKEN_ID: _TOKEN_ID_RAW,
                _CANONICAL_TOKEN_SECRET: _TOKEN_SECRET_RAW,
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
        backend: Any = adapter.build_backend(
            _modal_config(config),
            credentials=_MODAL_CREDS,
            deployment=_MODAL_DEPLOY,
        )
    assert backend._block_network is expected


def test_build_backend_requires_both_tokens() -> None:
    """Missing either token must raise ValueError at adapter.build_backend time."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        adapter = ModalAdapter()
        missing_id_creds = ModalCredentials(MODAL_TOKEN_ID="", MODAL_TOKEN_SECRET=_TOKEN_SECRET_RAW)
        missing_secret_creds = ModalCredentials(MODAL_TOKEN_ID=_TOKEN_ID_RAW, MODAL_TOKEN_SECRET="")
        with pytest.raises(ValueError, match=_CANONICAL_TOKEN_ID):
            adapter.build_backend(
                ModalConfig(language="PYTHON"),
                credentials=missing_id_creds,
                deployment=_MODAL_DEPLOY,
            )
        with pytest.raises(ValueError, match=_CANONICAL_TOKEN_ID):
            adapter.build_backend(
                ModalConfig(language="PYTHON"),
                credentials=missing_secret_creds,
                deployment=_MODAL_DEPLOY,
            )


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


@pytest.mark.asyncio
async def test_exec_code_strips_ansi_from_all_three_fields() -> None:
    """stdout, stderr, and error returned by the Modal backend are ANSI-stripped."""
    modal_mock = _make_modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(token_id=_TOKEN_ID, token_secret=_TOKEN_SECRET)

        sandbox = MagicMock()
        proc = MagicMock()
        proc.stdout.read.aio = AsyncMock(return_value="\x1b[32mok\x1b[0m\n")
        proc.stderr.read.aio = AsyncMock(return_value="\x1b[31merror\x1b[0m: bad\n")
        proc.wait.aio = AsyncMock(return_value=2)
        sandbox.exec.aio = AsyncMock(return_value=proc)

        result = await backend._exec_code(sandbox, "noop")

    assert result.stdout == "ok\n"
    assert result.stderr == "error: bad\n"
    assert result.error == "error: bad\n"


@pytest.mark.asyncio
async def test_execute_strips_ansi_in_raised_exception_path() -> None:
    """ANSI bytes in str(exc) are stripped on stderr/error when execute catches an exception."""
    modal_mock = _make_modal_mock()
    modal_mock.Sandbox.create.aio = AsyncMock(
        side_effect=RuntimeError("\x1b[31mprovider error\x1b[0m")
    )
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        backend = ModalSandboxBackend(token_id=_TOKEN_ID, token_secret=_TOKEN_SECRET)
        result = await backend.execute("noop", session_key="ephemeral")

    assert result.error == "provider error"
    assert result.stderr == "provider error"


def test_adapter_build_backend_wires_packages_to_image() -> None:
    """``ModalAdapter.build_backend`` calls ``Image.debian_slim().pip_install(packages)``
    so the packages are baked into the Modal Image at deploy time (not installed
    inside the running sandbox)."""
    from phoenix.server.sandbox.types import ModalConfig, ModalCredentials, ModalDeployment

    modal_mock = _make_modal_mock()
    pip_image = MagicMock()
    modal_mock.Image.debian_slim.return_value.pip_install.return_value = pip_image
    packages = ["pandas", "scikit-learn"]
    with patch.dict(sys.modules, {"modal": modal_mock}):
        from phoenix.server.sandbox.modal_backend import ModalAdapter

        adapter = ModalAdapter()
        config = ModalConfig.model_validate(
            {"language": "PYTHON", "dependencies": {"packages": packages}}
        )
        creds = ModalCredentials(
            MODAL_TOKEN_ID=SecretStr("id"), MODAL_TOKEN_SECRET=SecretStr("secret")
        )
        backend = adapter.build_backend(config, credentials=creds, deployment=ModalDeployment())
    modal_mock.Image.debian_slim.return_value.pip_install.assert_called_once_with(packages)
    assert backend._image is pip_image  # type: ignore[attr-defined]
