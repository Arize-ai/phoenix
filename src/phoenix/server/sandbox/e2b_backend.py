from __future__ import annotations

import hashlib
import logging
from typing import Any

from .types import ConfigFieldSpec, EnvVarSpec, ExecutionResult, SandboxAdapter, SandboxBackend

_HASH_LENGTH = 16

logger = logging.getLogger(__name__)


class E2BSandboxBackend:
    """Sandbox backend that executes Python code in E2B cloud sandboxes.

    Supports two modes:
    - **Ephemeral** (default): spins up a fresh sandbox per execute() call.
    - **Session**: creates one sandbox in __aenter__() and reuses it across
      execute() calls until close().
    """

    def __init__(
        self,
        api_key: str,
        template: str = "base",
        session_mode: bool = False,
    ) -> None:
        self._api_key = api_key
        self._template = template
        self._session_mode = session_mode
        self._sandbox: Any = None

    def environment_hash(self) -> str:
        return hashlib.sha256(self._template.encode()).hexdigest()[:_HASH_LENGTH]

    async def __aenter__(self) -> E2BSandboxBackend:
        if self._session_mode:
            from e2b_code_interpreter import AsyncSandbox  # type: ignore[import-not-found]

            self._sandbox = await AsyncSandbox.create(
                api_key=self._api_key, template=self._template
            )
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.close()

    async def execute(self, code: str, timeout: float = 30.0) -> ExecutionResult:
        from e2b_code_interpreter import (
            AsyncSandbox,  # type: ignore[import-not-found,unused-ignore]
        )

        try:
            if self._session_mode:
                if self._sandbox is None:
                    raise RuntimeError(
                        "Session-mode sandbox not initialized. "
                        "Use `async with E2BSandboxBackend(...)`"
                        " as a context manager."
                    )
                execution = await self._sandbox.run_code(code, timeout=timeout)
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
        if self._session_mode and self._sandbox is not None:
            await self._sandbox.close()
            self._sandbox = None


class E2BAdapter(SandboxAdapter):
    _key = "E2B"
    label = "E2B"
    description = "Runs code evaluators in E2B cloud sandboxes."
    python_packages = ["e2b_code_interpreter"]
    env_vars = [EnvVarSpec(name="PHOENIX_SANDBOX_E2B_API_KEY", required=True)]
    config_fields = [ConfigFieldSpec(key="template", label="Template", placeholder="base")]
    config_required = True
    has_session_mode = True
    setup_instructions = [
        "Sign up at e2b.dev and create an API key.",
        "Set PHOENIX_SANDBOX_E2B_API_KEY or configure it below.",
        "pip install e2b-code-interpreter",
    ]

    def create_backend(self, config: dict, credentials: dict) -> SandboxBackend:
        api_key = credentials.get("PHOENIX_SANDBOX_E2B_API_KEY", "")
        return E2BSandboxBackend(
            api_key=api_key,
            template=config.get("template", "base"),
            session_mode=config.get("session_mode", False),
        )
