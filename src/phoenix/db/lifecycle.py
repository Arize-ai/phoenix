"""Project-kind names and lifecycle SQL predicates shared by models, queries, and services.

This module imports nothing from Phoenix at runtime so ``models`` and the cleanup
coordinator can share exact predicate text (required for SQLite partial-index matching).
"""

from __future__ import annotations

from typing import Literal, TypeAlias

ProjectKindName: TypeAlias = Literal["STANDARD", "PLAYGROUND", "EXPERIMENT", "EVALUATOR"]

DEFAULT_LISTED_PROJECT_KINDS: tuple[ProjectKindName, ...] = ("STANDARD", "PLAYGROUND")


def live_row_predicate() -> str:
    """SQL partial-index predicate selecting rows not marked deleted."""
    return "deleted_at IS NULL"


def tombstoned_row_predicate() -> str:
    """SQL partial-index predicate selecting rows marked deleted and awaiting cleanup."""
    return "deleted_at IS NOT NULL"
