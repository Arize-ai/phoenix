"""What a failed online evaluation costs the work unit that produced it.

An evaluator author decides retry behaviour by declaring ``online_eval_disposition`` on
the exception they raise; everything not declared falls to a transient-error heuristic
that fails safe by counting the attempt. ``classify`` is the only place that answer is
computed, so an author can read the whole contract at once instead of discovering it
from the consumer's behaviour.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Optional

import httpx

if TYPE_CHECKING:
    from phoenix.server.online_eval.executor import HydratedWorkUnit

_TRANSIENT_HTTP_STATUS_CODES = frozenset({408, 429})


@dataclass(frozen=True)
class FailureDisposition:
    """How one failure is charged.

    ``count_attempt`` walks the unit toward the max-attempts bar; ``terminal`` gives up
    now, recording EXPIRED rather than a retryable ERROR. ``code`` is the stable,
    machine-readable reason, and ``error`` is what lands on the row — filled in from the
    raised exception by ``describing``, so classes can declare the policy alone.
    """

    count_attempt: bool
    terminal: bool = False
    code: Optional[str] = None
    error: str = ""

    def describing(self, exc: BaseException) -> FailureDisposition:
        detail = str(exc)
        if self.code and not detail.startswith(f"{self.code}:"):
            detail = f"{self.code}: {detail}"
        return replace(self, error=detail)


def classify(
    exc: BaseException,
    hydrated: Optional[HydratedWorkUnit] = None,
) -> FailureDisposition:
    """Decide what a failure costs, in the one priority order that applies.

    A declared terminal disposition wins wherever it appears in the chain: giving up is
    a statement about the work itself, not about the layer that noticed. Otherwise the
    outermost declared disposition wins, because the code closest to the failure is the
    code that understood it. With nothing declared, an unrecognized failure counts an
    attempt so poison units stay bounded — a provider outage is only exempted when it is
    recognizable as one.
    """
    declared = [
        (node, disposition)
        for node in _exception_chain(exc)
        if isinstance(
            disposition := getattr(node, "online_eval_disposition", None),
            FailureDisposition,
        )
    ]
    for node, disposition in declared:
        if disposition.terminal:
            return disposition.describing(node)
    if declared:
        node, disposition = declared[0]
        return disposition.describing(node)
    transient = _is_provider_transient_error(hydrated, exc) or is_transient_error(exc)
    return FailureDisposition(count_attempt=not transient).describing(exc)


def is_transient_error(exc: BaseException) -> bool:
    """Best-effort classification of failures that heal on their own —
    provider outages, rate limits, network partitions. Transient failures
    retry after a flat cooldown WITHOUT counting toward MAX_ATTEMPTS, so an
    outage longer than the retry budget cannot permanently exhaust queued
    work. Anything unrecognized counts attempts as usual, which keeps poison
    units bounded (fail-safe default). Walks the exception chain so wrapped
    errors (e.g. ``EvalExecutionError`` raised from an httpx timeout)
    classify by their root cause."""
    for node in _exception_chain(exc):
        # asyncio.TimeoutError is an alias of TimeoutError on 3.11+ but a
        # distinct class on 3.10.
        if isinstance(node, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
            return True
        if isinstance(node, httpx.TransportError):
            return True
        # Provider SDK errors (openai, anthropic, ...) expose status_code
        # directly; httpx.HTTPStatusError exposes it via .response.
        status_code = getattr(node, "status_code", None)
        if status_code is None:
            status_code = getattr(getattr(node, "response", None), "status_code", None)
        if isinstance(status_code, int) and (
            status_code >= 500 or status_code in _TRANSIENT_HTTP_STATUS_CODES
        ):
            return True
    return False


def _is_provider_transient_error(
    hydrated: Optional[HydratedWorkUnit],
    exc: BaseException,
) -> bool:
    """Ask the provider's own client, which knows its throttling better than we do."""
    if hydrated is None or hydrated.evaluator_kind != "LLM":
        return False
    llm_client = getattr(hydrated.evaluator, "llm_client", None)
    if llm_client is None:
        return False
    for node in _exception_chain(exc):
        if not isinstance(node, Exception):
            continue
        try:
            if llm_client.is_rate_limit_error(node) or llm_client.is_transient_error(node):
                return True
        except Exception:
            continue
    return False


def _exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    seen: set[int] = set()
    node: Optional[BaseException] = exc
    while node is not None and id(node) not in seen:
        seen.add(id(node))
        chain.append(node)
        if node.__cause__ is not None:
            node = node.__cause__
        elif node.__suppress_context__:
            node = None
        else:
            node = node.__context__
    return chain
