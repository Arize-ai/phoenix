from __future__ import annotations

import logging
from typing import Any

from .types import ConfigFieldSpec, EnvVarSpec, ExecutionResult, SandboxAdapter, SandboxBackend

_HASH_LENGTH = 16

logger = logging.getLogger(__name__)


class E2BSandboxBackend:
    """Sandbox backend that executes Python code in E2B cloud sandboxes.

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (default) which
    spins up a fresh sandbox per call.
    """

    def __init__(
        self,
        api_key: str,
        template: str = "base",
    ) -> None:
        self._api_key = api_key
        self._template = template
        self._sessions: dict[str, Any] = {}

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            raise RuntimeError(f"Session '{session_key}' already exists")
        # avoids top-level import failure when e2b extra is not installed
        from e2b_code_interpreter import AsyncSandbox  # type: ignore[import-not-found]

        sandbox = await AsyncSandbox.create(api_key=self._api_key, template=self._template)
        self._sessions[session_key] = sandbox

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            await sandbox.close()

    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult:
        from e2b_code_interpreter import (
            AsyncSandbox,  # type: ignore[import-not-found,unused-ignore]
        )

        try:
            if session_key is not None:
                sandbox = self._sessions.get(session_key)
                if sandbox is None:
                    raise RuntimeError(
                        f"No session found for key '{session_key}'. Call start_session() first."
                    )
                execution = await sandbox.run_code(code, timeout=timeout)
            else:
                async with await AsyncSandbox.create(
                    api_key=self._api_key, template=self._template
                ) as sb:
                    execution = await sb.run_code(code, timeout=timeout)

            stdout = "\n".join(execution.logs.stdout) if execution.logs.stdout else ""
            stderr = "\n".join(execution.logs.stderr) if execution.logs.stderr else ""
            error = RuntimeError(execution.error) if execution.error else None
            exit_code = execution.exit_code
            if exit_code is None:
                exit_code = 1 if error else 0

            return ExecutionResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                error=error,
            )
        except TimeoutError:
            return ExecutionResult(
                stdout="",
                stderr="",
                exit_code=1,
                timed_out=True,
            )
        except Exception as e:
            if type(e).__module__.startswith("e2b"):
                return ExecutionResult(
                    stdout="",
                    stderr=str(e),
                    exit_code=1,
                    error=e,
                )
            raise

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


class E2BAdapter(SandboxAdapter):
    _key = "E2B"
    label = "E2B"
    description = "Runs code evaluators in E2B cloud sandboxes."
    python_packages = ["e2b_code_interpreter"]
    env_vars = [EnvVarSpec(name="PHOENIX_SANDBOX_E2B_API_KEY", required=True)]
    config_fields = [ConfigFieldSpec(key="template", label="Template", placeholder="base")]
    config_required = True
    setup_instructions = [
        "Sign up at e2b.dev and create an API key.",
        "Set PHOENIX_SANDBOX_E2B_API_KEY or configure it below.",
        "pip install e2b-code-interpreter",
    ]

    def create_backend(self, config: dict[str, str], credentials: dict[str, str]) -> SandboxBackend:
        api_key = credentials.get("PHOENIX_SANDBOX_E2B_API_KEY", "")
        return E2BSandboxBackend(
            api_key=api_key,
            template=config.get("template", "base"),
        )
