"""Policy governing SESSION evaluation work: scheduling delays, schedulability, and
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

DEFAULT_SESSION_EVALUATION_DELAY_SECONDS = 300
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
class SessionSchedulabilityCondition:
    """One reason a SESSION project evaluator is unschedulable, in both languages that ask.

    ``blocks`` answers for a loaded row (the GraphQL field), ``blocks_sql`` for a
    query (the sweeper's evaluator load and the executor's hydration guard). They are
    written side by side because drift between them is silent: the UI would advertise
    an evaluator as schedulable that the sweeper never picks up.
    """

    reason: SchedulabilityReason
    blocks: Callable[["models.ProjectEvaluator"], bool]
    blocks_sql: Callable[[type["models.ProjectEvaluator"]], ColumnElement[bool]]


SESSION_SCHEDULABILITY_CONDITIONS: tuple[SessionSchedulabilityCondition, ...] = (
    SessionSchedulabilityCondition(
        reason=SchedulabilityReason.DISABLED,
        blocks=lambda record: not record.enabled,
        blocks_sql=lambda project_evaluator: not_(project_evaluator.enabled),
    ),
)


def session_schedulability_reason(
    record: "models.ProjectEvaluator",
) -> "SchedulabilityReason | None":
    for condition in SESSION_SCHEDULABILITY_CONDITIONS:
        if condition.blocks(record):
            return condition.reason
    return None


def session_project_evaluator_is_schedulable(
    project_evaluator: type["models.ProjectEvaluator"],
) -> ColumnElement[bool]:
    return and_(
        project_evaluator.evaluation_target == "SESSION",
        *(
            not_(condition.blocks_sql(project_evaluator))
            for condition in SESSION_SCHEDULABILITY_CONDITIONS
        ),
    )


@dataclass(frozen=True)
class SessionEvalPolicy:
    """What a session evaluation loads, and under which version of that rule.

    Both fields come from module constants and no deployment setting overrides
    them, so every process in a deployment runs the same policy and two replicas
    cannot disagree about what a session evaluation loads. Bumping ``version``
    is what expires pending session work, so old and new results never share an
    annotation identifier.
    """

    max_turns: int = MAX_SESSION_EVAL_TURNS
    version: str = SESSION_POLICY_VERSION

    @property
    def fingerprint(self) -> str:
        """Identity of the session policy in force, for the config fingerprint.

        Fixed for a given build, since both inputs are constants. It stays a
        derived hash rather than the version string because the config
        fingerprint keys on it, so a field that does vary can be added here
        without changing either end.
        """
        payload = {
            "policy_version": self.version,
            "max_turns": self.max_turns,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
