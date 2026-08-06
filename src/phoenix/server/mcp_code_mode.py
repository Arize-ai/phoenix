from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Callable, Optional

from fastmcp.exceptions import ToolError

from phoenix.server.monty_runtime import (
    DEFAULT_GUEST_MAX_MEMORY_BYTES,
    DEFAULT_GUEST_MAX_RECURSION_DEPTH,
    MontyBusy,
    MontyConsumer,
    MontyDeadlineExceeded,
    MontyRuntime,
    MontyShuttingDown,
    MontyUnavailable,
    MontyWorkerCrashed,
    MontyWorkerTurnTimedOut,
)

if TYPE_CHECKING:
    from pydantic_monty import ResourceLimits

logger = logging.getLogger(__name__)


DEFAULT_LIMITS: "ResourceLimits" = {
    "max_duration_secs": 30.0,
    "max_memory": DEFAULT_GUEST_MAX_MEMORY_BYTES,
    "max_recursion_depth": DEFAULT_GUEST_MAX_RECURSION_DEPTH,
}
"""Per-session guest limits. ``max_duration_secs`` charges guest execution only,
not time awaiting a host callback."""

DEFAULT_TOTAL_TIMEOUT = 300.0
"""End-to-end ceiling for one ``execute``, host callbacks and pool startup
included. Immediate for a block awaiting a tool; a block already executing runs
on to its guest limit."""


def _discard_output(stream: str, text: str) -> None:
    """Discard guest prints so they cannot flood Phoenix process output."""
    del stream, text


class MontyPoolSandboxProvider:
    """FastMCP adapter for the server's shared Monty worker runtime.

    Each ``run`` checks out its own session, so no guest state survives into
    another ``execute``.

    Args:
        runtime: Application-owned shared runtime.
        consumer: Admission class this provider spends against. Each surface
            takes its own so neither can exhaust the pool on the other's behalf.
        limits: Per-session guest limits. Defaults to :data:`DEFAULT_LIMITS`.
        total_timeout: End-to-end deadline for one ``execute``; prompt for a block
            awaiting a tool, but one already executing runs on to its guest
            limit. ``None`` removes it.
    """

    def __init__(
        self,
        *,
        runtime: MontyRuntime,
        consumer: MontyConsumer = "mcp",
        limits: Optional["ResourceLimits"] = None,
        total_timeout: Optional[float] = DEFAULT_TOTAL_TIMEOUT,
    ) -> None:
        # Copied so neither a caller's dict nor DEFAULT_LIMITS is mutable through
        # this attribute.
        self.limits: "ResourceLimits" = (DEFAULT_LIMITS if limits is None else limits).copy()
        self._runtime = runtime
        self._consumer = consumer
        self._total_timeout = total_timeout

    async def run(
        self,
        code: str,
        *,
        inputs: Optional[dict[str, Any]] = None,
        external_functions: Optional[dict[str, Callable[..., Any]]] = None,
    ) -> Any:
        """Execute one code-mode block and return its result.

        Guest errors propagate unchanged so the model can correct its own code;
        sandbox failures become :class:`ToolError`.
        """
        try:
            return await self._runtime.run(
                code,
                consumer=self._consumer,
                limits=self.limits,
                inputs=inputs,
                external_functions=external_functions,
                print_callback=_discard_output,
                total_timeout=self._total_timeout,
            )
        except MontyBusy as exc:
            logger.warning("Code-mode sandbox saturated; no worker free within checkout timeout.")
            raise ToolError(
                "The sandbox is busy running other execute calls and no capacity became "
                "available. Retry shortly."
            ) from exc
        except MontyDeadlineExceeded as exc:
            logger.warning(
                "Code-mode execute exceeded the total timeout of %.0fs.", self._total_timeout
            )
            raise ToolError(
                f"Execution exceeded the {self._total_timeout:.0f}s limit for a single execute "
                "call, counting the time its tool calls took. Split the work across multiple "
                "calls, or reduce the number of tool calls in this block."
            ) from exc
        except MontyWorkerTurnTimedOut as exc:
            logger.warning("Code-mode worker exceeded the turn timeout; worker killed.")
            raise ToolError(
                f"The sandbox stopped responding for {self._runtime.request_timeout:.0f}s and "
                "was terminated, so no result was produced. Retry, and split the work across "
                "multiple calls if it persists."
            ) from exc
        except MontyWorkerCrashed as exc:
            logger.warning(
                "Code-mode worker died during execution (exit_status=%s).", exc.exit_status
            )
            raise ToolError(
                "The sandbox process terminated while running this code, so no result was "
                "produced. This is typically caused by code that exhausts memory or nests "
                "data structures very deeply. The server is unaffected; adjust the code and "
                "retry."
            ) from exc
        except MontyUnavailable as exc:
            logger.exception("Failed to start the code-mode sandbox pool.")
            raise ToolError(
                "The code-mode sandbox could not be started, so no code can run. This is a "
                "server configuration problem; check the Phoenix logs."
            ) from exc
        except MontyShuttingDown as exc:
            raise ToolError("Code mode sandbox is shutting down.") from exc
        except RuntimeError as exc:
            # Work around Monty #631, which discards some multi-line exception payloads.
            # https://github.com/pydantic/monty/issues/631
            if not str(exc).startswith("monty worker protocol error: invalid exception payload"):
                raise
            logger.warning(
                "Monty rejected an exception payload with an invalid source span; "
                "returning a descriptive result instead."
            )
            return (
                "A tool call failed, but the sandbox could not transfer its error details. "
                "Retry the tool call with simpler code, or inspect the server logs."
            )
