"""Local restricted-Python sandbox backend powered by Monty."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Mapping, Optional

if TYPE_CHECKING:
    from pydantic_monty import ResourceLimits

from phoenix.server.monty_runtime import (
    DEFAULT_GUEST_MAX_MEMORY_BYTES,
    DEFAULT_GUEST_MAX_RECURSION_DEPTH,
    MontyRuntime,
    MontyServiceError,
)

from .result_protocol import append_framed_result
from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    MontyConfig,
    MontyDeployment,
    NoCredentials,
    SandboxAdapter,
    SandboxBackend,
    SandboxRuntimeContext,
    SandboxValidationUnavailable,
    compose_secret_values,
)

_DEFAULT_TIMEOUT_SECONDS = 30
_VALIDATION_TIMEOUT_SECONDS = 0.05
DEFAULT_STREAM_OUTPUT_BYTES = 1024 * 1024
DEFAULT_RESULT_BYTES = 1024 * 1024


class _BoundedTextSink:
    """Retain the most recent UTF-8 output without unbounded host memory growth."""

    def __init__(self, limit: int = DEFAULT_STREAM_OUTPUT_BYTES) -> None:
        if limit < 1:
            raise ValueError("Output limit must be positive")
        self._limit = limit
        self._buffer = bytearray()
        self._dropped = 0

    def write(self, text: str) -> None:
        data = text.encode("utf-8")
        if len(data) >= self._limit:
            self._dropped += len(self._buffer) + len(data) - self._limit
            self._buffer = bytearray(data[-self._limit :])
            return
        retained_before_append = self._limit - len(data)
        excess = len(self._buffer) - retained_before_append
        if excess > 0:
            del self._buffer[:excess]
            self._dropped += excess
        self._buffer.extend(data)

    def getvalue(self) -> str:
        value = self._buffer.decode("utf-8", errors="replace")
        if self._dropped:
            return f"[output truncated: {self._dropped} earlier bytes dropped]\n{value}"
        return value


def _resource_limits(max_duration_secs: float) -> "ResourceLimits":
    return {
        "max_duration_secs": max_duration_secs,
        "max_memory": DEFAULT_GUEST_MAX_MEMORY_BYTES,
        "max_recursion_depth": DEFAULT_GUEST_MAX_RECURSION_DEPTH,
    }


def _discard_output(stream: str, text: str) -> None:
    del stream, text


class MontySandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing restricted Python in worker subprocesses."""

    provider = "MONTY"

    def __init__(self, runtime: MontyRuntime) -> None:
        self._runtime = runtime
        self.secret_values = compose_secret_values(None)

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        return await self._execute(code, session_key=session_key, timeout=timeout, inputs=None)

    async def execute_with_inputs(
        self,
        code: str,
        session_key: str,
        *,
        inputs: dict[str, Any],
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        return await self._execute(code, session_key=session_key, timeout=timeout, inputs=inputs)

    async def _execute(
        self,
        code: str,
        *,
        session_key: str,
        timeout: Optional[int],
        inputs: Optional[dict[str, Any]],
    ) -> ExecutionResult:
        del session_key
        execution_timeout = timeout if timeout is not None else _DEFAULT_TIMEOUT_SECONDS
        stdout = _BoundedTextSink()
        stderr = _BoundedTextSink()

        def capture_output(stream: str, text: str) -> None:
            (stderr if stream == "stderr" else stdout).write(text)

        try:
            result = await self._runtime.run(
                code,
                consumer="evaluator",
                limits=_resource_limits(float(execution_timeout)),
                inputs=inputs,
                print_callback=capture_output,
            )
            serialized = json.dumps(result)
            if len(serialized.encode("utf-8")) > DEFAULT_RESULT_BYTES:
                raise ValueError(
                    f"Monty result exceeded the {DEFAULT_RESULT_BYTES}-byte output limit"
                )
            return ExecutionResult(
                stdout=append_framed_result(stdout.getvalue(), serialized),
                stderr=stderr.getvalue(),
            )
        except MontyServiceError:
            raise
        except Exception as exc:
            message = str(exc)
            return ExecutionResult(
                stdout=stdout.getvalue(),
                stderr=stderr.getvalue() or message,
                error=message,
            )

    async def close(self) -> None:
        pass


class MontyAdapter(SandboxAdapter[MontyConfig, NoCredentials, MontyDeployment]):
    backend_type = "MONTY"
    display_name = "Monty"
    hosting_type = "local"
    language_dialect = "restricted"
    runtime_notes = (
        "Restricted Python running in isolated worker subprocesses. A limited standard library "
        "is importable, while filesystem, network, environment, subprocess, and third-party "
        "package access are blocked."
    )
    config_model = MontyConfig
    credentials_model = NoCredentials
    deployment_config_model = MontyDeployment

    async def validate_code(
        self,
        config: MontyConfig,
        code: str,
        *,
        runtime: Optional[SandboxRuntimeContext] = None,
    ) -> Optional[str]:
        del config
        if runtime is None:
            return None
        try:
            await runtime.monty.run(
                code,
                consumer="validation",
                limits=_resource_limits(_VALIDATION_TIMEOUT_SECONDS),
                print_callback=_discard_output,
                total_timeout=1.0,
            )
        except MontyServiceError as exc:
            raise SandboxValidationUnavailable(
                "The Monty runtime could not validate this code; retry shortly."
            ) from exc
        except Exception as exc:
            return str(exc)
        return None

    def build_backend(
        self,
        config: MontyConfig,
        *,
        credentials: NoCredentials,
        deployment: MontyDeployment,
        user_env: Optional[Mapping[str, str]] = None,
        runtime: Optional[SandboxRuntimeContext] = None,
    ) -> SandboxBackend:
        del config, credentials, deployment
        if user_env:
            raise ValueError("Monty sandboxes do not support user-supplied environment variables.")
        if runtime is None:
            raise ValueError("Monty runtime is unavailable")
        return MontySandboxBackend(runtime.monty)
