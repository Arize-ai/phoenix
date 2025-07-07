import sys
from contextlib import ExitStack
from secrets import token_hex
from time import sleep
from typing import Any, List, Optional

import pytest
from openinference.semconv.trace import SpanAttributes
from opentelemetry.trace import Span, format_span_id, use_span
from opentelemetry.util.types import AttributeValue
from pytest import param

from .._helpers import _AppInfo, _get, _gql, _grpc_span_exporter, _start_span


@pytest.mark.skipif(sys.platform == "win32", reason="FIXME: unclear why it fails")
class TestProjectSessions:
    @pytest.mark.parametrize(
        "session_id",
        [
            param(0, id="integer"),
            param(3.14, id="float"),
            param(True, id="bool"),
            param("abc", id="string"),
            param(" a b c ", id="string with extra spaces"),
            param(" ", id="empty string"),
            param([1, 2], id="list of integers"),
            param([1.1, 2.2], id="list of floats"),
            param([True, False], id="list of bools"),
            param(["a", "b"], id="list of strings"),
            param([], id="empty list"),
        ],
    )
    async def test_span_ingestion_with_session_id(
        self,
        session_id: AttributeValue,
        _app: _AppInfo,
    ) -> None:
        # remove extra whitespaces
        str_session_id = str(session_id).strip()
        num_traces, num_spans_per_trace = 2, 3
        assert num_traces > 1 and num_spans_per_trace > 2
        project_names = []
        spans: List[Span] = []
        for _ in range(num_traces):
            project_names.append(token_hex(8))
            with ExitStack() as stack:
                for i in range(num_spans_per_trace):
                    if i == 0:
                        # Session ID doesn't have to be on the root span.
                        attributes = {}
                    else:
                        attributes = {SpanAttributes.SESSION_ID: session_id}
                    span = _start_span(
                        project_name=project_names[-1],
                        exporter=_grpc_span_exporter(_app),
                        attributes=attributes,
                    )
                    spans.append(span)
                    stack.enter_context(use_span(span, end_on_exit=True))
                    sleep(0.001)
        assert len(spans) == num_traces * num_spans_per_trace
        project_name = project_names[0]

        def query_fn() -> Optional[dict[str, Any]]:
            res, *_ = _gql(
                _app,
                query="query{"
                "projects(first: 1000){edges{node{name "
                "spans(first: 1000){edges{node{id}}} "
                "sessions(first: 1000){edges{node{sessionId "
                "traces(first: 1000){edges{node{"
                "spans(first: 1000){edges{node{context{spanId}}}}}}}}}}}}}}",
            )
            if num_spans_per_trace != sum(
                len(project["node"]["spans"]["edges"])
                for project in res["data"]["projects"]["edges"]
                if project["node"]["name"] == project_name
            ):
                return None
            if not str_session_id:
                return res
            if num_traces != sum(
                len(session["node"]["traces"]["edges"])
                for project in res["data"]["projects"]["edges"]
                for session in project["node"]["sessions"]["edges"]
                if project["node"]["name"] == project_name
            ):
                return None
            if len(spans) != sum(
                len(trace["node"]["spans"]["edges"])
                for project in res["data"]["projects"]["edges"]
                for session in project["node"]["sessions"]["edges"]
                for trace in session["node"]["traces"]["edges"]
                if project["node"]["name"] == project_name
            ):
                return None
            return res

        res = await _get(query_fn)
        sessions_by_project = {
            edge["node"]["name"]: {
                session["node"]["sessionId"]: session
                for session in edge["node"]["sessions"]["edges"]
            }
            for edge in res["data"]["projects"]["edges"]
            if edge["node"]["name"] == project_name
        }
        sessions_by_id = sessions_by_project.get(project_name)
        if not str_session_id:
            assert not sessions_by_id
            return
        assert sessions_by_id
        assert (session := sessions_by_id.get(str_session_id))
        assert (traces := [edge["node"] for edge in session["node"]["traces"]["edges"]])
        assert len(traces) == num_traces
        gql_spans = [edge["node"] for trace in traces for edge in trace["spans"]["edges"]]
        assert len(gql_spans) == len(spans)
        expected_span_ids = {format_span_id(span.get_span_context().span_id) for span in spans}
        assert {span["context"]["spanId"] for span in gql_spans} == expected_span_ids
