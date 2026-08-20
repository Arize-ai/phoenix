"""Retry budget for online-eval work units, and the index predicate derived from it.

This module has no Phoenix imports so the schema (``models``), the queries
(``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

# Read by coordinator claims, producer recovery, session policy, session sweeping, session
# retention, and evaluator run counts; all six must agree.
MAX_ATTEMPTS = 3

SESSION_DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")

TERMINAL_EVAL_SESSION_WORK_STATUSES = (
    "DONE",
    "EXPIRED",
    *SESSION_DECLINED_STATUSES,
)

# Marks online evaluation's own annotations; also matched by the content-incomplete
# transition and reserved against clients at the annotation write boundary.
ONLINE_EVAL_IDENTIFIER_PREFIX = "online:"


def is_reserved_annotation_identifier(identifier: str) -> bool:
    """Whether `identifier` is one only online evaluation may write."""
    return identifier.startswith(ONLINE_EVAL_IDENTIFIER_PREFIX)


EVALUATOR_EVENT_KINDS = ("annotation_upserted",)

EVALUATION_TARGETS = ("SPAN", "TRACE", "SESSION")

# Stamped on session work units retired because their session lost content. Like the
# subsystem's other error markers it is read by operators and matched in tests, so it
# is spelled once here rather than at the deletion path that writes it.
SESSION_CONTENT_INCOMPLETE_ERROR = "session content incomplete"

SUPERSEDED_BY_REQUEST_ERROR = "superseded by evaluation request"


def live_eval_work_index_predicate() -> str:
    """SQL text selecting work units that still hold their dedup key.

    Postgres matches ``ON CONFLICT ... WHERE`` to a partial index by predicate
    equivalence, so the sweeper's conflict target, the model's index, and the
    migration that creates it must all spell this the same way. Changing
    ``MAX_ATTEMPTS`` changes the DDL: existing deployments need a new migration
    that rebuilds the index.
    """
    return f"status IN ('PENDING', 'RUNNING') OR status = 'ERROR' AND attempts < {MAX_ATTEMPTS}"


def live_eval_session_work_index_predicate() -> str:
    """SQL text selecting session work and decisions that hold their dedup key."""
    declined = ", ".join(f"'{status}'" for status in SESSION_DECLINED_STATUSES)
    return f"{live_eval_work_index_predicate()} OR status IN ({declined})"


def terminal_eval_session_work_index_predicate() -> str:
    """SQL text selecting session work whose history retention may reap."""
    terminal = ", ".join(f"'{status}'" for status in TERMINAL_EVAL_SESSION_WORK_STATUSES)
    return f"status IN ({terminal}) OR status = 'ERROR' AND attempts >= {MAX_ATTEMPTS}"


def evaluator_event_kind_check(column: str) -> str:
    """SQL text constraining ``column`` to ``EVALUATOR_EVENT_KINDS``."""
    kinds = ", ".join(f"'{kind}'" for kind in EVALUATOR_EVENT_KINDS)
    return f"{column} IN ({kinds})"


def evaluation_target_check(column: str) -> str:
    """SQL text constraining ``column`` to ``EVALUATION_TARGETS``."""
    targets = ", ".join(f"'{target}'" for target in EVALUATION_TARGETS)
    return f"{column} IN ({targets})"


def undrained_evaluator_event_predicate() -> str:
    """SQL text selecting events the drain has not acknowledged yet; the drain query, the
    model's index, and the migration that creates it must all spell it the same way."""
    return "acknowledged_at IS NULL"

