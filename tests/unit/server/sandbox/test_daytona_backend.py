"""Unit tests for DaytonaSandboxBackend code_run kwarg correctness."""

from __future__ import annotations

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr

from phoenix.db.models import LanguageName

_API_KEY = SecretStr("test-key")
_ALT_KEY = SecretStr("key")


# Imported lazily inline to avoid pulling pydantic at module-collection time
def _daytona_creds(key: str = "test-key") -> "DaytonaCredentials":
    from phoenix.server.sandbox.types import DaytonaCredentials

    return DaytonaCredentials(DAYTONA_API_KEY=key)


def _daytona_config(language: LanguageName = "PYTHON") -> "DaytonaConfig":
    from phoenix.server.sandbox.types import DaytonaConfig

    return DaytonaConfig(language=language)


from phoenix.server.sandbox.types import (  # noqa: E402
    DaytonaConfig,
    DaytonaCredentials,
    DaytonaDeployment,
)

_DAYTONA_DEPLOY = DaytonaDeployment()


class _CodeRunParams:
    """Minimal stand-in for daytona_sdk.CodeRunParams."""

    def __init__(
        self,
        argv: list[str] | None = None,
        env: dict[str, str] | None = None,
        timeout: int | None = None,
    ) -> None:
        self.argv = argv
        self.env = env
        self.timeout = timeout


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

            backend = DaytonaSandboxBackend(api_key=_API_KEY, user_env=user_env, language="PYTHON")
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

            backend = DaytonaSandboxBackend(api_key=_API_KEY, user_env={}, language="PYTHON")
            await backend.execute("1+1", session_key="s1")

        workspace = daytona_mod.AsyncDaytona.return_value.create.return_value
        call_args = workspace.process.code_run.call_args
        params = call_args.kwargs["params"]
        assert isinstance(params, _CodeRunParams)
        assert params.env is None, (
            f"Expected params.env=None for empty user_env, got {params.env!r}"
        )

    @pytest.mark.asyncio
    async def test_ephemeral_execute_passes_timeout_to_code_run_params(self) -> None:
        """Per-execute timeout must reach Daytona's code_run params on ephemeral runs."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_API_KEY, user_env={}, language="PYTHON")
            await backend.execute("1+1", session_key="s1", timeout=7)

        workspace = daytona_mod.AsyncDaytona.return_value.create.return_value
        call_args = workspace.process.code_run.call_args
        params = call_args.kwargs["params"]
        assert isinstance(params, _CodeRunParams)
        assert params.timeout == 7

    @pytest.mark.asyncio
    async def test_session_execute_passes_timeout_to_code_run_params(self) -> None:
        """Per-execute timeout must also reach Daytona when reusing a named session."""
        daytona_mod, process_mod = _make_daytona_mocks()

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_API_KEY, user_env={}, language="PYTHON")
            await backend.start_session("s1")
            await backend.execute("1+1", session_key="s1", timeout=11)

        workspace = daytona_mod.AsyncDaytona.return_value.create.return_value
        call_args = workspace.process.code_run.call_args
        params = call_args.kwargs["params"]
        assert isinstance(params, _CodeRunParams)
        assert params.timeout == 11


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

            backend = DaytonaSandboxBackend(
                api_key=_ALT_KEY, network_block_all=True, language="PYTHON"
            )
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

            backend = DaytonaSandboxBackend(
                api_key=_ALT_KEY, network_block_all=False, language="PYTHON"
            )
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

            backend = DaytonaSandboxBackend(
                api_key=_ALT_KEY, network_block_all=True, language="PYTHON"
            )
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

            backend = DaytonaSandboxBackend(api_key=_API_KEY, language="PYTHON")
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

            backend = DaytonaSandboxBackend(api_key=_API_KEY, language="PYTHON")
            with pytest.raises((asyncio.TimeoutError, TimeoutError)):
                await asyncio.wait_for(
                    backend.execute("sleep(10)", session_key="ephemeral"),
                    timeout=0.05,
                )

        assert client.create.call_count == 1
        assert client.delete.call_count == 1


class TestBuildBackendCredentialValidation:
    """``DaytonaAdapter.build_backend`` must fail closed when api_key
    is missing, instead of letting the SDK fall back to ``DAYTONA_API_KEY``
    autodiscovery from process env (which differs from Phoenix's declared
    ``DAYTONA_API_KEY`` and would bypass Phoenix's resolution).
    """

    def test_missing_api_key_raises_value_error(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaAdapter

        adapter = DaytonaAdapter()
        with pytest.raises(ValueError, match="DAYTONA_API_KEY"):
            adapter.build_backend(
                _daytona_config(),
                credentials=_daytona_creds(""),
                deployment=_DAYTONA_DEPLOY,
            )

    def test_empty_api_key_raises_value_error(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaAdapter

        adapter = DaytonaAdapter()
        with pytest.raises(ValueError, match="DAYTONA_API_KEY"):
            adapter.build_backend(
                _daytona_config(),
                credentials=_daytona_creds(""),
                deployment=_DAYTONA_DEPLOY,
            )


class TestTypescriptRouting:
    """Verify that ``language='TYPESCRIPT'`` routes ``_create_params`` to
    ``CodeLanguage.TYPESCRIPT`` and ``_install_packages`` to a Node-side
    ``npm install`` invocation with argv-shape safety (no shell interpolation).
    """

    @pytest.mark.asyncio
    async def test_create_params_uses_typescript_language(self) -> None:
        """language='TYPESCRIPT' → CreateSandboxFromSnapshotParams(language='typescript')."""
        daytona_mod, process_mod = _make_daytona_mocks()

        # CodeLanguage.TYPESCRIPT is "typescript" upstream; mock the enum.
        daytona_mod.CodeLanguage = MagicMock()
        daytona_mod.CodeLanguage.PYTHON = "python"
        daytona_mod.CodeLanguage.TYPESCRIPT = "typescript"

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(api_key=_API_KEY, language="TYPESCRIPT")
            await backend.execute("console.log('hi')", session_key="s1")

        create_call = daytona_mod.AsyncDaytona.return_value.create.call_args
        assert create_call is not None, "client.create() was never called"
        params = create_call.args[0] if create_call.args else create_call.kwargs.get("params")
        assert isinstance(params, _CreateSandboxFromSnapshotParams), (
            f"Expected CreateSandboxFromSnapshotParams; got {type(params)}"
        )
        assert params.language == "typescript", (
            f"Expected language=CodeLanguage.TYPESCRIPT (='typescript'); got {params.language!r}"
        )

    @pytest.mark.asyncio
    async def test_install_packages_uses_npm_argv_shape(self) -> None:
        """language='TYPESCRIPT' + packages → generated TS source runs
        ``spawnSync('npm', ['install', ...pkgs])`` with packages embedded as a
        JSON array literal — NOT shell-string interpolation, NOT pip."""
        daytona_mod, process_mod = _make_daytona_mocks()
        daytona_mod.CodeLanguage = MagicMock()
        daytona_mod.CodeLanguage.PYTHON = "python"
        daytona_mod.CodeLanguage.TYPESCRIPT = "typescript"

        modules = {
            "daytona_sdk": daytona_mod,
            "daytona_sdk.common": MagicMock(),
            "daytona_sdk.common.process": process_mod,
        }
        with patch.dict(sys.modules, modules):
            from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

            backend = DaytonaSandboxBackend(
                api_key=_API_KEY,
                packages=["is-odd"],
                language="TYPESCRIPT",
            )
            await backend.start_session("sess-ts")

        workspace = daytona_mod.AsyncDaytona.return_value.create.return_value
        # First code_run call is the install; second (if any) is execution.
        # start_session only runs the install.
        assert workspace.process.code_run.call_count >= 1, (
            "expected at least one code_run invocation (install)"
        )
        install_call = workspace.process.code_run.call_args_list[0]
        install_source = install_call.args[0] if install_call.args else ""

        assert "npm" in install_source, (
            f"expected 'npm' in generated install source; got: {install_source!r}"
        )
        assert "install" in install_source, (
            f"expected 'install' in generated install source; got: {install_source!r}"
        )
        assert "pip install" not in install_source, (
            f"TS install must not invoke pip; got: {install_source!r}"
        )
        # Package list MUST be embedded as a JSON array literal.
        assert '["is-odd"]' in install_source, (
            f"expected packages embedded as JSON array literal '[\"is-odd\"]' "
            f"in install source; got: {install_source!r}"
        )
        # Argv-shape via spawnSync — NOT shell-string interpolation. Reject
        # the shell-interpolation footgun forms explicitly.
        assert ("spawnSync" in install_source) or ("execFileSync" in install_source), (
            f"expected argv-style spawnSync/execFileSync (not shell-string "
            f"interpolation); got: {install_source!r}"
        )
        # Defensive: no template-string concatenation of the package list into
        # an `npm install ...` shell command.
        assert "`npm install ${" not in install_source, (
            f"shell-string interpolation of pkgs into npm command is unsafe; "
            f"got: {install_source!r}"
        )
        # cwd must be pinned to /tmp so the resulting /tmp/node_modules/<pkg>
        # is resolvable from subsequent code_run invocations (which execute
        # at /tmp/dtn_*.ts). Verified against a live Daytona TS workspace:
        # default cwd is /home/daytona and require.resolve.paths from user
        # code lists /tmp/node_modules first, but never /home/daytona/node_modules.
        # `npm install -g` also fails because nvm installs to lib/node_modules
        # which Node's legacy GLOBAL_FOLDERS lookup misses (it searches lib/node).
        assert "cwd: '/tmp'" in install_source or 'cwd: "/tmp"' in install_source, (
            f"expected spawnSync cwd pinned to /tmp so installed packages land "
            f"in /tmp/node_modules (the first entry in Node's resolve path on "
            f"Daytona's TS workspace); got: {install_source!r}"
        )


def test_to_execution_result_strips_ansi_on_success() -> None:
    """Daytona's combined-stream output is ANSI-stripped before landing on stdout."""
    from phoenix.server.sandbox.daytona_backend import _to_execution_result

    response = MagicMock(result="\x1b[32mok\x1b[0m\n", exit_code=0)
    result = _to_execution_result(response)
    assert result.stdout == "ok\n"
    assert result.stderr == ""
    assert result.error is None


def test_to_execution_result_strips_ansi_on_failure() -> None:
    """Failed runs land on stderr + error — both must be ANSI-stripped."""
    from phoenix.server.sandbox.daytona_backend import _to_execution_result

    response = MagicMock(result="\x1b[31mTraceback ...\x1b[0m\nValueError: bad\n", exit_code=1)
    result = _to_execution_result(response)
    assert result.stdout == ""
    assert result.stderr == "Traceback ...\nValueError: bad\n"
    assert result.error == "Traceback ...\nValueError: bad\n"


@pytest.mark.asyncio
async def test_execute_strips_ansi_in_raised_exception_path() -> None:
    """ANSI bytes in str(exc) must be stripped on stderr/error when execute
    catches a raised exception from the SDK."""
    daytona_mod, process_mod = _make_daytona_mocks()
    modules = {
        "daytona_sdk": daytona_mod,
        "daytona_sdk.common": MagicMock(),
        "daytona_sdk.common.process": process_mod,
    }
    with patch.dict(sys.modules, modules):
        from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

        backend = DaytonaSandboxBackend(api_key=_API_KEY, language="PYTHON")
        with patch.object(backend, "_get_client", side_effect=RuntimeError("\x1b[31mboom\x1b[0m")):
            result = await backend.execute("noop", session_key="ephemeral")

    assert result.error == "boom"
    assert result.stderr == "boom"


def test_build_backend_wires_packages_to_backend() -> None:
    """``DaytonaAdapter.build_backend`` forwards ``config.dependencies.packages``
    onto the returned ``DaytonaSandboxBackend._packages``."""
    from phoenix.server.sandbox.daytona_backend import DaytonaAdapter
    from phoenix.server.sandbox.types import (
        DaytonaConfig,
        DaytonaCredentials,
        DaytonaDeployment,
    )

    adapter = DaytonaAdapter()
    packages = ["requests", "numpy"]
    config = DaytonaConfig.model_validate(
        {"language": "PYTHON", "dependencies": {"packages": packages}}
    )
    creds = DaytonaCredentials(DAYTONA_API_KEY=SecretStr("k"))
    backend = adapter.build_backend(config, credentials=creds, deployment=DaytonaDeployment())
    assert backend._packages == packages  # type: ignore[attr-defined]
