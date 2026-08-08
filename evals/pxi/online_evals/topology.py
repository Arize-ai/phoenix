"""Topology validation and TOOL-span classification for PXI turn traces."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from operator import itemgetter

from phoenix.client.__generated__ import v1

PXI_TURN_ROOT_NAME = "pxi.turn"


class InvalidTurnTrace(ValueError):
    """Raised when a purported new-format PXI turn has an incomplete topology."""


@dataclass(frozen=True)
class ToolSpanBreakdown:
    """Chronological TOOL spans partitioned by whether they have a TOOL ancestor."""

    all_tools: list[v1.Span]
    top_level: list[v1.Span]
    nested: list[v1.Span]


def span_id(span: v1.Span) -> str:
    return span["context"]["span_id"]


def trace_id(span: v1.Span) -> str:
    return span["context"]["trace_id"]


def classify_tool_spans(root: v1.Span, spans: Sequence[v1.Span]) -> ToolSpanBreakdown:
    """Partition PXI tool invocations into top-level and nested spans.

    Browser tools are direct children of ``pxi.turn``. Server tool spans may
    have non-tool model/agent spans between them and the turn root. A tool is a
    top-level PXI invocation exactly when its ancestor chain reaches the turn
    root without crossing another TOOL span. All other tools are nested.
    """

    root_id = span_id(root)
    if root["name"] != PXI_TURN_ROOT_NAME or root.get("parent_id") is not None:
        raise InvalidTurnTrace(f"span {root_id} is not a {PXI_TURN_ROOT_NAME!r} root")

    by_id = {span_id(span): span for span in spans}
    if root_id not in by_id:
        raise InvalidTurnTrace(f"trace does not contain turn root {root_id}")

    all_tools: list[v1.Span] = []
    top_level: list[v1.Span] = []
    nested: list[v1.Span] = []
    for tool in spans:
        if tool["span_kind"] != "TOOL":
            continue
        all_tools.append(tool)
        current_id = tool.get("parent_id")
        visited = {span_id(tool)}
        nested_below_tool = False
        while current_id != root_id:
            if current_id is None:
                raise InvalidTurnTrace(
                    f"tool span {span_id(tool)} does not descend from turn root {root_id}"
                )
            if current_id in visited:
                raise InvalidTurnTrace(f"cycle found above tool span {span_id(tool)}")
            visited.add(current_id)
            ancestor = by_id.get(current_id)
            if ancestor is None:
                raise InvalidTurnTrace(
                    f"missing ancestor {current_id} above tool span {span_id(tool)}"
                )
            if ancestor["span_kind"] == "TOOL":
                nested_below_tool = True
                break
            current_id = ancestor.get("parent_id")
        (nested if nested_below_tool else top_level).append(tool)
    return ToolSpanBreakdown(
        all_tools=sorted(all_tools, key=itemgetter("start_time")),
        top_level=sorted(top_level, key=itemgetter("start_time")),
        nested=sorted(nested, key=itemgetter("start_time")),
    )


def top_level_tool_spans(root: v1.Span, spans: Sequence[v1.Span]) -> list[v1.Span]:
    """Return chronological PXI tool invocations that have no TOOL ancestor."""

    return classify_tool_spans(root, spans).top_level
