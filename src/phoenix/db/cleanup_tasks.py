"""Cleanup-task and lifecycle SQL predicates shared by models, queries, and services.

This module imports nothing from Phoenix at runtime so ``models`` and the cleanup
coordinator can share exact predicate text (required for SQLite partial-index matching).
"""

from __future__ import annotations

CLEANUP_TASK_KINDS = (
    "DELETE_PROJECT",
    "CLEAR_PROJECT_TRACES",
    "DELETE_PROJECT_EVALUATOR",
    "DELETE_DATASET_EVALUATOR",
)

PROJECT_KINDS = (
    "STANDARD",
    "PLAYGROUND",
    "EXPERIMENT",
    "EVALUATOR",
)

SQLITE_TRACE_ROWID_STATE_KEY = "traces.sqlite_max_rowid"


def _column_in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def cleanup_task_kind_check() -> str:
    """CHECK constraint text for ``cleanup_tasks.kind``."""
    return _column_in("kind", CLEANUP_TASK_KINDS)


def project_kind_check() -> str:
    """CHECK constraint text for ``projects.kind``."""
    return _column_in("kind", PROJECT_KINDS)


def live_row_predicate() -> str:
    """SQL partial-index predicate selecting rows not marked deleted."""
    return "deleted_at IS NULL"


def unclaimed_cleanup_tasks_predicate() -> str:
    """SQL partial-index predicate selecting unclaimed cleanup tasks."""
    return "claimed_at IS NULL"


def claimed_cleanup_tasks_predicate() -> str:
    """SQL partial-index predicate selecting claimed cleanup tasks."""
    return "claimed_at IS NOT NULL"
