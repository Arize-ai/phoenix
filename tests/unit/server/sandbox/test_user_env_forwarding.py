"""Tests that user_env is forwarded correctly through each adapter's build_backend.

Capability matrix (D8):
- E2B / Deno / Daytona / Vercel: execute-time — stored on backend, merged with per-call env
- Modal: creation-time — stored on backend, passed to sandbox creation
- WASM: raises UnsupportedOperation when non-empty user_env provided

Note: Vercel's AsyncSandbox.create does not accept env; env is forwarded via run_command.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox.types import UnsupportedOperation

# ---------------------------------------------------------------------------
# E2B
# ---------------------------------------------------------------------------


class TestE2BUserEnvForwarding:
    def _make_backend(self, user_env: dict[str, str] | None = None) -> Any:
        from phoenix.server.sandbox.e2b_backend import E2BSandboxBackend

        return E2BSandboxBackend(api_key="test-key", user_env=user_env)

    @pytest.mark.asyncio
    async def test_user_env_merged_with_empty_call_env(self) -> None:
        backend = self._make_backend(user_env={"BASE": "val"})
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=[], stderr=[])
            result.error = None
            return result

        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("print('hi')", "s1")
        assert captured["envs"] == {"BASE": "val"}

    @pytest.mark.asyncio
    async def test_call_env_overrides_user_env(self) -> None:
        backend = self._make_backend(user_env={"KEY": "base"})
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=[], stderr=[])
            result.error = None
            return result

        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("print('hi')", "s1", env={"KEY": "override"})
        assert captured["envs"] == {"KEY": "override"}

    @pytest.mark.asyncio
    async def test_no_user_env_passes_empty_dict(self) -> None:
        backend = self._make_backend(user_env=None)
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=[], stderr=[])
            result.error = None
            return result

        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("print('hi')", "s1")
        assert captured["envs"] == {}

    def test_adapter_passes_user_env_to_backend(self) -> None:
        from phoenix.server.sandbox.e2b_backend import E2BAdapter, E2BSandboxBackend

        adapter = E2BAdapter()
        with patch.dict("os.environ", {"PHOENIX_SANDBOX_E2B_API_KEY": "key"}):
            backend = adapter.build_backend({}, user_env={"FOO": "bar"})
        assert isinstance(backend, E2BSandboxBackend)
        assert backend._user_env == {"FOO": "bar"}


# ---------------------------------------------------------------------------
# Deno
# ---------------------------------------------------------------------------


class TestDenoUserEnvForwarding:
    def _make_backend(self, user_env: dict[str, str] | None = None) -> Any:
        from phoenix.server.sandbox.deno_backend import DenoSandboxBackend

        return DenoSandboxBackend(api_key="test-key", user_env=user_env)

    @pytest.mark.asyncio
    async def test_user_env_merged_at_execute(self) -> None:
        backend = self._make_backend(user_env={"MY_VAR": "hello"})
        captured: dict[str, Any] = {}

        async def fake_run(code: str, **kwargs: Any) -> Any:
            captured["env"] = kwargs.get("env")
            result = MagicMock()
            result.stdout = ""
            result.stderr = ""
            result.error = None
            return result

        client_mock = MagicMock()
        client_mock.run = fake_run
        with patch.object(backend, "_get_client", return_value=client_mock):
            await backend.execute("console.log('x')", "s1")
        assert captured["env"] == {"MY_VAR": "hello"}

    def test_adapter_passes_user_env_to_backend(self) -> None:
        from phoenix.server.sandbox.deno_backend import DenoAdapter, DenoSandboxBackend

        adapter = DenoAdapter()
        with patch.dict("os.environ", {"PHOENIX_SANDBOX_DENO_API_KEY": "key"}):
            backend = adapter.build_backend({}, user_env={"X": "1"})
        assert isinstance(backend, DenoSandboxBackend)
        assert backend._user_env == {"X": "1"}


# ---------------------------------------------------------------------------
# Daytona
# ---------------------------------------------------------------------------


class TestDaytonaUserEnvForwarding:
    def _make_backend(self, user_env: dict[str, str] | None = None) -> Any:
        from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

        return DaytonaSandboxBackend(api_key="test-key", user_env=user_env)

    @pytest.mark.asyncio
    async def test_user_env_merged_at_execute(self) -> None:
        backend = self._make_backend(user_env={"DB_HOST": "localhost"})
        captured: dict[str, Any] = {}

        result_mock = MagicMock()
        result_mock.stdout = "ok"
        result_mock.stderr = ""
        result_mock.exit_code = 0

        async def fake_code_run(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            return result_mock

        workspace_mock = MagicMock()
        workspace_mock.process = MagicMock()
        workspace_mock.process.code_run = fake_code_run
        backend._sessions["s1"] = workspace_mock

        await backend.execute("print('hi')", "s1")
        assert captured["envs"] == {"DB_HOST": "localhost"}

    def test_adapter_passes_user_env_to_backend(self) -> None:
        from phoenix.server.sandbox.daytona_backend import (
            DaytonaPythonAdapter,
            DaytonaSandboxBackend,
        )

        adapter = DaytonaPythonAdapter()
        with patch.dict("os.environ", {"PHOENIX_SANDBOX_DAYTONA_API_KEY": "key"}):
            backend = adapter.build_backend({}, user_env={"DB_HOST": "localhost"})
        assert isinstance(backend, DaytonaSandboxBackend)
        assert backend._user_env == {"DB_HOST": "localhost"}


class TestDaytonaDependencyInstallation:
    @pytest.mark.asyncio
    async def test_packages_installed_before_first_execute(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

        backend = DaytonaSandboxBackend(api_key="k", packages=["pandas==2.0.0"])
        calls: list[str] = []

        success_result = MagicMock()
        success_result.stdout = ""
        success_result.stderr = ""
        success_result.exit_code = 0

        async def fake_code_run(code: str, **kwargs: Any) -> Any:
            calls.append(code)
            return success_result

        workspace_mock = MagicMock()
        workspace_mock.process = MagicMock()
        workspace_mock.process.code_run = fake_code_run

        client_mock = MagicMock()
        client_mock.create = AsyncMock(return_value=workspace_mock)

        with patch.object(backend, "_get_client", return_value=client_mock):
            await backend.start_session("s1")

        assert any("pip" in c for c in calls), "pip install not called during start_session"
        assert any("pandas==2.0.0" in c for c in calls)

    @pytest.mark.asyncio
    async def test_install_failure_raises_before_session_caches(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

        backend = DaytonaSandboxBackend(api_key="k", packages=["bad-pkg"])

        fail_result = MagicMock()
        fail_result.stdout = ""
        fail_result.stderr = "ERROR: Could not find a version that satisfies the requirement"
        fail_result.exit_code = 1

        async def fake_code_run(code: str, **kwargs: Any) -> Any:
            return fail_result

        workspace_mock = MagicMock()
        workspace_mock.process = MagicMock()
        workspace_mock.process.code_run = fake_code_run

        client_mock = MagicMock()
        client_mock.create = AsyncMock(return_value=workspace_mock)

        with patch.object(backend, "_get_client", return_value=client_mock):
            with pytest.raises(RuntimeError, match="pip install"):
                await backend.start_session("s1")

        assert "s1" not in backend._sessions

    @pytest.mark.asyncio
    async def test_no_packages_skips_install(self) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaSandboxBackend

        backend = DaytonaSandboxBackend(api_key="k", packages=[])
        calls: list[str] = []

        async def fake_code_run(code: str, **kwargs: Any) -> Any:
            calls.append(code)
            return MagicMock(stdout="", stderr="", exit_code=0)

        workspace_mock = MagicMock()
        workspace_mock.process = MagicMock()
        workspace_mock.process.code_run = fake_code_run

        client_mock = MagicMock()
        client_mock.create = AsyncMock(return_value=workspace_mock)

        with patch.object(backend, "_get_client", return_value=client_mock):
            await backend.start_session("s1")

        assert not calls, "code_run should not be called when packages is empty"
        assert "s1" in backend._sessions

    def test_adapter_passes_packages_to_backend(self) -> None:
        from phoenix.server.sandbox.daytona_backend import (
            DaytonaPythonAdapter,
            DaytonaSandboxBackend,
        )

        adapter = DaytonaPythonAdapter()
        config = {"dependencies": {"packages": ["numpy", "pandas"]}}
        with patch.dict("os.environ", {"PHOENIX_SANDBOX_DAYTONA_API_KEY": "key"}):
            backend = adapter.build_backend(config)
        assert isinstance(backend, DaytonaSandboxBackend)
        assert backend._packages == ["numpy", "pandas"]


# ---------------------------------------------------------------------------
# Modal (creation-time)
# ---------------------------------------------------------------------------


class TestModalUserEnvForwarding:
    def test_adapter_passes_user_env_to_backend(self) -> None:
        from phoenix.server.sandbox.modal_backend import ModalAdapter, ModalSandboxBackend

        modal_mock = MagicMock()
        modal_mock.App.lookup = MagicMock(return_value=MagicMock())
        modal_mock.Image.debian_slim = MagicMock(return_value=MagicMock())

        with patch.dict("sys.modules", {"modal": modal_mock}):
            adapter = ModalAdapter()
            backend = adapter.build_backend({}, user_env={"SECRET": "value"})
        assert isinstance(backend, ModalSandboxBackend)
        assert backend._user_env == {"SECRET": "value"}

    @pytest.mark.asyncio
    async def test_user_env_passed_to_sandbox_create(self) -> None:
        """env_dict is forwarded to Sandbox.create.aio when user_env is set."""
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        modal_mock = MagicMock()
        modal_mock.App.lookup = MagicMock(return_value=MagicMock())
        modal_mock.Image.debian_slim = MagicMock(return_value=MagicMock())

        captured: dict[str, Any] = {}

        async def fake_create(**kwargs: Any) -> Any:
            captured.update(kwargs)
            sandbox = MagicMock()
            sandbox.terminate = MagicMock()
            sandbox.terminate.aio = AsyncMock()
            proc = MagicMock()
            proc.stdout = MagicMock()
            proc.stdout.read = MagicMock()
            proc.stdout.read.aio = AsyncMock(return_value="")
            proc.stderr = MagicMock()
            proc.stderr.read = MagicMock()
            proc.stderr.read.aio = AsyncMock(return_value="")
            proc.wait = MagicMock()
            proc.wait.aio = AsyncMock()
            proc.returncode = 0
            sandbox.exec = MagicMock()
            sandbox.exec.aio = AsyncMock(return_value=proc)
            return sandbox

        modal_mock.Sandbox = MagicMock()
        modal_mock.Sandbox.create = MagicMock()
        modal_mock.Sandbox.create.aio = fake_create

        with patch.dict("sys.modules", {"modal": modal_mock}):
            backend = ModalSandboxBackend(user_env={"MY_KEY": "my_val"})
            await backend.execute("print('hi')", "no-session")

        assert captured.get("env_dict") == {"MY_KEY": "my_val"}

    @pytest.mark.asyncio
    async def test_execute_per_call_env_raises_unsupported_operation(self) -> None:
        """Per-call execute(env=...) must raise UnsupportedOperation for Modal."""
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        modal_mock = MagicMock()
        with patch.dict("sys.modules", {"modal": modal_mock}):
            backend = ModalSandboxBackend(user_env=None)
            with pytest.raises(UnsupportedOperation):
                await backend.execute("print('hi')", "s1", env={"KEY": "val"})

    @pytest.mark.asyncio
    async def test_no_user_env_omits_env_dict_from_create(self) -> None:
        """When user_env is empty, env_dict is NOT passed to Sandbox.create.aio."""
        from phoenix.server.sandbox.modal_backend import ModalSandboxBackend

        modal_mock = MagicMock()
        modal_mock.App.lookup = MagicMock(return_value=MagicMock())
        modal_mock.Image.debian_slim = MagicMock(return_value=MagicMock())

        captured: dict[str, Any] = {}

        async def fake_create(**kwargs: Any) -> Any:
            captured.update(kwargs)
            sandbox = MagicMock()
            sandbox.terminate = MagicMock()
            sandbox.terminate.aio = AsyncMock()
            proc = MagicMock()
            proc.stdout = MagicMock()
            proc.stdout.read = MagicMock()
            proc.stdout.read.aio = AsyncMock(return_value="")
            proc.stderr = MagicMock()
            proc.stderr.read = MagicMock()
            proc.stderr.read.aio = AsyncMock(return_value="")
            proc.wait = MagicMock()
            proc.wait.aio = AsyncMock()
            proc.returncode = 0
            sandbox.exec = MagicMock()
            sandbox.exec.aio = AsyncMock(return_value=proc)
            return sandbox

        modal_mock.Sandbox = MagicMock()
        modal_mock.Sandbox.create = MagicMock()
        modal_mock.Sandbox.create.aio = fake_create

        with patch.dict("sys.modules", {"modal": modal_mock}):
            backend = ModalSandboxBackend(user_env=None)
            await backend.execute("print('hi')", "no-session")

        assert "env_dict" not in captured


# ---------------------------------------------------------------------------
# Vercel (execute-time via run_command)
# ---------------------------------------------------------------------------


class TestVercelUserEnvForwarding:
    def _make_backend(self, user_env: dict[str, str] | None = None) -> Any:
        from phoenix.server.sandbox.vercel_backend import VercelSandboxBackend

        return VercelSandboxBackend(use_oidc_env=True, language="PYTHON", user_env=user_env)

    @pytest.mark.asyncio
    async def test_user_env_forwarded_to_run_command(self) -> None:
        backend = self._make_backend(user_env={"MY_VAR": "hello"})
        captured: dict[str, Any] = {}

        async def fake_run_command(cmd: str, args: Any, **kwargs: Any) -> Any:
            captured["env"] = kwargs.get("env")
            result = MagicMock()
            result.stdout = AsyncMock(return_value="")
            result.stderr = AsyncMock(return_value="")
            result.exit_code = 0
            return result

        sandbox_mock = MagicMock()
        sandbox_mock.run_command = fake_run_command
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("print('hi')", "s1")
        assert captured["env"] == {"MY_VAR": "hello"}

    @pytest.mark.asyncio
    async def test_call_env_overrides_user_env(self) -> None:
        backend = self._make_backend(user_env={"KEY": "base"})
        captured: dict[str, Any] = {}

        async def fake_run_command(cmd: str, args: Any, **kwargs: Any) -> Any:
            captured["env"] = kwargs.get("env")
            result = MagicMock()
            result.stdout = AsyncMock(return_value="")
            result.stderr = AsyncMock(return_value="")
            result.exit_code = 0
            return result

        sandbox_mock = MagicMock()
        sandbox_mock.run_command = fake_run_command
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("print('hi')", "s1", env={"KEY": "override"})
        assert captured["env"] == {"KEY": "override"}

    @pytest.mark.asyncio
    async def test_no_user_env_omits_env_from_run_command(self) -> None:
        backend = self._make_backend(user_env=None)
        captured: dict[str, Any] = {}

        async def fake_run_command(cmd: str, args: Any, **kwargs: Any) -> Any:
            captured["env"] = kwargs.get("env")
            result = MagicMock()
            result.stdout = AsyncMock(return_value="")
            result.stderr = AsyncMock(return_value="")
            result.exit_code = 0
            return result

        sandbox_mock = MagicMock()
        sandbox_mock.run_command = fake_run_command
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("print('hi')", "s1")
        assert captured["env"] is None

    def test_adapter_passes_user_env_to_backend(self) -> None:
        from phoenix.server.sandbox.vercel_backend import VercelPythonAdapter, VercelSandboxBackend

        adapter = VercelPythonAdapter()
        with patch.dict("os.environ", {"VERCEL_OIDC_TOKEN": "tok"}):
            backend = adapter.build_backend({}, user_env={"FOO": "bar"})
        assert isinstance(backend, VercelSandboxBackend)
        assert backend._user_env == {"FOO": "bar"}


# ---------------------------------------------------------------------------
# WASM (defensive raise)
# ---------------------------------------------------------------------------


class TestWASMUserEnvDefensiveRaise:
    def test_non_empty_user_env_raises_unsupported_operation(self) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMAdapter

        with patch("phoenix.server.sandbox.wasm_backend.WASMBackend"):
            adapter = WASMAdapter()
            with pytest.raises(UnsupportedOperation):
                adapter.build_backend({}, user_env={"KEY": "val"})

    def test_none_user_env_does_not_raise(self) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMAdapter, WASMBackend

        with patch("phoenix.server.sandbox.wasm_backend.WASMBackend") as MockWASM:
            MockWASM.return_value = MagicMock(spec=WASMBackend)
            adapter = WASMAdapter()
            backend = adapter.build_backend({}, user_env=None)
        assert backend is not None

    def test_empty_user_env_does_not_raise(self) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMAdapter, WASMBackend

        with patch("phoenix.server.sandbox.wasm_backend.WASMBackend") as MockWASM:
            MockWASM.return_value = MagicMock(spec=WASMBackend)
            adapter = WASMAdapter()
            backend = adapter.build_backend({}, user_env={})
        assert backend is not None
