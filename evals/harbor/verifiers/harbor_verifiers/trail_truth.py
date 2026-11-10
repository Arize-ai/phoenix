"""Facts about the `research-assistant` project in the `trail` fixture, read at grading time.

The TRAIL loader drops a few annotations at random when it seeds the fixture, so these
helpers compute the truth from the running Phoenix server instead of storing it. A trace is
labeled when a human annotation exists for it: a `trail_*` trace annotation or a
`trail_error` span annotation. Unlabeled traces have no human verdict and are neither
positives nor negatives.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from functools import cache
from typing import Any

from harbor_verifiers.evals_state import get_json
from harbor_verifiers.phoenix_api import client, project_spans

PROJECT = "research-assistant"
_TOOL_SELECTION = re.compile(r"^\s*tool selection", re.IGNORECASE)
_GOAL_DEVIATION = re.compile(r"^\s*goal deviation", re.IGNORECASE)


@dataclass(frozen=True)
class TraceFacts:
    trace_id: str
    span_ids: frozenset[str]
    question: str
    labeled: bool
    error_categories: frozenset[str]
    uses_search_agent: bool
    llm_spans: int

    @property
    def tool_selection_error(self) -> bool:
        return any(_TOOL_SELECTION.match(c) for c in self.error_categories)

    @property
    def goal_deviation(self) -> bool:
        return any(_GOAL_DEVIATION.match(c) for c in self.error_categories)

    @property
    def size_band(self) -> str:
        if self.llm_spans <= 6:
            return "small"
        return "medium" if self.llm_spans <= 15 else "large"


def _question(span: dict[str, Any]) -> str:
    raw = (span.get("attributes") or {}).get("input.value")
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
        except ValueError:
            return raw
        if isinstance(value, dict) and isinstance(value.get("task"), str):
            return str(value["task"]).split("Here is the task:", 1)[-1].strip()
        return raw
    return ""


def _annotated_trace_ids(trace_ids: list[str]) -> set[str]:
    annotated: set[str] = set()
    for start in range(0, len(trace_ids), 50):
        cursor: str | None = None
        while True:
            params: dict[str, Any] = {"trace_ids": trace_ids[start : start + 50], "limit": 1000}
            if cursor:
                params["cursor"] = cursor
            page = get_json(f"/v1/projects/{PROJECT}/trace_annotations", params) or {}
            for annotation in page.get("data", []):
                if str(annotation.get("name", "")).startswith("trail_"):
                    annotated.add(annotation["trace_id"])
            cursor = page.get("next_cursor")
            if not cursor:
                break
    return annotated


@cache
def traces() -> dict[str, TraceFacts]:
    """Returns the facts for every trace in the project, keyed by trace ID."""
    spans = project_spans(PROJECT)
    by_trace: dict[str, list[dict[str, Any]]] = defaultdict(list)
    trace_of_span: dict[str, str] = {}
    for span in spans:
        trace_id = span["context"]["trace_id"]
        by_trace[trace_id].append(dict(span))
        trace_of_span[span["context"]["span_id"]] = trace_id
    categories: dict[str, set[str]] = defaultdict(set)
    for annotation in client().spans.get_span_annotations(
        spans=spans, project_identifier=PROJECT, include_annotation_names=["trail_error"]
    ):
        label = (annotation.get("result") or {}).get("label")
        trace_id = trace_of_span.get(annotation["span_id"])
        if trace_id and label:
            categories[trace_id].add(str(label))
    annotated = _annotated_trace_ids(sorted(by_trace)) | set(categories)
    facts = {}
    for trace_id, members in by_trace.items():
        run = next((s for s in members if s["name"] == "CodeAgent.run"), None)
        facts[trace_id] = TraceFacts(
            trace_id=trace_id,
            span_ids=frozenset(s["context"]["span_id"] for s in members),
            question=_question(run) if run else "",
            labeled=trace_id in annotated,
            error_categories=frozenset(categories.get(trace_id, set())),
            uses_search_agent=any(s["name"] == "ToolCallingAgent.run" for s in members),
            llm_spans=sum(str(s.get("span_kind", "")).upper() == "LLM" for s in members),
        )
    return facts


def trace_for_reference(value: Any) -> str | None:
    """Returns the trace that a span ID or trace ID string belongs to, if it's in the project."""
    if not isinstance(value, str):
        return None
    facts = traces()
    if value in facts:
        return value
    for trace_id, fact in facts.items():
        if value in fact.span_ids:
            return trace_id
    return None


def linked_trace(example: dict[str, Any]) -> str | None:
    """Returns the project trace a dataset example came from, through its source span or any
    span ID or trace ID string in its metadata, input, or output."""
    source = example.get("source") or {}
    if found := trace_for_reference(source.get("span_id")):
        return found
    for part in ("metadata", "input", "output"):
        for value in _strings(example.get(part)):
            if found := trace_for_reference(value.strip()):
                return found
    return None


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for item in value.values() for s in _strings(item)]
    if isinstance(value, list):
        return [s for item in value for s in _strings(item)]
    return []
