"""Policy governing SESSION evaluation work: scheduling delays, schedulability, and
the transcript assembly caps.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import Select

from phoenix.config import (
    get_env_online_eval_max_llm_message_bytes,
    get_env_online_eval_max_transcript_bytes,
)
from phoenix.db.eval_work import (
    MAX_ATTEMPTS,
    SESSION_CONTENT_INCOMPLETE_ERROR,
    SESSION_DECLINED_STATUSES,
    SUPERSEDED_BY_REQUEST_ERROR,
)
from phoenix.server.online_eval.derivation import STALE_FINGERPRINT_ERROR

if TYPE_CHECKING:
    from phoenix.db import models

DEFAULT_SESSION_EVALUATION_DELAY_SECONDS = 300
MINIMUM_EVALUATION_DELAY_SECONDS = 10

# What to do about an over-limit sandbox payload. Shared with the preview
# mutation so a preview run under the online limits reports the rejection in the
# same words the scheduled evaluation would.
ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION = (
    "Reduce the dominant evaluator source or mapped inputs, or raise the limit with "
    "PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
)

TRANSCRIPT_POLICY_VERSION = "2"
MAX_SESSION_EVAL_TURNS = 1_000


class SchedulabilityReason(Enum):
    """Why a project evaluator will never be picked up for scheduling."""

    DISABLED = "DISABLED"
    TRACE_TARGET_UNSUPPORTED = "TRACE_TARGET_UNSUPPORTED"
    # The row-side voice of exclude_criteria_targeting_evaluator_traces (db/helpers.py):
    # both sweep loads drop criteria on the evaluators project, so without this reason
    # such a criteria — possible when the project predates the reservation — would
    # advertise as schedulable while never running.
    TARGETS_EVALUATOR_TRACES = "TARGETS_EVALUATOR_TRACES"


@dataclass(frozen=True)
class SessionSchedulabilityCondition:
    """One reason a SESSION criteria is unschedulable, in both languages that ask.

    ``blocks`` answers for a loaded row (the GraphQL field), ``blocks_sql`` for a
    query (the sweeper's criteria load and the executor's hydration guard). They are
    written side by side because drift between them is silent: the UI would advertise
    an evaluator as schedulable that the sweeper never picks up.
    """

    reason: SchedulabilityReason
    blocks: Callable[["models.ProjectEvaluatorCriteria"], bool]
    blocks_sql: Callable[[type["models.ProjectEvaluatorCriteria"]], ColumnElement[bool]]


SESSION_SCHEDULABILITY_CONDITIONS: tuple[SessionSchedulabilityCondition, ...] = (
    SessionSchedulabilityCondition(
        reason=SchedulabilityReason.DISABLED,
        blocks=lambda record: not record.enabled,
        blocks_sql=lambda criteria: not_(criteria.enabled),
    ),
)


def session_schedulability_reason(
    record: "models.ProjectEvaluatorCriteria",
) -> "SchedulabilityReason | None":
    """The first condition blocking this SESSION criteria, or None if schedulable."""
    for condition in SESSION_SCHEDULABILITY_CONDITIONS:
        if condition.blocks(record):
            return condition.reason
    return None


def session_criteria_is_schedulable(
    criteria: type["models.ProjectEvaluatorCriteria"],
) -> ColumnElement[bool]:
    return and_(
        # Kept out of SESSION_SCHEDULABILITY_CONDITIONS: a row-side twin would mark SPAN
        # criteria unschedulable too.
        criteria.evaluation_target == "SESSION",
        *(not_(condition.blocks_sql(criteria)) for condition in SESSION_SCHEDULABILITY_CONDITIONS),
    )


def session_matches_criteria_filter(
    filter_condition: str,
    project_id: int,
) -> ColumnElement[bool]:
    """Whether a session passes a criteria's own filter, as one predicate on the session."""
    from phoenix.db import models
    from phoenix.server.session_filters import get_filtered_session_rowids_subquery

    return models.ProjectSession.id.in_(
        get_filtered_session_rowids_subquery(filter_condition, [project_id])
    )


def session_work_may_still_produce_a_result(work: Any) -> ColumnElement[bool]:
    """Whether ``work`` can still reach an outcome, so a newer ask waits behind it."""
    return or_(
        work.status.in_(("PENDING", "RUNNING")),
        and_(work.status == "ERROR", work.attempts < MAX_ATTEMPTS),
    )


def session_work_answers_request(work: Any) -> ColumnElement[bool]:
    """Whether ``work`` reached an outcome that can answer a trigger request."""
    unevaluated_expiry_errors = (
        STALE_FINGERPRINT_ERROR,
        SESSION_CONTENT_INCOMPLETE_ERROR,
        SUPERSEDED_BY_REQUEST_ERROR,
    )
    return or_(
        work.status == "DONE",
        and_(work.status == "ERROR", work.attempts >= MAX_ATTEMPTS),
        and_(
            work.status == "EXPIRED",
            or_(
                work.error.is_(None),
                work.error.not_in(unevaluated_expiry_errors),
            ),
        ),
    )


def session_work_records_background_decision(work: Any) -> ColumnElement[bool]:
    """Whether ``work`` is terminal evidence for background scheduling."""
    return or_(
        work.status == "DONE",
        work.status.in_(SESSION_DECLINED_STATUSES),
        and_(
            work.status == "EXPIRED",
            or_(work.error.is_(None), work.error != STALE_FINGERPRINT_ERROR),
        ),
        and_(work.status == "ERROR", work.attempts >= MAX_ATTEMPTS),
    )


def admitted_session_work_count_statement(max_outstanding: int) -> "Select[Any]":
    """How much session work is already admitted, counted no further than the cap."""
    from phoenix.db import models

    admitted = (
        select(1)
        .select_from(models.EvalSessionWorkUnit)
        .where(session_work_may_still_produce_a_result(models.EvalSessionWorkUnit))
        .limit(max_outstanding)
        .subquery()
    )
    return select(func.count()).select_from(admitted)


@dataclass(frozen=True)
class SessionTranscriptPolicy:
    """The caps that decide what text a session evaluation actually reads.

    Every field enters the config fingerprint, so results published under one
    annotation identifier are comparable to each other. That only holds while the
    fingerprint and the assembly it describes read the same values, which is why the
    environment is read once, here: a materializer that fingerprinted one cap while an
    executor assembled under another would agree only by accident, and the mismatch
    would surface as expired work rather than as a configuration error.
    """

    max_transcript_bytes: int
    max_llm_message_bytes: int
    max_turns: int = MAX_SESSION_EVAL_TURNS
    version: str = TRANSCRIPT_POLICY_VERSION

    @classmethod
    def from_env(cls) -> SessionTranscriptPolicy:
        return cls(
            max_transcript_bytes=get_env_online_eval_max_transcript_bytes(),
            max_llm_message_bytes=get_env_online_eval_max_llm_message_bytes(),
        )

    @property
    def fingerprint(self) -> str:
        """Identity of the transcript policy in force, for the config fingerprint."""
        payload = {
            "policy_version": self.version,
            "max_transcript_bytes": self.max_transcript_bytes,
            "max_turns": self.max_turns,
            "max_llm_message_bytes": self.max_llm_message_bytes,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
