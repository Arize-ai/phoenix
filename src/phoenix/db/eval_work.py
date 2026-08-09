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


def live_eval_work_index_predicate() -> str:
    """SQL text selecting work units that still hold their dedup key.

    Postgres matches ``ON CONFLICT ... WHERE`` to a partial index by predicate
    equivalence, so the sweeper's conflict target, the model's index, and the
    migration that creates it must all spell this the same way. Changing
    ``MAX_ATTEMPTS`` changes the DDL: existing deployments need a new migration
    that rebuilds the index.
    """
    return f"status IN ('PENDING', 'RUNNING') OR status = 'ERROR' AND attempts < {MAX_ATTEMPTS}"
