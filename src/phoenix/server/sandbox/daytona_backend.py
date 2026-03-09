from __future__ import annotations

import hashlib
import logging
from typing import Any

from .types import ConfigFieldSpec, EnvVarSpec, ExecutionResult, SandboxAdapter, SandboxBackend

_HASH_LENGTH = 16
_PROVIDER = "daytona"

logger = logging.getLogger(__name__)


class DaytonaSandboxBackend:
    """Sandbox backend that executes Python code in Daytona cloud sandboxes.

    Supports two modes:
    - **Ephemeral** (default): spins up a fresh sandbox per execute() call.
    - **Session**: call start_session() to provision a reusable sandbox, then
      pass the session_key to execute(). Call stop_session() to tear it down.
    """

    def __init__(
        self,
        api_key: str = "",
    ) -> None:
        self._api_key = api_key
        self._sessions: dict[str, Any] = {}

    def environment_hash(self) -> str:
        return hashlib.sha256(_PROVIDER.encode()).hexdigest()[:_HASH_LENGTH]

    def _make_client(self) -> Any:
        from daytona import AsyncDaytona, DaytonaConfig

        return AsyncDaytona(DaytonaConfig(api_key=self._api_key))

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            raise RuntimeError(f"Session '{session_key}' already exists")
        client = self._make_client()
        sandbox = await client.create(timeout=60)
        self._sessions[session_key] = sandbox

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            client = self._make_client()
            await client.delete(sandbox, timeout=60)

    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult:
        try:
            timeout_int = int(timeout)
            if session_key is not None:
                sandbox = self._sessions.get(session_key)
                if sandbox is None:
                    raise RuntimeError(
                        f"No sandbox for session '{session_key}'. Call start_session() first."
                    )
                result = await sandbox.process.code_run(code, timeout=timeout_int)
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
        for key in list(self._sessions):
            await self.stop_session(key)


class DaytonaAdapter(SandboxAdapter):
    _key = "DAYTONA"
    label = "Daytona"
    description = "Runs code evaluators in Daytona cloud sandboxes."
    python_packages = ["daytona"]
    env_vars = [EnvVarSpec(name="PHOENIX_SANDBOX_DAYTONA_API_KEY", required=True)]
    config_fields: list[ConfigFieldSpec] = []
    config_required = False
    setup_instructions = [
        "Sign up at daytona.io and create an API key.",
        "Set PHOENIX_SANDBOX_DAYTONA_API_KEY or configure it below.",
        "pip install daytona",
    ]

    def create_backend(self, config: dict[str, Any], credentials: dict[str, Any]) -> SandboxBackend:
        api_key = credentials.get("PHOENIX_SANDBOX_DAYTONA_API_KEY", "")
        return DaytonaSandboxBackend(api_key=api_key)
