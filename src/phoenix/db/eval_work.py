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

# Every annotation online evaluation writes carries an identifier starting with this, so
# a reader can tell its own output from a user's or an API client's without a join. It is
# spelled once here because three sides read it and none of them may drift: the derivation
# that writes it, the annotation seam that must not announce its own output back into the
# trigger loop, and the stand-down delete that removes it. The write boundary reserves it
# so no client can namespace its way into any of the three.
ONLINE_EVAL_IDENTIFIER_PREFIX = "online:"


def is_reserved_annotation_identifier(identifier: str) -> bool:
    """Whether `identifier` is one only online evaluation may write."""
    return identifier.startswith(ONLINE_EVAL_IDENTIFIER_PREFIX)


# Signal kinds the trigger pipeline understands. Adding a kind is an edit here plus the
# code that emits and matches it; the CHECK domains are rendered from this tuple.
EVALUATOR_SIGNAL_KINDS = ("annotation_upserted", "evaluation_completed")

# Entity kinds an online evaluation can be aimed at. The project_evaluators that declare one, the
# cursors that scan for one, and the signal log that routes to one all render their CHECK
# domains from this tuple.
EVALUATION_TARGETS = ("SPAN", "TRACE", "SESSION")

# Stamped on session work units retired because their session lost content. Like the
# subsystem's other error markers it is read by operators and matched in tests, so it
# is spelled once here rather than at the deletion path that writes it.
SESSION_CONTENT_INCOMPLETE_ERROR = "session content incomplete"

# Stamped on a declined decision that a request displaced. It has to be distinct from
# every other terminal marker: if it read as evidence that the pair had been evaluated,
# superseding a declined row would immediately brake the request that displaced it.
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


def evaluator_signal_kind_check(column: str) -> str:
    """SQL text constraining ``column`` to ``EVALUATOR_SIGNAL_KINDS``.

    The signal log and the trigger rules that discriminate on kind both spell the
    vocabulary through this, so a new kind cannot reach one table without the other.
    """
    kinds = ", ".join(f"'{kind}'" for kind in EVALUATOR_SIGNAL_KINDS)
    return f"{column} IN ({kinds})"


def evaluation_target_check(column: str) -> str:
    """SQL text constraining ``column`` to ``EVALUATION_TARGETS``.

    Project evaluators, work cursors and the signal log all spell the vocabulary through this,
    so a new target cannot reach one table without the others.
    """
    targets = ", ".join(f"'{target}'" for target in EVALUATION_TARGETS)
    return f"{column} IN ({targets})"


def undrained_evaluator_signal_predicate() -> str:
    """SQL text selecting signals the drain has not acknowledged yet.

    Postgres only uses a partial index for a query whose WHERE clause it can prove
    implies the index predicate, so the drain query, the model's index, and the
    migration that creates it must all spell this the same way.
    """
    return "acknowledged_at IS NULL"

