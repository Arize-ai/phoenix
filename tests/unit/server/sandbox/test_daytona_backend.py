"""Unit tests for DaytonaSandboxBackend code_run kwarg correctness."""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class _CodeRunParams:
    """Minimal stand-in for daytona_sdk.common.process.CodeRunParams."""

    def __init__(
        self,
        argv: list[str] | None = None,
        env: dict[str, str] | None = None,
    ) -> None:
        self.argv = argv
        self.env = env


def _make_daytona_mocks() -> tuple[MagicMock, MagicMock]:
    """Return (daytona_sdk mock, daytona_sdk.common.process mock)."""
    process_mod = MagicMock()
    process_mod.CodeRunParams = _CodeRunParams

    daytona_mod = MagicMock()
    workspace = MagicMock()
    workspace.process.code_run = AsyncMock(
        return_value=MagicMock(stdout="ok", stderr="", exit_code=0)
    )
    daytona_mod.Daytona.return_value.create = AsyncMock(return_value=workspace)

    return daytona_mod, process_mod


class TestCodeRunParamsKwarg:
    @pytest.mark.asyncio
    async def test_execute_passes_params_not_envs(self) -> None:
        """code_run must receive params=CodeRunParams(env=...) instead of envs=."""
        daytona_mod, process_mod = _make_daytona_mocks()
        user_env = {"MY_KEY": "my_val"}

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key="test-key", user_env=user_env)
            await backend.execute("print('hi')", session_key="s1")

        workspace = daytona_mod.Daytona.return_value.create.return_value
        call_args = workspace.process.code_run.call_args
        assert call_args is not None, "code_run was never called"

        assert "envs" not in call_args.kwargs, (
            f"code_run received deprecated 'envs' kwarg: {call_args.kwargs}"
        )
        assert "params" in call_args.kwargs, (
            f"code_run missing 'params' kwarg; got: {call_args.kwargs}"
        )
        params = call_args.kwargs["params"]
        assert isinstance(params, _CodeRunParams), (
            f"params is {type(params)}, expected _CodeRunParams"
        )
        assert params.env == user_env, f"params.env={params.env!r}, expected {user_env!r}"

    @pytest.mark.asyncio
    async def test_execute_empty_user_env_passes_none_env(self) -> None:
        """Empty user_env must produce params.env=None, not an empty dict."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key="test-key", user_env={})
            await backend.execute("1+1", session_key="s1")

        workspace = daytona_mod.Daytona.return_value.create.return_value
        call_args = workspace.process.code_run.call_args
        params = call_args.kwargs["params"]
        assert isinstance(params, _CodeRunParams)
        assert params.env is None, (
            f"Expected params.env=None for empty user_env, got {params.env!r}"
        )


class TestNetworkBlockAll:
    @pytest.mark.asyncio
    async def test_deny_mode_passes_network_block_all_true(self) -> None:
        """internet_access.mode='deny' → client.create() receives network_block_all=True."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key="key", network_block_all=True)
            await backend.execute("1", session_key="s1")

        create_call = daytona_mod.Daytona.return_value.create.call_args
        assert create_call is not None, "client.create() was never called"
        assert create_call.kwargs.get("network_block_all") is True, (
            f"Expected network_block_all=True; got {create_call.kwargs}"
        )

    @pytest.mark.asyncio
    async def test_allow_mode_omits_network_block_all(self) -> None:
        """internet_access.mode='allow' → network_block_all NOT passed to client.create()."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key="key", network_block_all=False)
            await backend.execute("1", session_key="s1")

        create_call = daytona_mod.Daytona.return_value.create.call_args
        assert "network_block_all" not in create_call.kwargs, (
            f"network_block_all should be absent when mode != 'deny'; got {create_call.kwargs}"
        )

    @pytest.mark.asyncio
    async def test_start_session_deny_passes_network_block_all(self) -> None:
        """start_session also passes network_block_all=True to client.create() when deny mode."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key="key", network_block_all=True)
            await backend.start_session("sess")

        create_call = daytona_mod.Daytona.return_value.create.call_args
        assert create_call.kwargs.get("network_block_all") is True, (
            f"Expected network_block_all=True in start_session path; got {create_call.kwargs}"
        )
