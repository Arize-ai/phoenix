"""Each evaluation target's admission cap: how many evaluations it holds queued (PENDING,
RUNNING, or ERROR). New evaluations that do not fit under the cap are dropped, not queued.

The span producer and the trace and session sweepers enforce their caps from here, and
queue health reads the same values to report a target at capacity.
"""

from __future__ import annotations

from phoenix.config import (
    get_env_online_eval_max_outstanding,
    get_env_online_eval_max_session_outstanding,
    get_env_online_eval_max_trace_outstanding,
)
from phoenix.db import models


def max_queued(evaluation_target: models.EvaluationTarget) -> int:
    if evaluation_target == "SPAN":
        return get_env_online_eval_max_outstanding()
    if evaluation_target == "SESSION":
        return get_env_online_eval_max_session_outstanding()
    return get_env_online_eval_max_trace_outstanding()
