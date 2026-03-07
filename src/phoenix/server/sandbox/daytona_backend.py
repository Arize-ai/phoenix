from __future__ import annotations

import hashlib
import logging
from typing import Any

from .types import EnvVarSpec, ExecutionResult, SandboxAdapter, SandboxBackend

_HASH_LENGTH = 16
_PROVIDER = "daytona"

logger = logging.getLogger(__name__)


class DaytonaSandboxBackend:
    """Sandbox backend that executes Python code in Daytona cloud sandboxes.

    Supports two modes:
    - **Ephemeral** (default): spins up a fresh sandbox per execute() call.
    - **Session**: creates one sandbox in __aenter__() and reuses it across
      execute() calls until close().
    """

    def __init__(
        self,
        api_key: str = "",
        session_mode: bool = False,
    ) -> None:
        self._api_key = api_key
        self._session_mode = session_mode
        self._sandbox: Any = None

    def environment_hash(self) -> str:
        return hashlib.sha256(_PROVIDER.encode()).hexdigest()[:_HASH_LENGTH]

    def _make_client(self) -> Any:
        from daytona import AsyncDaytona, DaytonaConfig

        return AsyncDaytona(DaytonaConfig(api_key=self._api_key))

    async def __aenter__(self) -> DaytonaSandboxBackend:
        if self._session_mode:
            self._sandbox = await self._make_client().create(timeout=60)
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.close()

    async def execute(self, code: str, timeout: float = 30.0) -> ExecutionResult:
        try:
            timeout_int = int(timeout)
            if self._session_mode:
                if self._sandbox is None:
                    raise RuntimeError(
                        "Session-mode sandbox not initialized. "
                        "Use `async with DaytonaSandboxBackend(...)`"
                        " as a context manager."
                    )
                result = await self._sandbox.process.code_run(code, timeout=timeout_int)
            else:
                client = self._make_client()
                sandbox = await client.create(timeout=60)
                try:
                    result = await sandbox.process.code_run(code, timeout=timeout_int)
                finally:
                    await client.delete(sandbox, timeout=60)

            stdout = result.result if result.result else ""
            stderr = ""
            exit_code = result.exit_code
            error = RuntimeError(result.result) if exit_code != 0 else None

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
            if type(e).__module__.startswith("daytona"):
                return ExecutionResult(
                    stdout="",
                    stderr=str(e),
                    exit_code=1,
                    error=e,
                )
            raise

    async def close(self) -> None:
        if self._session_mode and self._sandbox is not None:
            await self._make_client().delete(self._sandbox, timeout=60)
            self._sandbox = None


class DaytonaAdapter(SandboxAdapter):
    _key = "DAYTONA"
    label = "Daytona"
    description = "Runs code evaluators in Daytona cloud sandboxes."
    python_packages = ["daytona"]
    env_vars = [EnvVarSpec(name="PHOENIX_SANDBOX_DAYTONA_API_KEY", required=True)]
    config_fields: list = []
    config_required = False
    has_session_mode = True
    setup_instructions = [
        "Sign up at daytona.io and create an API key.",
        "Set PHOENIX_SANDBOX_DAYTONA_API_KEY or configure it below.",
        "pip install daytona",
    ]

    def create_backend(self, config: dict, credentials: dict) -> SandboxBackend:
        api_key = credentials.get("PHOENIX_SANDBOX_DAYTONA_API_KEY", "")
        return DaytonaSandboxBackend(
            api_key=api_key,
            session_mode=config.get("session_mode", False),
        )
