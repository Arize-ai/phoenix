"""Cleanup-task and lifecycle SQL predicates shared by models, queries, and services.

This module imports nothing from Phoenix at runtime so ``models`` and the cleanup
coordinator can share exact predicate text (required for SQLite partial-index matching).
"""

from __future__ import annotations

import re
from typing import Literal, TypeAlias

EXPERIMENT_PROJECT_NAME_PATTERN = re.compile(r"^Experiment-[0-9a-f]{24}$")
EVALUATOR_TRACE_PROJECT_NAME_PATTERN = re.compile(r"^(?:dataset|project)-evaluator-[0-9a-f]{24}$")

CLEANUP_TASK_KINDS = (
    "DELETE_PROJECT",
    "DELETE_PROJECT_EVALUATOR",
    "DELETE_DATASET_EVALUATOR",
)

ProjectKindName: TypeAlias = Literal["STANDARD", "PLAYGROUND", "EXPERIMENT", "EVALUATOR"]

DEFAULT_LISTED_PROJECT_KINDS: tuple[ProjectKindName, ...] = ("STANDARD", "PLAYGROUND")


def _column_in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def cleanup_task_kind_check() -> str:
    """CHECK constraint text for ``cleanup_tasks.kind``."""
    return _column_in("kind", CLEANUP_TASK_KINDS)


def live_row_predicate() -> str:
    """SQL partial-index predicate selecting rows not marked deleted."""
    return "deleted_at IS NULL"


def unclaimed_cleanup_tasks_predicate() -> str:
    """SQL partial-index predicate selecting unclaimed cleanup tasks."""
    return "claimed_at IS NULL"


def claimed_cleanup_tasks_predicate() -> str:
    """SQL partial-index predicate selecting claimed cleanup tasks."""
    return "claimed_at IS NOT NULL"


def is_generated_experiment_project_name(name: str) -> bool:
    """Whether ``name`` matches Phoenix's generated ``Experiment-<24hex>`` pattern."""
    return bool(EXPERIMENT_PROJECT_NAME_PATTERN.match(name))


def is_generated_evaluator_trace_project_name(name: str) -> bool:
    """Whether ``name`` matches Phoenix's generated evaluator trace project pattern."""
    return bool(EVALUATOR_TRACE_PROJECT_NAME_PATTERN.match(name))
