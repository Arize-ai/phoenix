"""
just-bash: A pure Python bash interpreter with in-memory virtual filesystem.

Designed for AI agents needing a secure, sandboxed bash environment.

Example usage:
    from just_bash import Bash

    bash = Bash()
    result = await bash.exec("echo hello world")
    print(result.stdout)  # "hello world\\n"
"""

from .bash import Bash
from .types import (
    AllowedUrl,
    ExecResult,
    BashExecResult,
    ExecutionLimits,
    NetworkConfig,
    IFileSystem,
    FsStat,
    CommandContext,
    Command,
    OK,
    FAIL,
    RequestTransform,
    SecureFetch,
)
from .fs import InMemoryFs
from .parser import Parser, parse, ParseException

__version__ = "0.1.0"

__all__ = [
    # Main API
    "Bash",
    # Core types
    "ExecResult",
    "BashExecResult",
    "ExecutionLimits",
    "NetworkConfig",
    "AllowedUrl",
    "RequestTransform",
    "SecureFetch",
    "IFileSystem",
    "FsStat",
    "CommandContext",
    "Command",
    # Filesystem
    "InMemoryFs",
    # Parser
    "Parser",
    "parse",
    "ParseException",
    # Constants
    "OK",
    "FAIL",
    # Version
    "__version__",
]
