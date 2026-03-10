from __future__ import annotations

import logging
from uuid import uuid4

from .types import (
    BaseNoSessionBackend,
    ConfigFieldSpec,
    EnvVarSpec,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

_HASH_LENGTH = 16

logger = logging.getLogger(__name__)


class VercelSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend that executes Python code in Vercel microVM sandboxes.

    Each execute() call creates a fresh microVM sandbox, writes the code to a
    temp file, runs it, and stops the sandbox. No session reuse — each sandbox
    is a fresh Firecracker microVM.

    Auth: pass ``token`` explicitly, or set ``VERCEL_OIDC_TOKEN`` (auto-populated
    in Vercel-hosted deployments) or ``PHOENIX_SANDBOX_TOKEN`` in the environment
    and let app.py pass the resolved value here.
    """

    def __init__(
        self,
        token: str | None = None,
        runtime: str = "python3.13",
    ) -> None:
        self._token = token
        self._runtime = runtime

    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult:
        # avoids top-level import failure when vercel extra is not installed
        from vercel.sandbox import AsyncSandbox  # type: ignore[import-not-found]
        from vercel.sandbox.models import WriteFile  # type: ignore[import-not-found]

        # Vercel API takes timeout in milliseconds; Protocol uses seconds
        timeout_ms = int(timeout * 1000)

        sandbox = None
        try:
            sandbox = await AsyncSandbox.create(
                token=self._token,
                runtime=self._runtime,
                timeout=timeout_ms,
            )

            file_path = f"/tmp/eval_{uuid4().hex}.py"
            await sandbox.write_files([WriteFile(path=file_path, content=code.encode())])

            result = await sandbox.run_command("python", args=[file_path])

            stdout_parts: list[str] = []
            stderr_parts: list[str] = []
            async for log in result.logs():
                if log.stream == "stdout":
                    stdout_parts.append(log.data)
                else:
                    stderr_parts.append(log.data)

            return ExecutionResult(
                stdout="\n".join(stdout_parts),
                stderr="\n".join(stderr_parts),
                exit_code=result.exit_code,
            )
        except TimeoutError:
            return ExecutionResult(
                stdout="",
                stderr="",
                exit_code=1,
                timed_out=True,
            )
        except Exception as e:
            # Catch Vercel SDK exceptions (auth failures, sandbox errors, etc.)
            if type(e).__module__.startswith("vercel"):
                return ExecutionResult(
                    stdout="",
                    stderr=str(e),
                    exit_code=1,
                    error=e,
                )
            raise
        finally:
            if sandbox is not None:
                try:
                    await sandbox.stop()
                except Exception:
                    logger.debug("Failed to stop Vercel sandbox", exc_info=True)

    async def close(self) -> None:
        pass  # No persistent state to clean up


class VercelAdapter(SandboxAdapter):
    _key = "VERCEL"
    label = "Vercel"
    description = "Runs code evaluators in Vercel microVM sandboxes."
    python_packages = ["vercel"]
    env_vars = [
        EnvVarSpec(
            name="VERCEL_OIDC_TOKEN",
            required=False,
            description="Auto-populated in Vercel deployments",
        ),
        EnvVarSpec(
            name="PHOENIX_SANDBOX_VERCEL_TOKEN",
            required=False,
            description="Manual token for non-Vercel environments",
        ),
    ]
    config_fields = [
        ConfigFieldSpec(key="runtime", label="Runtime", placeholder="python3.13"),
    ]
    config_required = True
    setup_instructions = [
        "Set VERCEL_OIDC_TOKEN (auto in Vercel deployments) or PHOENIX_SANDBOX_VERCEL_TOKEN.",
        "pip install vercel",
    ]

    def create_backend(self, config: dict, credentials: dict) -> SandboxBackend:  # type: ignore[type-arg]
        token = credentials.get("VERCEL_OIDC_TOKEN") or credentials.get(
            "PHOENIX_SANDBOX_VERCEL_TOKEN"
        )
        return VercelSandboxBackend(
            token=token,
            runtime=config.get("runtime", "python3.13"),
        )
