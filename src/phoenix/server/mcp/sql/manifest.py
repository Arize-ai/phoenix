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
                        "span_annotations": TableCuration(
                            grain=(
                                "One annotation on a span; joining to spans multiplies "
                                "row count. Use COUNT(DISTINCT spans.id) to count spans"
                            )
                        ),
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
                            grain=(
                                "One token-cost category within a span cost; joining to "
                                "span_costs multiplies row count. Use "
                                "COUNT(DISTINCT span_costs.id) to count costs"
                            ),
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
                        "trace_annotations": TableCuration(
                            grain=(
                                "One annotation on a trace; joining to traces multiplies row "
                                "count. Use COUNT(DISTINCT traces.id) to count traces"
                            ),
                            column_notes=MappingProxyType(
                                {
                                    "trace_rowid": (
                                        "internal row id; traces.trace_id is the OTLP one"
                                    )
                                }
                            ),
                        ),
                        "project_session_annotations": TableCuration(
                            grain=(
                                "One annotation on a session; joining to project_sessions "
                                "multiplies row count. Use COUNT(DISTINCT project_sessions.id) "
                                "to count sessions"
                            ),
                            column_notes=MappingProxyType(
                                {
                                    "project_session_id": (
                                        "internal row id; project_sessions.session_id is the "
                                        "external one"
                                    )
                                }
                            ),
                        ),
                        "document_annotations": TableCuration(
                            grain=(
                                "One annotation on one retrieved document of a span; joining "
                                "to spans multiplies row count. Use COUNT(DISTINCT spans.id) "
                                "to count spans"
                            ),
                            column_notes=MappingProxyType(
                                {
                                    "span_rowid": "internal row id; spans.span_id is the OTLP one",
                                    "document_position": (
                                        "zero-based index into the span's retrieval.documents"
                                    ),
                                }
                            ),
                        ),
                        "annotation_configs": TableCuration(
                            column_notes=MappingProxyType(
                                {
                                    "config": (
                                        "JSON with type CATEGORICAL, CONTINUOUS or FREEFORM and "
                                        "that type's values, bounds and optimization_direction"
                                    )
                                }
                            )
                        ),
                        "project_annotation_configs": TableCuration(
                            grain="One project-to-annotation-config attachment"
                        ),
                        "project_trace_retention_policies": TableCuration(
                            column_notes=MappingProxyType(
                                {
                                    "rule": (
                                        "JSON with max_days and/or max_count; 0 means no limit. "
                                        "projects.trace_retention_policy_id is NULL for the "
                                        "default policy (id 0)"
                                    )
                                }
                            )
                        ),
                        "token_prices": TableCuration(
                            grain="One token type's price for a generative model",
                            column_notes=MappingProxyType(
                                {
                                    "is_prompt": "true for input tokens, false for output",
                                    "base_rate": "USD per token",
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
                        "dataset_splits": TableCuration(),
                        "dataset_splits_dataset_examples": TableCuration(
                            grain="One split-to-dataset-example assignment"
                        ),
                        "dataset_labels": TableCuration(),
                        "datasets_dataset_labels": TableCuration(
                            grain="One label-to-dataset assignment"
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
                        "experiment_runs": TableCuration(
                            time_column="start_time",
                            virtual_columns=frozenset({"latency_ms"}),
                        ),
                        "experiment_run_annotations": TableCuration(
                            grain=(
                                "One annotation on an experiment run; joining to "
                                "experiment_runs multiplies row count. Use "
                                "COUNT(DISTINCT experiment_runs.id) to count runs"
                            )
                        ),
                        "experiments_dataset_splits": TableCuration(
                            grain="One experiment-to-dataset-split assignment"
                        ),
                        "experiment_tags": TableCuration(),
                        "experiment_jobs": TableCuration(
                            grain=(
                                "One server-run experiment job; its id is the experiment's id. "
                                "Client-run experiments have no row"
                            ),
                            column_notes=MappingProxyType(
                                {
                                    "type": (
                                        "PROMPT jobs have a row in experiment_prompt_tasks; "
                                        "EVAL_ONLY jobs only run evaluators"
                                    )
                                }
                            ),
                        ),
                        "experiment_prompt_tasks": TableCuration(
                            grain="The prompt task of one PROMPT experiment job; id is the job id"
                        ),
                        "experiment_logs": TableCuration(
                            time_column="occurred_at",
                            column_notes=MappingProxyType(
                                {
                                    "category": (
                                        "TASK rows extend into experiment_task_logs, EVAL rows "
                                        "into experiment_eval_logs, both keyed by (category, id)"
                                    )
                                }
                            ),
                        ),
                        "experiment_task_logs": TableCuration(
                            grain="The example and repetition of one TASK experiment log"
                        ),
                        "experiment_eval_logs": TableCuration(
                            grain="The run and evaluator of one EVAL experiment log"
                        ),
                        "experiment_dataset_evaluators": TableCuration(
                            grain="One experiment-to-dataset-evaluator assignment"
                        ),
                    }
                )
            ),
            "evaluators": Area(
                tables=MappingProxyType(
                    {
                        "evaluators": TableCuration(
                            column_notes=MappingProxyType(
                                {
                                    "kind": (
                                        "LLM, CODE or BUILTIN; the detail row lives in "
                                        "llm_evaluators, code_evaluators or builtin_evaluators "
                                        "with the same id"
                                    )
                                }
                            )
                        ),
                        "llm_evaluators": TableCuration(
                            grain="The prompt and output config of one LLM evaluator"
                        ),
                        "code_evaluators": TableCuration(
                            grain="The language, mapping and output config of one code evaluator"
                        ),
                        "code_evaluator_code_versions": TableCuration(
                            grain="One immutable source version of a code evaluator",
                            time_column="created_at",
                        ),
                        "builtin_evaluators": TableCuration(
                            grain="The key and schemas of one built-in evaluator"
                        ),
                        "dataset_evaluators": TableCuration(
                            grain=(
                                "One evaluator attached to a dataset, with the dataset's own "
                                "name, mapping and output config for it"
                            )
                        ),
                        "languages": TableCuration(),
                        "sandbox_configs": TableCuration(
                            grain="One code sandbox configuration a code evaluator can run in"
                        ),
                    }
                )
            ),
            "prompts": Area(
                tables=MappingProxyType(
                    {
                        "prompts": TableCuration(
                            column_notes=MappingProxyType(
                                {
                                    "source_prompt_id": (
                                        "the prompt this one was cloned from, or NULL"
                                    )
                                }
                            )
                        ),
                        "prompt_versions": TableCuration(
                            grain="One immutable version of a prompt",
                            time_column="created_at",
                        ),
                        "prompt_version_tags": TableCuration(
                            grain=(
                                "One tag such as production pointing at one version; a tag "
                                "name is unique within a prompt"
                            )
                        ),
                        "prompt_labels": TableCuration(),
                        "prompts_prompt_labels": TableCuration(
                            grain="One label-to-prompt assignment"
                        ),
                    }
                )
            ),
        }
    )
)


def manifest() -> AnalyticsSqlManifest:
    """Return the immutable analytics SQL curation singleton."""
    return MANIFEST
