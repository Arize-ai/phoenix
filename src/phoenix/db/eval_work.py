"""Work-unit status vocabulary and the schema predicates derived from it.

This module imports nothing from Phoenix at runtime so the schema (``models``), the
queries (``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from phoenix.db.models import EvalSessionWorkStatus

MAX_ATTEMPTS = 3

LIVE_EVAL_WORK_STATUSES = ("PENDING", "RUNNING", "ERROR")
TERMINAL_EVAL_WORK_STATUSES = ("DONE", "FAILED", "EXPIRED")
# Given up on: the terminal statuses the user is owed an error for.
FAILED_EVAL_WORK_STATUSES = ("FAILED", "EXPIRED")
EVAL_WORK_STATUSES = (*LIVE_EVAL_WORK_STATUSES, *TERMINAL_EVAL_WORK_STATUSES)

SESSION_DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")
# Session and trace work that ended without a result is offered again once its entity has
# newer activity. DONE and declined rows are final.
SESSION_REOFFERED_STATUSES: tuple[EvalSessionWorkStatus, ...] = (
    "FAILED",
    "EXPIRED",
    "CONTENT_LOST",
)
TERMINAL_EVAL_SESSION_WORK_STATUSES = (*TERMINAL_EVAL_WORK_STATUSES, "CONTENT_LOST")
EVAL_SESSION_WORK_STATUSES = (
    *LIVE_EVAL_WORK_STATUSES,
    *TERMINAL_EVAL_SESSION_WORK_STATUSES,
    *SESSION_DECLINED_STATUSES,
)


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


def terminal_eval_work_index_predicate() -> str:
    """SQL text selecting span work that reached an outcome."""
    return _status_in(TERMINAL_EVAL_WORK_STATUSES)


def terminal_eval_session_work_index_predicate() -> str:
    """SQL text selecting session work that reached an outcome."""
    return _status_in(TERMINAL_EVAL_SESSION_WORK_STATUSES)


def failed_eval_work_index_predicate() -> str:
    """SQL text selecting work that was given up on, for every evaluation target."""
    return _status_in(FAILED_EVAL_WORK_STATUSES)
