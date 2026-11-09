"""Work-unit status vocabulary and the schema predicates derived from it.

This module imports nothing from Phoenix at runtime so the schema (``models``), the
queries (``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from phoenix.db.models import SweptTargetWorkStatus

MAX_ATTEMPTS = 3

# Every target:
# In queue: waiting (PENDING), running (RUNNING), or retrying after an error (ERROR).
QUEUED_STATUSES = ("PENDING", "RUNNING", "ERROR")
# Finished. DROPPED: cleared from the queue before it ran.
TERMINAL_STATUSES = ("DONE", "FAILED", "EXPIRED", "DROPPED")
# Given up on: the finished statuses the user is owed an error for.
FAILED_STATUSES = ("FAILED", "EXPIRED")
# Evaluated or given up on.
COMPLETED_STATUSES = ("DONE", *FAILED_STATUSES)
EVAL_WORK_STATUSES = (*QUEUED_STATUSES, *TERMINAL_STATUSES)

# Traces and sessions (swept targets):
SWEPT_TARGET_TERMINAL_STATUSES = (*TERMINAL_STATUSES, "CONTENT_LOST")
# Decided against by the evaluator's filter or sampling rate.
DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")
# Ended without a result, so offered again once the target has newer activity. DONE and
# declined rows are final.
REOFFERED_STATUSES: tuple[SweptTargetWorkStatus, ...] = (
    "FAILED",
    "EXPIRED",
    "DROPPED",
    "CONTENT_LOST",
)
SWEPT_TARGET_WORK_STATUSES = (
    *QUEUED_STATUSES,
    *SWEPT_TARGET_TERMINAL_STATUSES,
    *DECLINED_STATUSES,
)


def _status_in(statuses: tuple[str, ...]) -> str:
    return "status IN (" + ", ".join(f"'{status}'" for status in statuses) + ")"


def eval_work_status_check() -> str:
    """CHECK constraint text for ``eval_work_units.status``."""
    return _status_in(EVAL_WORK_STATUSES)


def swept_target_work_status_check() -> str:
    """CHECK constraint text for the trace and session work tables' ``status``."""
    return _status_in(SWEPT_TARGET_WORK_STATUSES)


def queued_index_predicate() -> str:
    """SQL text selecting work units in queue, which hold their dedup key.

    PostgreSQL matches ``ON CONFLICT ... WHERE`` to a partial index by predicate
    equivalence, and SQLite uses a partial index only when a query repeats its predicate,
    so the queries, the models' indexes and the migration must all spell this the same way.
    """
    return _status_in(QUEUED_STATUSES)


def terminal_index_predicate() -> str:
    """SQL text selecting finished span work."""
    return _status_in(TERMINAL_STATUSES)


def swept_target_terminal_index_predicate() -> str:
    """SQL text selecting finished trace and session work."""
    return _status_in(SWEPT_TARGET_TERMINAL_STATUSES)


def failed_index_predicate() -> str:
    """SQL text selecting work that was given up on, for every evaluation target."""
    return _status_in(FAILED_STATUSES)


def done_index_predicate() -> str:
    """SQL text selecting work that was evaluated, for every evaluation target."""
    return "status = 'DONE'"
