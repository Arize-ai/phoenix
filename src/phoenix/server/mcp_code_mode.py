from __future__ import annotations

import hashlib
import inspect
import logging
import time
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


def _code_fingerprint(code: str) -> str:
    """A stable log correlation key without repeating guest source at warning level."""
    return hashlib.sha256(code.encode()).hexdigest()[:12]


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
        self._consumer: MontyConsumer = consumer
        self._total_timeout = total_timeout

    def _instrument_external_functions(
        self, external_functions: Optional[dict[str, Callable[..., Any]]]
    ) -> Optional[dict[str, Callable[..., Any]]]:
        """Log sandbox-to-host calls without recording caller-controlled values."""
        if external_functions is None:
            return None
        instrumented = external_functions.copy()
        call_tool = instrumented.get("call_tool")
        if call_tool is None:
            return instrumented

        async def logged_call_tool(tool_name: str, params: dict[str, Any]) -> Any:
            # Debug mode is explicitly for inspecting submissions, including the
            # query or payload a guest sends through this callback. Warnings omit
            # values because they remain visible when debug logging is disabled.
            param_keys = sorted(params) if isinstance(params, dict) else None
            started = time.perf_counter()
            logger.debug(
                "MCP code-mode host callback submitted "
                "(consumer=%s, callback=call_tool, tool=%r, params=%r)",
                self._consumer,
                tool_name,
                params,
            )
            try:
                result = call_tool(tool_name, params)
                if inspect.isawaitable(result):
                    result = await result
            except Exception as exc:
                logger.warning(
                    "MCP code-mode host callback failed "
                    "(consumer=%s, callback=call_tool, tool=%r, param_keys=%s, "
                    "elapsed_ms=%.1f, error=%s: %s)",
                    self._consumer,
                    tool_name,
                    param_keys,
                    (time.perf_counter() - started) * 1000,
                    type(exc).__name__,
                    exc,
                )
                raise
            logger.debug(
                "MCP code-mode host callback completed "
                "(consumer=%s, callback=call_tool, tool=%r, param_keys=%s, "
                "elapsed_ms=%.1f, result_type=%s)",
                self._consumer,
                tool_name,
                param_keys,
                (time.perf_counter() - started) * 1000,
                type(result).__name__,
            )
            return result

        instrumented["call_tool"] = logged_call_tool
        return instrumented

    def _log_guest_failure(self, code: str, exc: Exception) -> None:
        """Record a marshalling-safe failure summary beside the debug source."""
        logger.warning(
            "MCP code-mode execute failed "
            "(consumer=%s, code_length=%d, code_sha256=%s, error=%s: %s)",
            self._consumer,
            len(code),
            _code_fingerprint(code),
            type(exc).__name__,
            exc,
        )

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
        # The sandbox protocol reports a guest exception after its host callback
        # has returned, so FastMCP's traceback identifies `execute` but not the
        # submitted program that triggered it. Keep the complete program in
        # debug logs, where it can be correlated with the following worker error.
        # It may contain caller data, so this must remain debug-only.
        logger.debug(
            "MCP code-mode execute submitted (consumer=%s, code=%r)",
            self._consumer,
            code,
        )
        instrumented_external_functions = self._instrument_external_functions(external_functions)
        try:
            return await self._runtime.run(
                code,
                consumer=self._consumer,
                limits=self.limits,
                inputs=inputs,
                external_functions=instrumented_external_functions,
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
                self._log_guest_failure(code, exc)
                raise
            logger.warning(
                "Monty rejected an exception payload with an invalid source span; "
                "returning a descriptive result instead."
            )
            return (
                "A tool call failed, but the sandbox could not transfer its error details. "
                "Retry the tool call with simpler code, or inspect the server logs."
            )
        except Exception as exc:
            self._log_guest_failure(code, exc)
            raise
