"""A stand-in for ``GET /v1/projects/{id}/spans`` seeded with the legacy export's test data.

The rows mirror the ``default_project`` and ``abc_project`` fixtures behind the server's
``SpanQuery`` tests, so the client's dataframe export can be checked against the frames
those tests expect. The server evaluates ``filter`` expressions; this stand-in answers them
from a table of matching span ids that each test supplies.
"""

from __future__ import annotations

import re
from base64 import b64decode, b64encode
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any, Optional
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from typing_extensions import TypeGuard

SERVER_VERSION = "20.17.0"


@dataclass(frozen=True)
class SpanRow:
    project: str
    trace_id: str
    span_id: str
    parent_id: Optional[str]
    name: str
    span_kind: str
    start_time: str
    end_time: str
    attributes: Mapping[str, Any] = field(default_factory=dict)
    status_code: str = "OK"
    status_message: str = "okay"

    def with_attributes(self, attributes: Mapping[str, Any]) -> "SpanRow":
        return replace(self, attributes=attributes)


def _row(
    project: str,
    trace_id: str,
    span_id: str,
    parent_id: Optional[str],
    name: str,
    span_kind: str,
    start: str,
    end: str,
    attributes: Optional[Mapping[str, Any]] = None,
    **status: str,
) -> SpanRow:
    return SpanRow(
        project=project,
        trace_id=trace_id,
        span_id=span_id,
        parent_id=parent_id,
        name=name,
        span_kind=span_kind,
        start_time=f"2021-01-01T{start}+00:00",
        end_time=f"2021-01-01T{end}+00:00",
        attributes={"openinference": {"span": {"kind": span_kind}}, **(attributes or {})},
        **status,
    )


def _message(role: str, content: Optional[str] = None, **rest: Any) -> dict[str, Any]:
    message: dict[str, Any] = {"role": role, **rest}
    if content is not None:
        message["content"] = content
    return {"message": message}


def _tool_call(id: str, **function: str) -> dict[str, Any]:
    call: dict[str, Any] = {"id": id}
    if function:
        call["function"] = function
    return {"tool_call": call}


_ARGUMENTS = '{\n  "a": 2,\n  "b": 3\n}'

DEFAULT_PROJECT_ROWS: Sequence[SpanRow] = (
    _row(
        "default",
        "0123",
        "2345",
        None,
        "root span",
        "UNKNOWN",
        "00:00:00",
        "00:00:30",
        {"input": {"value": "210"}, "output": {"value": "321"}},
    ),
    _row(
        "default",
        "0123",
        "4567",
        "2345",
        "retriever span",
        "RETRIEVER",
        "00:00:05",
        "00:00:20",
        {
            "input": {"value": "xyz"},
            "retrieval": {"documents": [{"document": {"content": "A", "score": 1}}]},
        },
    ),
    _row(
        "default",
        "0123",
        "5678",
        "2345",
        "retriever span",
        "RETRIEVER",
        "00:00:05",
        "00:00:20",
        {
            "input": {"value": "xyz"},
            "retrieval": {"documents": [{}, {"document": {"content": "B", "score": 2}}]},
        },
    ),
    _row(
        "default",
        "0123",
        "6789",
        "2345",
        "retriever span",
        "RETRIEVER",
        "00:00:05",
        "00:00:20",
        {
            "input": {"value": "xyz"},
            "retrieval": {"documents": [{}, {}, {"document": {"content": "C", "score": 3}}]},
        },
    ),
    _row("default", "0123", "78910", "2345", "retriever span", "RETRIEVER", "00:00:05", "00:00:20"),
    _row(
        "default",
        "0123",
        "89101",
        "2345",
        "llm span",
        "LLM",
        "00:00:05",
        "00:00:20",
        {
            "llm": {
                "input_messages": [_message("user", "what is 2 times 3, and what is 2 plus 3")],
                "output_messages": [
                    _message(
                        "assistant",
                        tool_calls=[
                            _tool_call("a", name="multiply", arguments=_ARGUMENTS),
                            _tool_call("b", name="add", arguments=_ARGUMENTS),
                        ],
                    )
                ],
            }
        },
    ),
    _row(
        "default",
        "0123",
        "91011",
        "2345",
        "llm span",
        "LLM",
        "00:00:05",
        "00:00:20",
        {
            "llm": {
                "input_messages": [_message("user", "call foo")],
                "output_messages": [
                    _message("assistant", tool_calls=[_tool_call("c", name="foo")])
                ],
            }
        },
    ),
    _row(
        "default",
        "0123",
        "111213",
        "2345",
        "llm span",
        "LLM",
        "00:00:25",
        "00:00:35",
        {
            "llm": {
                "input_messages": [_message("user", "abc")],
                "output_messages": [_message("assistant", "xyz")],
            }
        },
    ),
    _row(
        "default",
        "0123",
        "131415",
        "2345",
        "llm span",
        "LLM",
        "00:00:40",
        "00:00:50",
        {
            "llm": {
                "input_messages": [_message("user", "test empty output")],
                "output_messages": None,
            }
        },
    ),
    _row(
        "default",
        "0123",
        "171819",
        "2345",
        "llm span",
        "LLM",
        "00:01:10",
        "00:01:20",
        {
            "llm": {
                "input_messages": [_message("user", "test invalid tool")],
                "output_messages": [_message("assistant", tool_calls=[_tool_call("invalid")])],
            }
        },
    ),
)

UNNESTABLE_METADATA: Mapping[str, Any] = {
    "a.b.c": 123,
    "1.2.3": "abc",
    "x.y": {"z.a": {"b.c": 321}},
}
"""Keys with dots or only digits, which the span list endpoint's flattening cannot preserve."""

ABC_PROJECT_ROWS: Sequence[SpanRow] = (
    _row(
        "abc",
        "012",
        "234",
        "123",
        "root span",
        "UNKNOWN",
        "00:00:00",
        "00:00:30",
        {"input": {"value": "xy%z*"}, "output": {"value": "321"}},
    ),
    _row(
        "abc",
        "012",
        "345",
        "234",
        "embedding span",
        "EMBEDDING",
        "00:00:00",
        "00:00:05",
        {
            "input": {"value": "XY%*Z"},
            "metadata": UNNESTABLE_METADATA,
            "embedding": {
                "model_name": "xyz",
                "embeddings": [
                    {"embedding": {"vector": [1, 2, 3], "text": "123"}},
                    {"embedding": {"vector": [2, 3, 4], "text": "234"}},
                ],
            },
        },
        status_message="no problemo",
    ),
    _row(
        "abc",
        "012",
        "456",
        "234",
        "retriever span",
        "RETRIEVER",
        "00:00:05",
        "00:00:20",
        {
            "attributes": "attributes",
            "input": {"value": "xy%*z"},
            "retrieval": {
                "documents": [
                    {"document": {"content": "A", "score": 1}},
                    {"document": {"content": "B", "score": 2}},
                    {"document": {"content": "C", "score": 3}},
                ]
            },
        },
    ),
    _row(
        "abc",
        "012",
        "567",
        "234",
        "llm span",
        "LLM",
        "00:00:20",
        "00:00:30",
        {
            "attributes": {"attributes": "attributes"},
            "llm": {"token_count": {"prompt": 100, "completion": 200}},
        },
        status_code="ERROR",
        status_message="uh-oh",
    ),
)

ALL_ROWS: Sequence[SpanRow] = (*DEFAULT_PROJECT_ROWS, *ABC_PROJECT_ROWS)


def _is_mapping(value: Any) -> TypeGuard[Mapping[str, Any]]:
    return isinstance(value, Mapping)


def _is_list(value: Any) -> TypeGuard[list[Any]]:
    return isinstance(value, list)


def flatten(attributes: Mapping[str, Any], prefix: str = "") -> Iterator[tuple[str, Any]]:
    """Flatten nested attributes the way the span list endpoint does.

    Dicts become dotted paths, lists that hold dicts become indexed paths, other lists
    stay whole and ``None`` is dropped.
    """
    for key, value in attributes.items():
        path = f"{prefix}.{key}" if prefix else key
        if _is_mapping(value):
            yield from flatten(value, path)
        elif _is_list(value) and any(_is_mapping(item) for item in value):
            for index, item in enumerate(value):
                if _is_mapping(item):
                    yield from flatten(item, f"{path}.{index}")
        elif value is not None:
            yield path, value


def _payload(row: SpanRow) -> dict[str, Any]:
    attributes = dict(flatten(row.attributes))
    span_kind = attributes.pop("openinference.span.kind", "UNKNOWN")
    return {
        "id": f"Span:{row.span_id}",
        "name": row.name,
        "context": {"trace_id": row.trace_id, "span_id": row.span_id},
        "span_kind": span_kind,
        "parent_id": row.parent_id,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "status_code": row.status_code,
        "status_message": row.status_message,
        "attributes": attributes,
        "events": [],
    }


class FakeSpanListServer:
    """Answers the span list route from ``rows``: newest first, filtered, paged by offset."""

    def __init__(
        self,
        rows: Sequence[SpanRow] = ALL_ROWS,
        filter_results: Optional[Mapping[str, Sequence[str]]] = None,
    ) -> None:
        self.rows = list(rows)
        self.filter_results = {key: set(ids) for key, ids in (filter_results or {}).items()}
        self.requests: list[httpx.Request] = []

    def client(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self), base_url="http://test")

    def sent_filters(self) -> list[str]:
        return [
            condition
            for request in self.requests
            for condition in parse_qs(urlparse(str(request.url)).query).get("filter", [])
        ]

    def _project_lookup(self, name: str) -> httpx.Response:
        if not any(row.project == name for row in self.rows):
            return httpx.Response(200, json={"data": [], "next_cursor": None})
        return httpx.Response(
            200, json={"data": [{"id": _project_id(name), "name": name}], "next_cursor": None}
        )

    def _apply_filter(
        self, rows: list[SpanRow], condition: str, project_span_ids: set[str]
    ) -> Optional[list[SpanRow]]:
        """Rows matching ``condition``, or None when the condition is not a known one.

        ``parent_span is None`` is evaluated for real, on its own or AND-ed onto a
        known condition, since that is how the client spells ``root_spans_only``.
        """
        roots_only = condition == ROOT_SPANS_CONDITION
        if condition.endswith(f") and {ROOT_SPANS_CONDITION}") and condition.startswith("("):
            condition = condition[1 : -len(f") and {ROOT_SPANS_CONDITION}")]
            roots_only = True
        elif not roots_only and condition not in self.filter_results:
            return None
        if roots_only:
            rows = [row for row in rows if row.parent_id not in project_span_ids]
        if condition in self.filter_results:
            rows = [row for row in rows if row.span_id in self.filter_results[condition]]
        return rows

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = urlparse(str(request.url))
        if url.path == "/arize_phoenix_version":
            return httpx.Response(200, text=SERVER_VERSION)
        params = parse_qs(url.query)
        if url.path == "/v1/projects":
            return self._project_lookup(params["name"][0])
        route = re.fullmatch(r"/v1/projects/([^/]+)/spans", url.path)
        assert route, url.path
        project = _project_name(unquote(route.group(1)))
        assert params.get("sort") == ["start_time"], params
        rows = [row for row in self.rows if row.project == project]
        if not rows:
            return httpx.Response(404, json={"detail": f"project {project!r} not found"})
        project_span_ids = {row.span_id for row in rows}
        if start_time := params.get("start_time"):
            rows = [row for row in rows if _parse(row.start_time) >= _parse(start_time[0])]
        if end_time := params.get("end_time"):
            rows = [row for row in rows if _parse(row.start_time) < _parse(end_time[0])]
        if condition := params.get("filter"):
            filtered = self._apply_filter(rows, condition[0], project_span_ids)
            if filtered is None:
                return httpx.Response(400, json={"detail": f"unexpected filter {condition[0]!r}"})
            rows = filtered
        insertion_order = {row.span_id: position for position, row in enumerate(self.rows)}
        rows.sort(key=lambda row: (_parse(row.start_time), insertion_order[row.span_id]))
        rows.reverse()
        offset = int(params.get("cursor", ["0"])[0])
        limit = int(params["limit"][0])
        page = rows[offset : offset + limit]
        next_cursor = str(offset + limit) if offset + limit < len(rows) else None
        return httpx.Response(
            200, json={"data": [_payload(row) for row in page], "next_cursor": next_cursor}
        )


ROOT_SPANS_CONDITION = "parent_span is None"

_PROJECT_ID_PREFIX = "Project:"


def _project_id(name: str) -> str:
    return b64encode(f"{_PROJECT_ID_PREFIX}{name}".encode()).decode()


def _project_name(identifier: str) -> str:
    decoded = b64decode(identifier).decode()
    assert decoded.startswith(_PROJECT_ID_PREFIX), identifier
    return decoded[len(_PROJECT_ID_PREFIX) :]


def _parse(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
