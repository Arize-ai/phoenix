"""Local restricted-Python sandbox backend powered by Monty."""

from __future__ import annotations

import asyncio
import json
from functools import lru_cache
from typing import Mapping, Optional

from pydantic_monty import Monty

from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    MontyConfig,
    MontyDeployment,
    NoCredentials,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
)

_DEFAULT_TIMEOUT_SECONDS = 30
_VALIDATION_TIMEOUT_SECONDS = 0.05
_PHOENIX_RESULT_BEGIN = "===PHOENIX_RESULT_BEGIN==="
_PHOENIX_RESULT_END = "===PHOENIX_RESULT_END==="


@lru_cache(maxsize=128)
def _compile(code: str) -> Monty:
    return Monty(code)


def _run(code: str, timeout: float) -> ExecutionResult:
    output: list[str] = []

    def capture_output(stream: str, text: str) -> None:
        del stream
        output.append(text)

    try:
        result = _compile(code).run(
            limits={"max_duration_secs": timeout},
            print_callback=capture_output,
        )
        stdout = "".join(output)
        serialized = json.dumps(result)
        stdout += f"{_PHOENIX_RESULT_BEGIN}\n{serialized}\n{_PHOENIX_RESULT_END}\n"
        return ExecutionResult(stdout=stdout, stderr="")
    except Exception as exc:
        message = str(exc)
        return ExecutionResult(stdout="".join(output), stderr=message, error=message)


class MontySandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing restricted Python in-process with Monty."""

    provider = "MONTY"

    def __init__(self) -> None:
        self.secret_values = compose_secret_values(None)

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        del session_key
        execution_timeout = timeout if timeout is not None else _DEFAULT_TIMEOUT_SECONDS
        return await asyncio.to_thread(_run, code, float(execution_timeout))

    async def close(self) -> None:
        pass


class MontyAdapter(SandboxAdapter[MontyConfig, NoCredentials, MontyDeployment]):
    backend_type = "MONTY"
    display_name = "Monty"
    hosting_type = "local"
    language_dialect = "restricted"
    runtime_notes = (
        "Restricted Python with a limited standard library and no filesystem, "
        "network, environment, class definitions, context managers, or generator functions."
    )
    config_model = MontyConfig
    credentials_model = NoCredentials
    deployment_config_model = MontyDeployment

    def validate_code(self, config: MontyConfig, code: str) -> Optional[str]:
        del config
        result = _run(code, _VALIDATION_TIMEOUT_SECONDS)
        return result.error

    def build_backend(
        self,
        config: MontyConfig,
        *,
        credentials: NoCredentials,
        deployment: MontyDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        del config, credentials, deployment
        if user_env:
            raise ValueError("Monty sandboxes do not support user-supplied environment variables.")
        return MontySandboxBackend()
