"""E2B sandbox backend."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from pydantic import SecretStr

from .types import (
    E2BConfig,
    E2BCredentials,
    E2BDeployment,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
)

if TYPE_CHECKING:
    from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
    from e2b_code_interpreter.models import Execution

logger = logging.getLogger(__name__)

ENV_E2B_API_KEY = "E2B_API_KEY"


class E2BSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in E2B cloud sandboxes."""

    def __init__(
        self,
        api_key: SecretStr,
        user_env: Optional[Mapping[str, str]] = None,
        allow_internet_access: bool = True,
        packages: Optional[Sequence[str]] = None,
        domain: Optional[str] = None,
        api_url: Optional[str] = None,
    ) -> None:
        self._api_key = api_key
        self._user_env: dict[str, str] = dict(user_env or {})
        self._allow_internet_access = allow_internet_access
        self._packages: list[str] = list(packages) if packages else []
        self._domain = domain
        self._api_url = api_url
        self._sessions: dict[str, AsyncSandbox] = {}
        self.secret_values = compose_secret_values(user_env, self._api_key)

    def _get_sandbox_cls(self) -> type[AsyncSandbox]:
        from e2b_code_interpreter.code_interpreter_async import AsyncSandbox

        return AsyncSandbox

    def _create_kwargs(self) -> dict[str, Any]:
        # Do NOT pass template: only the SDK default (code-interpreter-v1)
        # runs the Jupyter server that run_code() POSTs to. The "base" image
        # returns "502 The sandbox is running but port is not open".
        kwargs: dict[str, Any] = {
            "api_key": self._api_key.get_secret_value(),
            "allow_internet_access": self._allow_internet_access,
        }
        if self._domain is not None:
            kwargs["domain"] = self._domain
        if self._api_url is not None:
            kwargs["api_url"] = self._api_url
        return kwargs

    async def _install_packages(self, sandbox: AsyncSandbox) -> None:
        # Do not shlex.quote: the generated code passes a list to
        # subprocess.run (no shell), so shell quoting would break specs like
        # 'numpy>=1.0'. The !r format renders correct Python list literals.
        if not self._packages:
            return
        install_code = (
            "import subprocess, sys\n"
            "r = subprocess.run(\n"
            f"    [sys.executable, '-m', 'pip', 'install', *{self._packages!r}],\n"
            "    capture_output=True, text=True\n"
            ")\n"
            "if r.returncode != 0:\n"
            "    raise RuntimeError(r.stderr)\n"
        )
        execution = await sandbox.run_code(install_code)
        if execution.error:
            raise RuntimeError(f"pip install failed for {self._packages!r}: {execution.error}")

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"E2B session '{session_key}' already exists; reusing")
            return
        sandbox_cls = self._get_sandbox_cls()
        sandbox = await sandbox_cls.create(**self._create_kwargs())
        await self._install_packages(sandbox)
        self._sessions[session_key] = sandbox
        logger.debug(f"Started E2B session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            await sandbox.kill()
            logger.debug(f"Stopped E2B session '{session_key}'")

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            sandbox = self._sessions.get(session_key)
            execution: Execution
            if sandbox is not None:
                execution = await sandbox.run_code(
                    code,
                    envs=self._user_env or None,
                    timeout=timeout,
                )
            else:
                # Ephemeral path: evaluator calls execute() without start_session,
                # so install configured packages here too.
                sandbox_cls = self._get_sandbox_cls()
                async with await sandbox_cls.create(**self._create_kwargs()) as sb:
                    await self._install_packages(sb)
                    execution = await sb.run_code(
                        code,
                        envs=self._user_env or None,
                        timeout=timeout,
                    )

            stdout = "\n".join(execution.logs.stdout) if execution.logs.stdout else ""
            stderr = "\n".join(execution.logs.stderr) if execution.logs.stderr else ""
            error_str: Optional[str] = str(execution.error) if execution.error else None

            return ExecutionResult(stdout=stdout, stderr=stderr, error=error_str)
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


class E2BAdapter(SandboxAdapter[E2BConfig, E2BCredentials, E2BDeployment]):
    backend_type = "E2B"
    display_name = "E2B"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `e2b` extra.",
        "Provide `E2B_API_KEY`.",
    )
    config_model = E2BConfig
    credentials_model = E2BCredentials
    deployment_config_model = E2BDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        import e2b_code_interpreter  # noqa: F401

    def build_backend(
        self,
        config: E2BConfig,
        *,
        credentials: E2BCredentials,
        deployment: E2BDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        # Fail-closed: empty api_key would let the SDK silently fall back to
        # os.getenv("E2B_API_KEY"), bypassing Phoenix's credential resolution.
        api_key = credentials.E2B_API_KEY.get_secret_value()
        if not api_key:
            raise ValueError(
                "E2B sandbox authentication is not configured. Set "
                "E2B_API_KEY in Settings → Sandboxes → E2B → Credentials, "
                "or as a process environment variable."
            )
        allow_internet_access = (
            config.internet_access is None or config.internet_access.mode != "deny"
        )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        return E2BSandboxBackend(
            api_key=SecretStr(api_key),
            user_env=user_env,
            allow_internet_access=allow_internet_access,
            packages=packages or None,
            domain=deployment.domain,
            api_url=deployment.api_url,
        )
