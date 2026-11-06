"""A project evaluator's one status, from its own evaluations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from phoenix.server.online_eval.current_queue import ProjectEvaluatorQueue, waited_too_long

ProjectEvaluatorRunStatus = Literal[
    "DISABLED", "ERROR", "DEGRADED", "HEALTHY", "STARTING", "NEVER_RUN"
]


def project_evaluator_run_status(
    *,
    enabled: bool,
    last_evaluated_at: Optional[datetime],
    last_failed_at: Optional[datetime],
    queued: ProjectEvaluatorQueue,
    now: datetime,
) -> ProjectEvaluatorRunStatus:
    """A project evaluator's one status, from its own work only, by precedence:
    DISABLED > ERROR > DEGRADED > HEALTHY > STARTING > NEVER_RUN.

    Its own oldest waiting or retrying evaluation degrades it. The queue's status is not an
    input: the queue is shared, so it would mark every evaluator of every project alike,
    including ones with nothing queued.
    """
    if not enabled:
        return "DISABLED"
    if last_failed_at is not None and (
        last_evaluated_at is None or last_failed_at >= last_evaluated_at
    ):
        return "ERROR"
    if waited_too_long(queued.oldest_waiting_or_retrying_at, now):
        return "DEGRADED"
    if last_evaluated_at is not None:
        return "HEALTHY"
    if queued.queued_count:
        return "STARTING"
    return "NEVER_RUN"
