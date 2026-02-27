from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    error: Exception | None = None
    timed_out: bool = False


class UnsupportedOperation(Exception):
    """Raised by backends that don't support a given operation (e.g. Monty + install)."""


class SandboxBackend(Protocol):
    async def execute(self, code: str, timeout: float = 30.0) -> ExecutionResult: ...
    async def install(self, packages: list[str]) -> None: ...
    async def close(self) -> None: ...
