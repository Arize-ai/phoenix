from __future__ import annotations

from collections.abc import Sequence

from phoenix.client.__generated__ import v1

PXI_TURN_ROOT_NAME = "pxi.turn"


class InvalidTurnTrace(ValueError):
    """Raised when a purported new-format PXI turn has an incomplete topology."""


def span_id(span: v1.Span) -> str:
    return span["context"]["span_id"]


def trace_id(span: v1.Span) -> str:
    return span["context"]["trace_id"]


def top_level_tool_spans(root: v1.Span, spans: Sequence[v1.Span]) -> list[v1.Span]:
    """Return PXI tool invocations while excluding tools used inside other tools.

    Browser tools are direct children of ``pxi.turn``. Server tool spans may
    have non-tool model/agent spans between them and the turn root. A tool is a
    top-level PXI invocation exactly when its ancestor chain reaches the turn
    root without crossing another TOOL span. This counts ``call_subagent`` but
    excludes all tools beneath it.
    """

    root_id = span_id(root)
    if root["name"] != PXI_TURN_ROOT_NAME or root.get("parent_id") is not None:
        raise InvalidTurnTrace(f"span {root_id} is not a {PXI_TURN_ROOT_NAME!r} root")

    by_id = {span_id(span): span for span in spans}
    if root_id not in by_id:
        raise InvalidTurnTrace(f"trace does not contain turn root {root_id}")

    result: list[v1.Span] = []
    for tool in spans:
        if tool["span_kind"] != "TOOL":
            continue
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
        if not nested_below_tool:
            result.append(tool)
    return sorted(result, key=lambda span: span["start_time"])
