"""Work-unit status vocabulary and the schema predicates derived from it.

This module has no Phoenix imports so the schema (``models``), the queries
(``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

# Retry budget: a unit whose counted attempts reach this becomes FAILED. Read by the
# consumer-side coordinator (claim and fail transitions) and by lease reaping. It appears
# in no schema predicate, so changing it needs no migration.
MAX_ATTEMPTS = 3

# Work that still holds its dedup key and may still produce a result. ERROR is a retry
# waiting out its cooldown, not an outcome.
LIVE_EVAL_WORK_STATUSES = ("PENDING", "RUNNING", "ERROR")

# Outcomes. FAILED spent its retry budget. EXPIRED was retired without an evaluation
# for a reason that stays retired. SUPERSEDED was retired because its evaluator's
# configuration changed under it; the producer revives it if the configuration reverts
# before an annotation lands.
TERMINAL_EVAL_WORK_STATUSES = ("DONE", "FAILED", "EXPIRED", "SUPERSEDED")

EVAL_WORK_STATUSES = (*LIVE_EVAL_WORK_STATUSES, *TERMINAL_EVAL_WORK_STATUSES)

# Session work adds decisions not to evaluate, which hold the dedup key so the scheduler
# does not re-decide them every tick, and CONTENT_LOST: the session's traces were deleted
# before the evaluation ran.
SESSION_DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")
TERMINAL_EVAL_SESSION_WORK_STATUSES = (*TERMINAL_EVAL_WORK_STATUSES, "CONTENT_LOST")
EVAL_SESSION_WORK_STATUSES = (
    *LIVE_EVAL_WORK_STATUSES,
    *TERMINAL_EVAL_SESSION_WORK_STATUSES,
    *SESSION_DECLINED_STATUSES,
)

# The message stamped on session work retired as CONTENT_LOST by the content-incomplete
# transition; read by operators and matched in tests, so it is spelled once here.
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
