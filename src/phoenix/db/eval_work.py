"""Work-unit status vocabulary and the schema predicates derived from it.

This module imports nothing from Phoenix at runtime so the schema (``models``), the
queries (``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from phoenix.db.models import EvalWorkStatus

MAX_ATTEMPTS = 3

# In queue: waiting (PENDING), running (RUNNING), or retrying after an error (ERROR).
QUEUED_STATUSES = ("PENDING", "RUNNING", "ERROR")
# Finished. DROPPED: cleared from the queue before it ran. CONTENT_LOST: a trace or session
# whose content was gone when its turn came.
TERMINAL_STATUSES = ("DONE", "FAILED", "EXPIRED", "DROPPED", "CONTENT_LOST")
# Given up on: the finished statuses the user is owed an error for.
FAILED_STATUSES = ("FAILED", "EXPIRED")
# Evaluated or given up on.
COMPLETED_STATUSES = ("DONE", *FAILED_STATUSES)
# A trace or session decided against by the evaluator's filter or sampling rate.
DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")
# Trace and session work that ended without a result, so offered again once the target has
# newer activity. DONE and declined rows are final.
REOFFERED_STATUSES: tuple[EvalWorkStatus, ...] = (
    "FAILED",
    "EXPIRED",
    "DROPPED",
    "CONTENT_LOST",
)
EVAL_WORK_STATUSES = (*QUEUED_STATUSES, *TERMINAL_STATUSES, *DECLINED_STATUSES)


def _status_in(statuses: tuple[str, ...]) -> str:
    return "status IN (" + ", ".join(f"'{status}'" for status in statuses) + ")"


def eval_work_status_check() -> str:
    """CHECK constraint text for the work tables' ``status``."""
    return _status_in(EVAL_WORK_STATUSES)


def queued_index_predicate() -> str:
    """SQL text selecting work units in queue.

    SQLite uses a partial index only when a query repeats its predicate, so the queries,
    the models' indexes and the migration must all spell this the same way.
    """
    return _status_in(QUEUED_STATUSES)


def terminal_index_predicate() -> str:
    """SQL text selecting finished work, for every evaluation target."""
    return _status_in(TERMINAL_STATUSES)


def failed_index_predicate() -> str:
    """SQL text selecting work that was given up on, for every evaluation target."""
    return _status_in(FAILED_STATUSES)


def done_index_predicate() -> str:
    """SQL text selecting work that was evaluated, for every evaluation target."""
    return "status = 'DONE'"
