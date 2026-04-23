"""Unit tests for ModalSandboxBackend focusing on kwarg forwarding invariants.

Tests that env vars passed through user_env reach Modal.Sandbox.create.aio()
via the `env` kwarg (not the legacy `env_dict` kwarg which was never a valid
Sandbox.create argument).
"""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_modal_mock() -> MagicMock:
    """Build a Modal SDK mock sufficient to instantiate ModalSandboxBackend."""
    modal = MagicMock()
    modal.App.lookup.return_value = MagicMock()
    modal.Image.debian_slim.return_value = MagicMock()
    sandbox_mock = MagicMock()
    modal.Sandbox.create = MagicMock()
    modal.Sandbox.create.aio = AsyncMock(return_value=sandbox_mock)
    return modal


class TestCreateSandboxEnvKwarg:
    @pytest.mark.asyncio
    async def test_user_env_forwarded_as_env_kwarg(self) -> None:
        """user_env dict must reach Sandbox.create.aio() as `env`, not `env_dict`."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(user_env={"KEY": "value"})
            await backend._create_sandbox()

        _, kwargs = modal_mock.Sandbox.create.aio.call_args
        assert kwargs.get("env") == {"KEY": "value"}, f"Expected env={{KEY: value}}, got {kwargs}"
        assert "env_dict" not in kwargs, (
            f"env_dict should not appear in Sandbox.create.aio kwargs; got {kwargs}"
        )

    @pytest.mark.asyncio
    async def test_empty_user_env_omits_env_kwarg(self) -> None:
        """When user_env is empty, `env` kwarg must NOT be passed to Sandbox.create.aio()."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(user_env={})
            await backend._create_sandbox()

        _, kwargs = modal_mock.Sandbox.create.aio.call_args
        assert "env" not in kwargs, f"env kwarg should be absent for empty user_env; got {kwargs}"
        assert "env_dict" not in kwargs, (
            f"env_dict should never appear in Sandbox.create.aio kwargs; got {kwargs}"
        )

    @pytest.mark.asyncio
    async def test_none_user_env_omits_env_kwarg(self) -> None:
        """When user_env is None, `env` kwarg must NOT be passed to Sandbox.create.aio()."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(user_env=None)
            await backend._create_sandbox()

        _, kwargs = modal_mock.Sandbox.create.aio.call_args
        assert "env" not in kwargs, f"env kwarg should be absent for None user_env; got {kwargs}"


# ---------------------------------------------------------------------------
# Image.pip_install wiring
# ---------------------------------------------------------------------------


def _make_modal_mock_with_image_tracking() -> tuple[MagicMock, MagicMock]:
    """Return (modal_mock, slim_image_mock) so callers can assert on pip_install."""
    modal = MagicMock()
    modal.App.lookup.return_value = MagicMock()
    slim_image = MagicMock()
    modal.Image.debian_slim.return_value = slim_image
    modal.Sandbox.create = MagicMock()
    modal.Sandbox.create.aio = AsyncMock(return_value=MagicMock())
    return modal, slim_image


class TestPipInstallWiring:
    def test_modal_dependencies_language_is_python(self) -> None:
        from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA

        assert SANDBOX_ADAPTER_METADATA["MODAL"].dependencies_language == "PYTHON"

    def test_no_packages_uses_debian_slim_only(self) -> None:
        modal_mock, slim_image = _make_modal_mock_with_image_tracking()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(packages=None)

        slim_image.pip_install.assert_not_called()
        assert backend._image is slim_image

    def test_packages_calls_pip_install(self) -> None:
        modal_mock, slim_image = _make_modal_mock_with_image_tracking()
        installed_image = MagicMock()
        slim_image.pip_install.return_value = installed_image

        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(packages=["cowsay"])

        slim_image.pip_install.assert_called_once_with(["cowsay"])
        assert backend._image is installed_image

    def test_build_backend_with_packages_wires_pip_install(self) -> None:
        modal_mock, slim_image = _make_modal_mock_with_image_tracking()
        installed_image = MagicMock()
        slim_image.pip_install.return_value = installed_image

        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

            adapter = ModalAdapter()
            backend: ModalSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
                {"dependencies": {"packages": ["cowsay"]}}
            )
            slim_image.pip_install.assert_called_once_with(["cowsay"])
            assert backend._image is installed_image

    def test_build_backend_without_packages_no_pip_install(self) -> None:
        modal_mock, slim_image = _make_modal_mock_with_image_tracking()

        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

            adapter = ModalAdapter()
            backend: ModalSandboxBackend = adapter.build_backend({})  # type: ignore[assignment]
            slim_image.pip_install.assert_not_called()
            assert backend._image is slim_image

    def test_build_backend_empty_packages_no_pip_install(self) -> None:
        modal_mock, slim_image = _make_modal_mock_with_image_tracking()

        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

            adapter = ModalAdapter()
            backend: ModalSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
                {"dependencies": {"packages": []}}
            )
            slim_image.pip_install.assert_not_called()
            assert backend._image is slim_image


# ---------------------------------------------------------------------------
# block_network wiring (internet_access_capability="boolean")
# ---------------------------------------------------------------------------


class TestBlockNetworkWiring:
    def test_modal_internet_access_capability_is_boolean(self) -> None:
        from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA

        assert SANDBOX_ADAPTER_METADATA["MODAL"].internet_access_capability == "boolean"

    @pytest.mark.asyncio
    async def test_deny_mode_passes_block_network_true(self) -> None:
        """internet_access.mode='deny' must reach Sandbox.create.aio() as block_network=True."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(block_network=True)
            await backend._create_sandbox()

        _, kwargs = modal_mock.Sandbox.create.aio.call_args
        assert kwargs.get("block_network") is True, f"Expected block_network=True, got {kwargs}"

    @pytest.mark.asyncio
    async def test_allow_mode_omits_block_network(self) -> None:
        """internet_access.mode='allow' (default) must NOT pass block_network to Sandbox.create.aio()."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend(block_network=False)
            await backend._create_sandbox()

        _, kwargs = modal_mock.Sandbox.create.aio.call_args
        assert "block_network" not in kwargs, (
            f"block_network should be absent when not blocking; got {kwargs}"
        )

    @pytest.mark.asyncio
    async def test_default_omits_block_network(self) -> None:
        """No internet_access config → block_network absent from Sandbox.create.aio()."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

            backend = ModalSandboxBackend()
            await backend._create_sandbox()

        _, kwargs = modal_mock.Sandbox.create.aio.call_args
        assert "block_network" not in kwargs, (
            f"block_network should be absent with default config; got {kwargs}"
        )

    def test_build_backend_deny_sets_block_network(self) -> None:
        """build_backend with internet_access.mode='deny' produces backend with _block_network=True."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

            adapter = ModalAdapter()
            backend: ModalSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
                {"internet_access": {"mode": "deny"}}
            )
        assert backend._block_network is True

    def test_build_backend_allow_clears_block_network(self) -> None:
        """build_backend with internet_access.mode='allow' produces backend with _block_network=False."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

            adapter = ModalAdapter()
            backend: ModalSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
                {"internet_access": {"mode": "allow"}}
            )
        assert backend._block_network is False

    def test_build_backend_no_internet_access_clears_block_network(self) -> None:
        """build_backend with no internet_access config produces backend with _block_network=False."""
        modal_mock = _make_modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

            adapter = ModalAdapter()
            backend: ModalSandboxBackend = adapter.build_backend({})  # type: ignore[assignment]
        assert backend._block_network is False
