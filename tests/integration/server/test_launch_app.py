import json
import os
from secrets import token_hex
from time import sleep

import pandas as pd
import phoenix as px
from faker import Faker
from opentelemetry.trace import format_span_id, format_trace_id
from pandas.core.dtypes.common import is_datetime64_any_dtype
from phoenix.trace.dsl import SpanQuery

from .._helpers import (
    _get_gql_spans,
    _grpc_span_exporter,
    _http_span_exporter,
    _server,
    _start_span,
)


class TestLaunchApp:
    def test_send_spans(self, _fake: Faker) -> None:
        if (url := os.environ.get("PHOENIX_SQL_DATABASE_URL")) and ":memory:" in url:
            # This test is not intended for an in-memory databases.
            os.environ.pop("PHOENIX_SQL_DATABASE_URL", None)
        project_name = _fake.unique.pystr()
        span_names: set[str] = set()
        spans = []
        for i in range(2):
            with _server():
                for j, exporter in enumerate([_http_span_exporter, _grpc_span_exporter]):
                    span_name = f"{i}_{j}_{token_hex(8)}"
                    span_names.add(span_name)
                    spans.append(
                        _start_span(
                            project_name=project_name,
                            span_name=span_name,
                            exporter=exporter(),
                            attributes={
                                "j": j if j % 2 else f"{j}",
                                "metadata": json.dumps({"j": j if j % 2 else {f"{j}": [j]}}),
                            },
                        )
                    )
                    spans[-1].end()
                sleep(2)
                project = _get_gql_spans(None, "name")[project_name]
                gql_span_names = set(span["name"] for span in project)
                assert gql_span_names == span_names

                q = SpanQuery()
                results = px.Client().query_spans(q, q, project_name=project_name)
                assert isinstance(results, list)
                assert len(results) == 2
                for df in results:
                    assert isinstance(df, pd.DataFrame)
                    assert df.size
                    assert sorted(df.name) == sorted(span_names)
                    assert is_datetime64_any_dtype(df.start_time)
                    assert df.index.names == ["context.span_id"]
                    assert set(df.index) == {
                        format_span_id(span.get_span_context().span_id) for span in spans
                    }
                    assert set(df.loc[:, "context.trace_id"]) == {
                        format_trace_id(span.get_span_context().trace_id) for span in spans
                    }
                    assert set(df.parent_id) == {None}
                    assert set(df.loc[:, "attributes.j"]) == {"0", 1}
                    assert df.reset_index(drop=True).sort_values("start_time").loc[
                        :, "attributes.metadata"
                    ].to_list() == [
                        {"j": {"0": [0]}},
                        {"j": 1},
                    ] * (i + 1)
