"""Retry budget for online-eval work units, and the index predicate derived from it.

This module has no Phoenix imports so the schema (``models``), the queries
(``online_eval``), and the migrations can all read the same values.
"""

from __future__ import annotations

# Retry budget for a work unit before its ERROR state becomes terminal. The producer
# excludes attempt-exhausted rows from reaping and backstop re-materialization using
# this value, and the consumer-side coordinator stops reclaiming ERROR rows at it —
# the two sides drifting apart either resurrects dead work or strands retryable work.
MAX_ATTEMPTS = 3

SESSION_DECLINED_STATUSES = ("FILTERED_OUT", "SAMPLED_OUT")

# Stamped on session work units retired because their session lost content. Like the
# subsystem's other error markers it is read by operators and matched in tests, so it
# is spelled once here rather than at the deletion path that writes it.
SESSION_CONTENT_INCOMPLETE_ERROR = "session content incomplete"


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
