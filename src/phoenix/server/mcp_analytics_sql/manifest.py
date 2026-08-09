"""Typed curation for the analytics SQL surface.

Physical schema comes from the packaged DDL assets. This module contains only
the policy and semantics a database cannot express: allowlisted areas and
tables, virtual columns, and teaching notes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Mapping

__all__ = ["AnalyticsSqlManifest", "Area", "MANIFEST", "TableCuration", "manifest"]

_EMPTY_NOTES: Mapping[str, str] = MappingProxyType({})


@dataclass(frozen=True)
class TableCuration:
    grain: str = ""
    time_column: str | None = None
    virtual_columns: frozenset[str] = frozenset()
    column_notes: Mapping[str, str] = field(default_factory=lambda: _EMPTY_NOTES)
    promoted_columns_note: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "virtual_columns", frozenset(self.virtual_columns))
        object.__setattr__(self, "column_notes", MappingProxyType(dict(self.column_notes)))


@dataclass(frozen=True)
class Area:
    tables: Mapping[str, TableCuration]

    def __post_init__(self) -> None:
        object.__setattr__(self, "tables", MappingProxyType(dict(self.tables)))


@dataclass(frozen=True)
class AnalyticsSqlManifest:
    areas: Mapping[str, Area]

    def __post_init__(self) -> None:
        object.__setattr__(self, "areas", MappingProxyType(dict(self.areas)))


MANIFEST = AnalyticsSqlManifest(
    areas=MappingProxyType(
        {
            "telemetry": Area(
                tables=MappingProxyType(
                    {
                        "projects": TableCuration(),
                        "traces": TableCuration(
                            time_column="start_time",
                            virtual_columns=frozenset({"latency_ms"}),
                            column_notes=MappingProxyType(
                                {
                                    "trace_id": (
                                        "OTLP id; trace_rowid elsewhere is the internal row id"
                                    )
                                }
                            ),
                        ),
                        "spans": TableCuration(
                            grain="One OpenTelemetry span",
                            time_column="start_time",
                            virtual_columns=frozenset({"latency_ms"}),
                            column_notes=MappingProxyType(
                                {
                                    "parent_id": (
                                        "the parent's span_id, not spans.id; self-join on span_id"
                                    ),
                                    "span_id": "OTLP id, unique; the value parent_id points at",
                                    "trace_rowid": (
                                        "internal row id; traces.trace_id is the OTLP one"
                                    ),
                                }
                            ),
                            promoted_columns_note=(
                                "Prefer llm_token_count_* over JSON for per-span tokens; never "
                                "SUM cumulative_* across spans. Promotion happens only when "
                                "span_kind='LLM': a span of any other kind that carries "
                                "llm.token_count.* in attributes has NULL in these columns and "
                                "in cumulative_*, so a total over a whole project can undercount "
                                "unless the JSON is consulted for non-LLM kinds."
                            ),
                        ),
                        "span_annotations": TableCuration(),
                        "span_costs": TableCuration(
                            column_notes=MappingProxyType(
                                {
                                    "span_start_time": (
                                        "copied from spans.start_time so cost can be filtered by "
                                        "time alone"
                                    )
                                }
                            )
                        ),
                        "span_cost_details": TableCuration(
                            grain="One token-cost category within a span cost",
                            column_notes=MappingProxyType(
                                {"is_prompt": "true for input tokens, false for output"}
                            ),
                        ),
                        "generative_models": TableCuration(),
                        "project_sessions": TableCuration(
                            time_column="start_time",
                            column_notes=MappingProxyType(
                                {
                                    "session_id": (
                                        "external id; project_sessions.id is the internal row id"
                                    )
                                }
                            ),
                        ),
                    }
                )
            ),
            "datasets": Area(
                tables=MappingProxyType(
                    {
                        "datasets": TableCuration(),
                        "dataset_versions": TableCuration(),
                        "dataset_examples": TableCuration(),
                        "dataset_example_revisions": TableCuration(
                            grain="One immutable revision of a dataset example"
                        ),
                    }
                )
            ),
            "experiments": Area(
                tables=MappingProxyType(
                    {
                        "experiments": TableCuration(),
                        "experiments_dataset_examples": TableCuration(
                            grain="One experiment-to-dataset-example assignment"
                        ),
                        "experiment_runs": TableCuration(time_column="start_time"),
                        "experiment_run_annotations": TableCuration(),
                    }
                )
            ),
        }
    )
)


def manifest() -> AnalyticsSqlManifest:
    """Return the immutable analytics SQL curation singleton."""
    return MANIFEST
