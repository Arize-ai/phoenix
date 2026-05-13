"""Unit tests for DaytonaSandboxBackend code_run kwarg correctness."""

from __future__ import annotations

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.datastructures import Secret

_API_KEY = Secret("test-key")
_ALT_KEY = Secret("key")


class _CodeRunParams:
    """Minimal stand-in for daytona_sdk.CodeRunParams."""

    def __init__(
        self,
        argv: list[str] | None = None,
        env: dict[str, str] | None = None,
    ) -> None:
        self.argv = argv
        self.env = env


class _CreateSandboxFromSnapshotParams:
    """Minimal stand-in for daytona_sdk.CreateSandboxFromSnapshotParams."""

    def __init__(
        self,
        language: str | None = None,
        network_block_all: bool | None = None,
        **kwargs: object,
    ) -> None:
        self.language = language
        self.network_block_all = network_block_all
        for key, value in kwargs.items():
            setattr(self, key, value)


class _DaytonaConfig:
    """Minimal stand-in for daytona_sdk.DaytonaConfig."""

    def __init__(
        self,
        api_key: str | None = None,
        api_url: str | None = None,
        **kwargs: object,
    ) -> None:
        self.api_key = api_key
        self.api_url = api_url
        for key, value in kwargs.items():
            setattr(self, key, value)


def _make_daytona_mocks() -> tuple[MagicMock, MagicMock]:
    """Return (daytona_sdk mock, daytona_sdk.common.process mock — kept for legacy import path)."""
    process_mod = MagicMock()
    process_mod.CodeRunParams = _CodeRunParams

    daytona_mod = MagicMock()
    daytona_mod.CodeRunParams = _CodeRunParams
    daytona_mod.DaytonaConfig = _DaytonaConfig
    daytona_mod.CreateSandboxFromSnapshotParams = _CreateSandboxFromSnapshotParams

    workspace = MagicMock()
    workspace.process.code_run = AsyncMock(return_value=MagicMock(result="ok", exit_code=0))
    client = daytona_mod.AsyncDaytona.return_value
    client.create = AsyncMock(return_value=workspace)
    client.delete = AsyncMock()

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

            backend = DaytonaSandboxBackend(api_key=_API_KEY, user_env=user_env)
            await backend.execute("print('hi')", session_key="s1")

        workspace = daytona_mod.AsyncDaytona.return_value.create.return_value
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

            backend = DaytonaSandboxBackend(api_key=_API_KEY, user_env={})
            await backend.execute("1+1", session_key="s1")

        workspace = daytona_mod.AsyncDaytona.return_value.create.return_value
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

            backend = DaytonaSandboxBackend(api_key=_ALT_KEY, network_block_all=True)
            await backend.execute("1", session_key="s1")

        create_call = daytona_mod.AsyncDaytona.return_value.create.call_args
        assert create_call is not None, "client.create() was never called"
        params = create_call.args[0] if create_call.args else create_call.kwargs.get("params")
        assert isinstance(params, _CreateSandboxFromSnapshotParams), (
            f"Expected CreateSandboxFromSnapshotParams; got {type(params)}"
        )
        assert params.network_block_all is True, (
            f"Expected network_block_all=True; got {params.network_block_all!r}"
        )

    @pytest.mark.asyncio
    async def test_allow_mode_omits_network_block_all(self) -> None:
        """internet_access.mode='allow' → network_block_all NOT set on create params."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_ALT_KEY, network_block_all=False)
            await backend.execute("1", session_key="s1")

        create_call = daytona_mod.AsyncDaytona.return_value.create.call_args
        params = create_call.args[0] if create_call.args else create_call.kwargs.get("params")
        assert isinstance(params, _CreateSandboxFromSnapshotParams)
        assert params.network_block_all is None, (
            f"network_block_all should be unset when mode != 'deny'; got {params.network_block_all!r}"
        )

    @pytest.mark.asyncio
    async def test_start_session_deny_passes_network_block_all(self) -> None:
        """start_session also sets network_block_all=True on create params when deny mode."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_ALT_KEY, network_block_all=True)
            await backend.start_session("sess")

        create_call = daytona_mod.AsyncDaytona.return_value.create.call_args
        params = create_call.args[0] if create_call.args else create_call.kwargs.get("params")
        assert isinstance(params, _CreateSandboxFromSnapshotParams)
        assert params.network_block_all is True, (
            f"Expected network_block_all=True in start_session path; got {params.network_block_all!r}"
        )


class TestEphemeralTeardown:
    """Verify that ephemeral execute() always removes the workspace, even on failure or cancel."""

    @pytest.mark.asyncio
    async def test_remove_called_when_code_run_raises(self) -> None:
        """client.remove() is called exactly once when code_run raises."""
        daytona_mod, process_mod = _make_daytona_mocks()
        client = daytona_mod.AsyncDaytona.return_value
        client.create.return_value.process.code_run = AsyncMock(
            side_effect=RuntimeError("code_run failed")
        )

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_API_KEY)
            result = await backend.execute("raise RuntimeError()", session_key="ephemeral")

        assert result.error is not None
        assert client.create.call_count == 1
        assert client.delete.call_count == 1

    @pytest.mark.asyncio
    async def test_remove_called_on_cancellation(self) -> None:
        """client.remove() is called when the coroutine is cancelled via asyncio.wait_for."""
        daytona_mod, process_mod = _make_daytona_mocks()
        client = daytona_mod.AsyncDaytona.return_value

        async def _slow_code_run(*args: object, **kwargs: object) -> None:
            await asyncio.sleep(10)

        client.create.return_value.process.code_run = AsyncMock(side_effect=_slow_code_run)

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_API_KEY)
            with pytest.raises((asyncio.TimeoutError, TimeoutError)):
                await asyncio.wait_for(
                    backend.execute("sleep(10)", session_key="ephemeral"),
                    timeout=0.05,
                )

        assert client.create.call_count == 1
        assert client.delete.call_count == 1


class TestBuildBackendCredentialValidation:
    """``DaytonaPythonAdapter.build_backend`` must fail closed when api_key
    is missing, instead of letting the SDK fall back to ``DAYTONA_API_KEY``
    autodiscovery from process env (which differs from Phoenix's declared
    ``PHOENIX_SANDBOX_DAYTONA_API_KEY`` and would bypass Phoenix's resolution).
    """

    def test_missing_api_key_raises_value_error(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaPythonAdapter

        adapter = DaytonaPythonAdapter()
        with pytest.raises(ValueError, match="PHOENIX_SANDBOX_DAYTONA_API_KEY"):
            adapter.build_backend({})

    def test_empty_api_key_raises_value_error(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaPythonAdapter

        adapter = DaytonaPythonAdapter()
        with pytest.raises(ValueError, match="PHOENIX_SANDBOX_DAYTONA_API_KEY"):
            adapter.build_backend({"PHOENIX_SANDBOX_DAYTONA_API_KEY": ""})
