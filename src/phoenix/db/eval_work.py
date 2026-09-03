"""Work-unit status vocabulary and the schema predicates derived from it.

This module has no Phoenix imports so the schema (``models``), the queries
(``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

MAX_ATTEMPTS = 3

LIVE_EVAL_WORK_STATUSES = ("PENDING", "RUNNING", "ERROR")
TERMINAL_EVAL_WORK_STATUSES = ("DONE", "FAILED", "EXPIRED", "SUPERSEDED")
EVAL_WORK_STATUSES = (*LIVE_EVAL_WORK_STATUSES, *TERMINAL_EVAL_WORK_STATUSES)

SESSION_DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")
TERMINAL_EVAL_SESSION_WORK_STATUSES = (*TERMINAL_EVAL_WORK_STATUSES, "CONTENT_LOST")
EVAL_SESSION_WORK_STATUSES = (
    *LIVE_EVAL_WORK_STATUSES,
    *TERMINAL_EVAL_SESSION_WORK_STATUSES,
    *SESSION_DECLINED_STATUSES,
)

SESSION_CONTENT_INCOMPLETE_ERROR = "session content incomplete"


def _status_in(statuses: tuple[str, ...]) -> str:
    return "status IN (" + ", ".join(f"'{status}'" for status in statuses) + ")"


def eval_work_status_check() -> str:
    """CHECK constraint text for ``eval_work_units.status``."""
    return _status_in(EVAL_WORK_STATUSES)


def eval_session_work_status_check() -> str:
    """CHECK constraint text for ``eval_session_work_units.status``."""
    return _status_in(EVAL_SESSION_WORK_STATUSES)


def live_eval_work_index_predicate() -> str:
    """SQL text selecting work units that still hold their dedup key.

    Postgres matches ``ON CONFLICT ... WHERE`` to a partial index by predicate
    equivalence, so the sweeper's conflict target, the model's index, and the
    migration that creates it must all spell this the same way.
    """
    return _status_in(LIVE_EVAL_WORK_STATUSES)


def live_eval_session_work_index_predicate() -> str:
    """SQL text selecting session work and decisions that hold their dedup key."""
    return _status_in((*LIVE_EVAL_WORK_STATUSES, *SESSION_DECLINED_STATUSES))


def terminal_eval_work_index_predicate() -> str:
    """SQL text selecting span work that reached an outcome."""
    return _status_in(TERMINAL_EVAL_WORK_STATUSES)


def terminal_eval_session_work_index_predicate() -> str:
    """SQL text selecting session work that reached an outcome."""
    return _status_in(TERMINAL_EVAL_SESSION_WORK_STATUSES)
