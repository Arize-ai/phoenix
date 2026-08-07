"""The scenario registry.

Kept separate from ``__main__`` so that ``generate_all`` can enumerate scenarios without
importing the CLI that also exposes ``generate_all`` itself.
"""

from __future__ import annotations

from collections.abc import Callable

try:
    from .generate_agent_tool_calls import main as agent_main
    from .generate_axis_label_spans import main as axis_labels_main
    from .generate_edge_case_spans import main as edge_cases_main
    from .generate_mixed_workload import main as mixed_main
    from .generate_multi_session_traffic import main as sessions_main
    from .generate_partial_traces import main as partial_traces_main
    from .generate_prompt_templates import main as prompts_main
    from .generate_rag_pipeline import main as rag_main
    from .generate_spans_deeply_nested import main as nested_main
    from .generate_spans_for_cost_calculations import main as costs_main
    from .generate_spans_for_large_session import main as large_session_main
    from .generate_spans_for_time_series import main as time_series_main
    from .generate_spans_with_event_attributes import main as events_main
    from .generate_token_detail_spans import main as token_details_main
except ImportError:  # Support direct execution from this directory.
    from generate_agent_tool_calls import main as agent_main  # type: ignore[no-redef]
    from generate_axis_label_spans import main as axis_labels_main  # type: ignore[no-redef]
    from generate_edge_case_spans import main as edge_cases_main  # type: ignore[no-redef]
    from generate_mixed_workload import main as mixed_main  # type: ignore[no-redef]
    from generate_multi_session_traffic import main as sessions_main  # type: ignore[no-redef]
    from generate_partial_traces import main as partial_traces_main  # type: ignore[no-redef]
    from generate_prompt_templates import main as prompts_main  # type: ignore[no-redef]
    from generate_rag_pipeline import main as rag_main  # type: ignore[no-redef]
    from generate_spans_deeply_nested import main as nested_main  # type: ignore[no-redef]
    from generate_spans_for_cost_calculations import main as costs_main  # type: ignore[no-redef]
    from generate_spans_for_large_session import (
        main as large_session_main,  # type: ignore[no-redef]
    )
    from generate_spans_for_time_series import main as time_series_main  # type: ignore[no-redef]
    from generate_spans_with_event_attributes import main as events_main  # type: ignore[no-redef]
    from generate_token_detail_spans import main as token_details_main  # type: ignore[no-redef]

Scenario = Callable[["list[str] | None"], int]

SCENARIOS: dict[str, tuple[str, Scenario]] = {
    "agent": ("agent runs with tool calls and graph nodes", agent_main),
    "axis-labels": ("long model names for chart labels", axis_labels_main),
    "edge-cases": ("hostile payloads for UI robustness", edge_cases_main),
    "mixed": ("bounded mixed-kind workload", mixed_main),
    "partial-traces": ("traces missing spans, as sampling produces", partial_traces_main),
    "prompts": ("prompt templates, variables, and versions", prompts_main),
    "rag": ("retrieval pipelines with correlated quality scores", rag_main),
    "nested": ("one deeply nested trace", nested_main),
    "time-series": ("business-shaped historical traffic", time_series_main),
    "token-details": ("cache and multimodal token fixtures", token_details_main),
    "costs": ("cost-manifest model coverage", costs_main),
    "sessions": ("many sessions across users and time", sessions_main),
    "large-session": ("many turns in one session", large_session_main),
    "events": ("structured span events and exceptions", events_main),
}
