"""
Vercel sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call creates a fresh
AsyncSandbox and tears it down on completion.

Requires the ``vercel`` extra (``vercel>=0.5.1``).
Import is deferred to avoid top-level failures when the extra is absent.

Language routing
----------------
- PYTHON  → runtime="python3.13", run_command("python3", ["-c", code])
- TYPESCRIPT → runtime="node24", run_command("node", ["--input-type=module", "-e", code])

The language key is read from the config dict (key ``"language"``).
Defaults to TYPESCRIPT for backwards compatibility.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from phoenix.config import ENV_PHOENIX_SANDBOX_API_KEY

from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language → runtime + command mapping
# ---------------------------------------------------------------------------

_LANGUAGE_CONFIGS: dict[str, dict[str, Any]] = {
    "PYTHON": {
        "runtime": "python3.13",
        "cmd": "python3",
        "args_prefix": ["-c"],
    },
    "TYPESCRIPT": {
        "runtime": "node24",
        "cmd": "node",
        "args_prefix": ["--input-type=module", "-e"],
    },
}
_DEFAULT_LANGUAGE = "TYPESCRIPT"


class VercelSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing code via Vercel Sandbox (vercel >= 0.5.1)."""

    def __init__(self, token: str, language: str = _DEFAULT_LANGUAGE) -> None:
        self._token = token
        self._language = language.upper() if language else _DEFAULT_LANGUAGE

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        from vercel.sandbox import AsyncSandbox  # type: ignore[import-not-found]

        lang_cfg = _LANGUAGE_CONFIGS.get(self._language, _LANGUAGE_CONFIGS[_DEFAULT_LANGUAGE])
        runtime: str = lang_cfg["runtime"]
        cmd: str = lang_cfg["cmd"]
        args: list[str] = lang_cfg["args_prefix"] + [code]

        create_kwargs: dict[str, Any] = {"runtime": runtime, "token": self._token}
        if env:
            create_kwargs["env"] = env
        if timeout is not None:
            create_kwargs["timeout"] = timeout

        try:
            async with await AsyncSandbox.create(**create_kwargs) as sandbox:
                result = await sandbox.run_command(cmd, args)
                stdout = await result.stdout() or ""
                stderr = await result.stderr() or ""
                exit_code = result.exit_code
                error = stderr if exit_code != 0 else None
                return ExecutionResult(stdout=stdout, stderr=stderr, error=error)
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        pass


class VercelAdapter(SandboxAdapter):
    key = "VERCEL"
    display_name = "Vercel Sandbox"
    supported_languages = ["PYTHON", "TYPESCRIPT"]

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        token: str = (
            config.get("PHOENIX_SANDBOX_VERCEL_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_VERCEL_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_API_KEY)
            or ""
        )
        language: str = config.get("language", _DEFAULT_LANGUAGE)
        return VercelSandboxBackend(token=token, language=language)
