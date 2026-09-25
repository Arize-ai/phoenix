"""A port of the deprecated ``POST /v1/spans`` route's test suite, checking the dataframe format is preserved."""

from __future__ import annotations

import re
from base64 import b64decode, b64encode
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any, Optional
from urllib.parse import parse_qs, unquote, urlparse

import httpx
import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from typing_extensions import TypeGuard

from phoenix.client.resources.spans import Spans
from phoenix.client.types.spans import SpanQuery

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
"""Keys with dots or only digits, which only survive when attributes come back as stored."""

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


def _payload(row: SpanRow) -> dict[str, Any]:
    """The span as the list endpoint returns it with ``attributes_format=nested``: as stored."""
    span_kind = row.attributes.get("openinference", {}).get("span", {}).get("kind", "UNKNOWN")
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
        "attributes": row.attributes,
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
        assert params.get("attributes_format") == ["nested"], params
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


_LATENCY = {"Latency (milliseconds)": "latency_ms"}
_DOCUMENTS = "retrieval.documents"


def _export(
    query: Optional[SpanQuery] = None,
    *,
    rows: Sequence[SpanRow] = ALL_ROWS,
    filter_results: Optional[dict[str, Sequence[str]]] = None,
    project_name: Optional[str] = "abc",
    **kwargs: Any,
) -> tuple[pd.DataFrame, FakeSpanListServer]:
    server = FakeSpanListServer(rows, filter_results)
    frame = Spans(server.client()).get_spans_dataframe(
        query=query, project_name=project_name, **kwargs
    )
    return frame, server


def _where(
    query: SpanQuery, condition: str, matching_span_ids: Sequence[str]
) -> tuple[pd.DataFrame, str]:
    """Export ``query.where(condition)`` as if the server matched ``matching_span_ids``."""
    filtered = query.where(condition)
    sent = filtered.to_dict()["filter"]["condition"]
    frame, server = _export(filtered, filter_results={sent: matching_span_ids})
    assert server.sent_filters() == [sent]
    return frame, sent


def _assert_same_frame(actual: pd.DataFrame, expected: pd.DataFrame, **kwargs: Any) -> None:
    """Compare frames regardless of row and column order."""
    assert_frame_equal(_comparable(actual), _comparable(expected), **kwargs)


def _comparable(df: pd.DataFrame) -> pd.DataFrame:
    text = df.astype(str).to_numpy().tolist()
    rows = sorted(range(len(df)), key=lambda i: (str(df.index[i]), tuple(text[i])))
    return df.iloc[rows].sort_index(axis=1)


def _utc(time: str) -> datetime:
    return datetime.fromisoformat(f"2021-01-01T{time}+00:00")


def _select_all_expected(metadata: Any) -> pd.DataFrame:
    no_events: list[list[Any]] = [[], [], [], []]
    return pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "context.trace_id": ["012", "012", "012", "012"],
            "parent_id": ["123", "234", "234", "234"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
            "span_kind": ["UNKNOWN", "EMBEDDING", "RETRIEVER", "LLM"],
            "status_code": ["OK", "OK", "OK", "ERROR"],
            "status_message": ["okay", "no problemo", "okay", "uh-oh"],
            "start_time": [_utc("00:00:00"), _utc("00:00:00"), _utc("00:00:05"), _utc("00:00:20")],
            "end_time": [_utc("00:00:30"), _utc("00:00:05"), _utc("00:00:20"), _utc("00:00:30")],
            "attributes.input.value": ["xy%z*", "XY%*Z", "xy%*z", None],
            "attributes.output.value": ["321", None, None, None],
            "attributes.llm.token_count.prompt": [None, None, None, 100.0],
            "attributes.llm.token_count.completion": [None, None, None, 200.0],
            "attributes.metadata": [None, metadata, None, None],
            "attributes.embedding.model_name": [None, "xyz", None, None],
            "attributes.embedding.embeddings": [
                None,
                [
                    {"embedding.vector": [1, 2, 3], "embedding.text": "123"},
                    {"embedding.vector": [2, 3, 4], "embedding.text": "234"},
                ],
                None,
                None,
            ],
            "attributes.retrieval.documents": [
                None,
                None,
                [
                    {"document.content": "A", "document.score": 1.0},
                    {"document.content": "B", "document.score": 2.0},
                    {"document.content": "C", "document.score": 3.0},
                ],
                None,
            ],
            "attributes.attributes": [None, None, "attributes", {"attributes": "attributes"}],
            "attributes.openinference.span.kind": ["UNKNOWN", "EMBEDDING", "RETRIEVER", "LLM"],
            "events": no_events,
        }
    ).set_index("context.span_id", drop=False)


def test_select_all() -> None:
    actual, _ = _export(SpanQuery())
    expected = _select_all_expected({"a.b.c": 123, "1.2.3": "abc", "x.y": {"z.a": {"b.c": 321}}})
    _assert_same_frame(actual, expected)


def test_select_all_with_nestable_metadata() -> None:
    metadata = {"a": {"b": {"c": 123}}, "x": {"y": {"z": 321}}}
    rows = [
        row.with_attributes({**row.attributes, "metadata": metadata})
        if row.span_id == "345"
        else row
        for row in ALL_ROWS
    ]
    actual, _ = _export(SpanQuery(), rows=rows)
    _assert_same_frame(actual, _select_all_expected(metadata))


def test_select_all_on_the_default_project() -> None:
    actual, _ = _export(SpanQuery(), project_name=None, limit=4)
    assert actual.index.tolist() == ["171819", "131415", "111213", "91011"]
    assert actual.at["91011", "attributes.llm.output_messages"] == [
        {
            "message.role": "assistant",
            "message.tool_calls": [{"tool_call.id": "c", "tool_call.function.name": "foo"}],
        }
    ]


def test_select_all_with_no_data() -> None:
    actual, _ = _export(SpanQuery(), project_name="opq")
    expected = pd.DataFrame(
        columns=[
            "context.span_id",
            "context.trace_id",
            "parent_id",
            "name",
            "span_kind",
            "status_code",
            "status_message",
            "start_time",
            "end_time",
            "events",
        ]
    ).set_index("context.span_id", drop=False)
    _assert_same_frame(actual, expected)


def test_select() -> None:
    actual, _ = _export(SpanQuery().select("name", tcp="llm.token_count.prompt"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
            "tcp": [None, None, None, 100.0],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_select_parent_id_as_span_id() -> None:
    actual, _ = _export(SpanQuery().select("name", span_id="parent_id"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["123", "234", "234", "234"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_select_trace_id_as_index() -> None:
    actual, _ = _export(SpanQuery().select("span_id").with_index("trace_id"))
    expected = pd.DataFrame(
        {
            "context.trace_id": ["012", "012", "012", "012"],
            "context.span_id": ["234", "345", "456", "567"],
        }
    ).set_index("context.trace_id")
    _assert_same_frame(actual, expected)


def test_select_nonexistent() -> None:
    actual, _ = _export(SpanQuery().select("name", "opq", "opq.rst"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
            "opq": [None, None, None, None],
            "opq.rst": [None, None, None, None],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_default_project() -> None:
    actual, _ = _export(
        SpanQuery().select("name", **_LATENCY), project_name=None, root_spans_only=True
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["2345"],
            "name": ["root span"],
            "Latency (milliseconds)": [30000.0],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_root_spans_only() -> None:
    actual, _ = _export(SpanQuery().select("name", **_LATENCY), root_spans_only=True)
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "name": ["root span"],
            "Latency (milliseconds)": [30000.0],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_start_time() -> None:
    actual, _ = _export(SpanQuery().select("name"), start_time=_utc("00:00:20"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["567"],
            "name": ["llm span"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_end_time() -> None:
    actual, _ = _export(SpanQuery().select("name"), end_time=_utc("00:00:01"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345"],
            "name": ["root span", "embedding span"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_limit() -> None:
    actual, _ = _export(SpanQuery(), limit=2)
    # Newest-first ordering
    assert actual.index.tolist() == ["567", "456"]


def test_limit_with_select_statement() -> None:
    """The legacy export left this order to the database; the client sorts newest first."""
    actual, _ = _export(SpanQuery().select("context.span_id"), limit=2)
    expected = pd.DataFrame(
        {
            "context.span_id": ["567", "456"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_for_none() -> None:
    actual, _ = _where(SpanQuery().select("name"), "parent_id is None", [])
    expected = pd.DataFrame(
        {
            "context.span_id": [],
            "name": [],
        }
    ).set_index("context.span_id")
    _assert_same_frame(
        actual,
        expected,
        check_dtype=False,
        check_column_type=False,
        check_frame_type=False,
        check_index_type=False,
    )


def test_filter_for_not_none() -> None:
    actual, _ = _where(SpanQuery().select("name"), "output.value is not None", ["234"])
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "name": ["root span"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


@pytest.mark.parametrize("needle", ["y%*", "Y%*"])
def test_filter_for_substring_ignores_case_not_glob_not_like(needle: str) -> None:
    actual, _ = _where(
        SpanQuery().select("input.value"), f"'{needle}' in input.value", ["345", "456"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "456"],
            "input.value": ["XY%*Z", "xy%*z"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


@pytest.mark.parametrize("needle", ["y%*", "Y%*"])
def test_filter_for_not_substring_ignores_case_not_glob_not_like(needle: str) -> None:
    actual, _ = _where(SpanQuery().select("input.value"), f"'{needle}' not in input.value", ["234"])
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "input.value": ["xy%z*"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_for_equality_stays_case_sensitive() -> None:
    actual, _ = _where(SpanQuery().select("input.value"), "input.value == 'xy%*z'", ["456"])
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "input.value": ["xy%*z"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_nonexistent_is_not_none() -> None:
    actual, _ = _where(SpanQuery().select("name"), "opq is not None or opq.rst is not None", [])
    expected = pd.DataFrame(
        columns=["context.span_id", "name"],
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_nonexistent_is_none() -> None:
    actual, _ = _where(
        SpanQuery().select("name"),
        "opq is None or opq.rst is None",
        ["234", "345", "456", "567"],
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_latency() -> None:
    actual, _ = _where(
        SpanQuery().select("name", **_LATENCY), "9_000 < latency_ms < 11_000", ["567"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["567"],
            "name": ["llm span"],
            "Latency (milliseconds)": [10000.0],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_cumulative_token_count() -> None:
    actual, sent = _where(
        SpanQuery().select("name"),
        "290 < cumulative_token_count.total < 310 and llm.token_count.prompt is None",
        ["234"],
    )
    assert sent == (
        "290 < cumulative_llm_token_count_total < 310 and llm.token_count.prompt is None"
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "name": ["root span"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_with_arithmetic() -> None:
    actual, _ = _where(
        SpanQuery().select("metadata['a.b.c']"), "12 - metadata['a.b.c'] == -111", ["345"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata['a.b.c']": [123],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_cast_as_int() -> None:
    actual, _ = _where(
        SpanQuery().select("metadata['a.b.c']"), "12 - int(metadata['a.b.c']) == -111", ["345"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata['a.b.c']": [123],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_substring_search() -> None:
    actual, _ = _where(SpanQuery().select("metadata['1.2.3']"), "'b' in metadata['1.2.3']", ["345"])
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata['1.2.3']": ["abc"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_cast_as_str() -> None:
    actual, _ = _where(
        SpanQuery().select("metadata['1.2.3']"), "'b' in str(metadata['1.2.3'])", ["345"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata['1.2.3']": ["abc"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_using_subscript_key() -> None:
    actual, _ = _where(
        SpanQuery().select("metadata['1.2.3']"), "metadata['1.2.3'] == 'abc'", ["345"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata['1.2.3']": ["abc"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_using_subscript_keys_list_with_single_key() -> None:
    actual, _ = _where(
        SpanQuery().select("metadata[['1.2.3']]"), "metadata[['1.2.3']] == 'abc'", ["345"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata[['1.2.3']]": ["abc"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_metadata_using_subscript_keys_list_with_multiple_keys() -> None:
    actual, _ = _where(
        SpanQuery().select("metadata[['x.y', 'z.a']]"),
        "metadata[['x.y', 'z.a', 'b.c']] == 321",
        ["345"],
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "metadata[['x.y', 'z.a']]": [{"b.c": 321}],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_attribute_using_subscript_key() -> None:
    actual, _ = _where(
        SpanQuery().select("attributes['attributes']"),
        "attributes['attributes'] == 'attributes'",
        ["456"],
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "attributes['attributes']": ["attributes"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_attribute_using_subscript_keys_list_with_single_key() -> None:
    actual, _ = _where(
        SpanQuery().select("attributes[['attributes']]"),
        "attributes[['attributes']] == 'attributes'",
        ["456"],
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "attributes[['attributes']]": ["attributes"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_attribute_using_subscript_keys_list_with_multiple_keys() -> None:
    actual, _ = _where(
        SpanQuery().select("attributes[['attributes', 'attributes']]"),
        "attributes[['attributes', 'attributes']] == 'attributes'",
        ["567"],
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["567"],
            "attributes[['attributes', 'attributes']]": ["attributes"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_span_id_single() -> None:
    actual, _ = _where(SpanQuery().select("embedding.model_name"), "span_id == '345'", ["345"])
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "embedding.model_name": ["xyz"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_span_id_multiple() -> None:
    actual, _ = _where(
        SpanQuery().select("embedding.model_name"), "span_id in ['345', '567']", ["345", "567"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "567"],
            "embedding.model_name": ["xyz", None],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_trace_id_single() -> None:
    actual, _ = _where(
        SpanQuery().select("trace_id"), "trace_id == '012'", ["234", "345", "456", "567"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "context.trace_id": ["012", "012", "012", "012"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_filter_on_trace_id_multiple() -> None:
    actual, _ = _where(
        SpanQuery().select("trace_id"), "trace_id in ('012',)", ["234", "345", "456", "567"]
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "context.trace_id": ["012", "012", "012", "012"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


@pytest.mark.parametrize(
    "condition,expected",
    [
        ["evals['0'].score is not None", ["345", "456"]],
        ["evals['0'].score is None", ["234", "567"]],
        ["evals['0'].score == 0", ["345"]],
        ["evals['0'].score != 0", ["456"]],
        ["evals['0'].score != 0 or evals['0'].score is None", ["234", "456", "567"]],
        ["evals['1'].label is not None", ["456", "567"]],
        ["evals['1'].label is None", ["234", "345"]],
        ["evals['1'].label == '1'", ["456"]],
        ["evals['1'].label != '1'", ["567"]],
        ["evals['1'].label != '1' or evals['1'].label is None", ["234", "345", "567"]],
        ["evals['0'].score is not None or evals['1'].label is not None", ["345", "456", "567"]],
        ["evals['0'].score is None or evals['1'].label is None", ["234", "345", "567"]],
        ["evals['0'].score == 0 or evals['1'].label == '1'", ["345", "456"]],
        ["evals['0'].score != 0 or evals['1'].label != '1'", ["456", "567"]],
        ["evals['0'].score is not None or evals['1'].label is None", ["234", "345", "456"]],
        ["evals['0'].score is None or evals['1'].label is not None", ["234", "456", "567"]],
        ["evals['0'].score == 0 or evals['1'].label != '1'", ["345", "567"]],
        ["evals['0'].score != 0 or evals['1'].label == '1'", ["456"]],
        ["evals['0']", ["345", "456"]],
        ["annotations['0']", ["345", "456"]],
        ["evals['1']", ["456", "567"]],
        ["annotations['1']", ["456", "567"]],
    ],
)
def test_filter_on_span_annotation(condition: str, expected: list[str]) -> None:
    actual, sent = _where(SpanQuery().select("span_id"), condition, expected)
    assert sent == condition
    assert sorted(actual.index) == expected


def test_explode_embeddings_no_select() -> None:
    actual, _ = _export(SpanQuery().explode("embedding.embeddings"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "345"],
            "position": [0, 1],
            "embedding.text": ["123", "234"],
            "embedding.vector": [[1, 2, 3], [2, 3, 4]],
        }
    ).set_index(["context.span_id", "position"])
    _assert_same_frame(actual, expected)


def test_explode_embeddings_with_select_and_no_kwargs() -> None:
    actual, _ = _export(SpanQuery().select("embedding.model_name").explode("embedding.embeddings"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "345"],
            "position": [0, 1],
            "embedding.model_name": ["xyz", "xyz"],
            "embedding.text": ["123", "234"],
            "embedding.vector": [[1, 2, 3], [2, 3, 4]],
        }
    ).set_index(["context.span_id", "position"])
    _assert_same_frame(actual, expected)


def test_explode_documents_no_select() -> None:
    actual, _ = _export(
        SpanQuery().explode(_DOCUMENTS, content="document.content", score="document.score")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "content": ["A", "B", "C"],
            "score": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_explode_documents_with_select_and_non_ascii_kwargs() -> None:
    actual, _ = _export(
        SpanQuery()
        .select("trace_id")
        .explode(_DOCUMENTS, **{"콘텐츠": "document.content", "スコア": "document.score"})
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "context.trace_id": ["012", "012", "012"],
            "콘텐츠": ["A", "B", "C"],
            "スコア": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_explode_documents_keeps_the_position_of_empty_documents() -> None:
    actual, _ = _export(
        SpanQuery().explode(_DOCUMENTS, content="document.content", score="document.score"),
        rows=DEFAULT_PROJECT_ROWS,
        project_name=None,
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["4567", "5678", "5678", "6789", "6789", "6789"],
            "document_position": [0, 0, 1, 0, 1, 2],
            "content": ["A", None, "B", None, None, "C"],
            "score": [1.0, None, 2.0, None, None, 3.0],
        }
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_concat_documents_no_select() -> None:
    actual, _ = _export(SpanQuery().concat(_DOCUMENTS, content="document.content"))
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "content": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_concat_documents_no_select_but_no_data() -> None:
    actual, _ = _export(
        SpanQuery().concat(_DOCUMENTS, content="document.content"), project_name="opq"
    )
    expected = pd.DataFrame(
        columns=["context.span_id", "content"],
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_concat_documents_with_select() -> None:
    actual, _ = _export(
        SpanQuery().select("trace_id").concat(_DOCUMENTS, content="document.content")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "context.trace_id": ["012"],
            "content": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_concat_documents_with_select_but_no_data() -> None:
    actual, _ = _export(
        SpanQuery().select("trace_id").concat(_DOCUMENTS, content="document.content"),
        project_name="opq",
    )
    expected = pd.DataFrame(
        columns=["context.span_id", "content", "context.trace_id"],
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_concat_documents_with_select_but_with_typo_in_array_name() -> None:
    actual, _ = _export(
        SpanQuery().select("trace_id").concat("retriever.documents", content="document.content")
    )
    expected = pd.DataFrame(
        columns=["context.span_id", "content", "context.trace_id"],
    ).set_index("context.span_id")
    _assert_same_frame(actual, expected)


def test_concat_documents_with_select_and_non_default_separator() -> None:
    actual, _ = _export(
        SpanQuery()
        .with_index("name")
        .with_concat_separator(",")
        .concat("embedding.embeddings", text="embedding.text")
    )
    expected = pd.DataFrame(
        {
            "name": ["embedding span"],
            "text": ["123,234"],
        }
    ).set_index("name")
    _assert_same_frame(actual, expected)


def test_explode_and_concat_on_same_array() -> None:
    actual, _ = _export(
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode(_DOCUMENTS, score="document.score")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "content": ["A\n\nB\n\nC", "A\n\nB\n\nC", "A\n\nB\n\nC"],
            "score": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_explode_and_concat_on_same_array_but_no_data() -> None:
    actual, _ = _export(
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode(_DOCUMENTS, score="document.score"),
        project_name="opq",
    )
    expected = pd.DataFrame(
        columns=[
            "context.span_id",
            "document_position",
            "content",
            "score",
        ]
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_explode_and_concat_on_same_array_with_same_label() -> None:
    """The concatenated value wins the shared label, as the legacy SQLite export had it."""
    actual, _ = _export(
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode(_DOCUMENTS, content="document.content")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "content": ["A\n\nB\n\nC", "A\n\nB\n\nC", "A\n\nB\n\nC"],
        }
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_explode_and_concat_on_same_array_but_with_typo_in_concat_array_name() -> None:
    actual, _ = _export(
        SpanQuery()
        .concat("retriever.documents", content="document.content")
        .explode(_DOCUMENTS, score="document.score")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "content": [None, None, None],
            "score": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    _assert_same_frame(actual, expected)


def test_explode_and_concat_on_same_array_but_with_typo_in_explode_array_name() -> None:
    """A span without the exploded array is dropped, so nothing is left to concatenate.

    The legacy SQLite export kept the concatenated row under a single-level index here,
    while its PostgreSQL counterpart never did; the client follows PostgreSQL.
    """
    actual, _ = _export(
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode("retriever.documents", score="document.score")
    )
    expected = pd.DataFrame(
        columns=["context.span_id", "position", "content", "score"],
    ).set_index(["context.span_id", "position"])
    _assert_same_frame(actual, expected)
