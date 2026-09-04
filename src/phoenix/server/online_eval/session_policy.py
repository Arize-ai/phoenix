"""Policy governing scheduled evaluation work: scheduling delays, schedulability, and
the turn cap on what a session evaluation loads.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Callable

from sqlalchemy import and_, not_
from sqlalchemy.sql.elements import ColumnElement

if TYPE_CHECKING:
    from phoenix.db import models

DEFAULT_EVALUATION_DELAY_SECONDS = 300
MINIMUM_EVALUATION_DELAY_SECONDS = 10

# What to do about an over-limit sandbox payload. Shared with the preview
# mutation so a preview run under the online limits reports the rejection in the
# same words the scheduled evaluation would.
ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION = (
    "Narrow the slot with a path mapping, reduce the evaluator source, or raise the "
    "limit with PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
)

SESSION_POLICY_VERSION = "3"
MAX_SESSION_EVAL_TURNS = 1_000


class SchedulabilityReason(Enum):
    """Why a project evaluator will never be picked up for scheduling."""

    DISABLED = "DISABLED"
    TRACE_TARGET_UNSUPPORTED = "TRACE_TARGET_UNSUPPORTED"


@dataclass(frozen=True)
class SchedulabilityCondition:
    """One reason a project evaluator is unschedulable, in both languages that ask.

    ``blocks`` answers for a loaded row (the GraphQL field), ``blocks_sql`` for a
    query (the sweeper's evaluator load and the executor's hydration guard). They are
    written side by side because drift between them is silent: the UI would advertise
    an evaluator as schedulable that the sweeper never picks up.
    """

    reason: SchedulabilityReason
    blocks: Callable[["models.ProjectEvaluator"], bool]
    blocks_sql: Callable[[type["models.ProjectEvaluator"]], ColumnElement[bool]]


SCHEDULABILITY_CONDITIONS: tuple[SchedulabilityCondition, ...] = (
    SchedulabilityCondition(
        reason=SchedulabilityReason.DISABLED,
        blocks=lambda record: not record.enabled,
        blocks_sql=lambda project_evaluator: not_(project_evaluator.enabled),
    ),
)


def schedulability_reason(
    record: "models.ProjectEvaluator",
) -> "SchedulabilityReason | None":
    for condition in SCHEDULABILITY_CONDITIONS:
        if condition.blocks(record):
            return condition.reason
    return None


def project_evaluator_is_schedulable(
    project_evaluator: type["models.ProjectEvaluator"],
    *,
    evaluation_target: "models.EvaluationTarget",
) -> ColumnElement[bool]:
    """The ``blocks_sql`` side of every condition, for one evaluation target."""
    return and_(
        project_evaluator.evaluation_target == evaluation_target,
        *(not_(condition.blocks_sql(project_evaluator)) for condition in SCHEDULABILITY_CONDITIONS),
    )


def session_policy_fingerprint() -> str:
    """Identity of the session policy in force, for the config fingerprint.

    Bumping ``SESSION_POLICY_VERSION`` is what expires pending session work, so
    old and new results never share an annotation identifier.
    """
    payload = {
        "policy_version": SESSION_POLICY_VERSION,
        "max_turns": MAX_SESSION_EVAL_TURNS,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
