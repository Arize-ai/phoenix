import gzip
from datetime import datetime
from typing import cast
from urllib.parse import urljoin
from uuid import uuid4

import pandas as pd
import pyarrow as pa
import pytest
import responses
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from pandas.testing import assert_frame_equal
from phoenix.session.client import Client
from phoenix.trace import SpanEvaluations
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.trace_dataset import TraceDataset


def test_base_path(monkeypatch: pytest.MonkeyPatch):
    # Reset environment variables
    monkeypatch.delenv("PHOENIX_HOST", False)
    monkeypatch.delenv("PHOENIX_PORT", False)
    monkeypatch.delenv("PHOENIX_COLLECTOR_ENDPOINT", False)

    # Test that host and port environment variables are interpreted correctly
    monkeypatch.setenv("PHOENIX_HOST", "my-host")
    monkeypatch.setenv("PHOENIX_PORT", "1234")
    client = Client()
    assert client._base_url == "http://my-host:1234/"

    # Test that a collector endpoint environment variables takes precedence
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "http://my-collector-endpoint/with/prefix")
    client = Client()
    assert client._base_url == "http://my-collector-endpoint/with/prefix/"

    # Test a given endpoint takes precedence over environment variables
    endpoint = "https://other-collector-endpoint/with/other/prefix"
    client = Client(endpoint=endpoint)
    assert client._base_url == "https://other-collector-endpoint/with/other/prefix/"


@responses.activate
def test_get_spans_dataframe(client: Client, endpoint: str, dataframe: pd.DataFrame):
    url = urljoin(endpoint, "v1/spans")

    responses.post(url, body=_df_to_bytes(dataframe))
    df = client.get_spans_dataframe()
    assert_frame_equal(df, dataframe)

    responses.post(url, status=404)
    assert client.get_spans_dataframe() is None


@responses.activate
def test_query_spans(client: Client, endpoint: str, dataframe: pd.DataFrame):
    df0, df1 = dataframe.iloc[:1, :], dataframe.iloc[1:, :]
    url = urljoin(endpoint, "v1/spans")

    responses.post(url, body=b"".join([_df_to_bytes(df0), _df_to_bytes(df1)]))
    query = SpanQuery()
    dfs = client.query_spans(query, query)
    assert len(dfs) == 2
    assert_frame_equal(dfs[0], df0)
    assert_frame_equal(dfs[1], df1)

    responses.post(url, status=404)
    assert client.query_spans(query) is None

    responses.post(url, body=_df_to_bytes(df0))
    assert_frame_equal(client.query_spans(query), df0)

    responses.post(url, body=_df_to_bytes(df1))
    assert_frame_equal(client.query_spans(), df1)


@responses.activate
def test_get_evaluations(client: Client, endpoint: str, evaluations: SpanEvaluations):
    url = urljoin(endpoint, "v1/evaluations")

    table = evaluations.to_pyarrow_table()
    responses.get(url, body=_table_to_bytes(table))
    results = client.get_evaluations()
    assert len(results) == 1
    assert isinstance(results[0], SpanEvaluations)
    assert results[0].eval_name == evaluations.eval_name
    assert_frame_equal(results[0].dataframe, evaluations.dataframe)

    responses.get(url, status=404)
    assert client.get_evaluations() == []


@responses.activate
def test_log_traces_sends_oltp_spans(client: Client, endpoint: str, trace_ds: TraceDataset):
    span_counter = 0

    def request_callback(request):
        assert request.headers["content-type"] == "application/x-protobuf"
        assert request.headers["content-encoding"] == "gzip"
        body = gzip.decompress(request.body)
        req = ExportTraceServiceRequest()
        req.ParseFromString(body)
        nonlocal span_counter
        span_counter += 1
        return 200, {}, ""

    url = urljoin(endpoint, "v1/traces")
    responses.add_callback(
        responses.POST,
        url,
        callback=request_callback,
        content_type="application/json",
    )
    client.log_traces(trace_dataset=trace_ds)
    assert span_counter == len(trace_ds.dataframe)


@responses.activate
def test_log_traces_to_project(client: Client, endpoint: str, trace_ds: TraceDataset):
    span_counter = 0

    def request_callback(request):
        assert request.headers["content-type"] == "application/x-protobuf"
        assert request.headers["content-encoding"] == "gzip"
        body = gzip.decompress(request.body)
        req = ExportTraceServiceRequest()
        req.ParseFromString(body)
        resource_spans = req.resource_spans
        assert len(resource_spans) == 1
        resource = resource_spans[0].resource
        assert resource.attributes[0].key == "openinference.project.name"
        assert resource.attributes[0].value.string_value == "special-project"
        nonlocal span_counter
        span_counter += 1
        return 200, {}, ""

    url = urljoin(endpoint, "v1/traces")
    responses.add_callback(
        responses.POST,
        url,
        callback=request_callback,
        content_type="application/json",
    )
    client.log_traces(trace_dataset=trace_ds, project_name="special-project")
    assert span_counter == len(trace_ds.dataframe)


@pytest.fixture
def dataframe() -> pd.DataFrame:
    return pd.DataFrame({"a": [1, 2], "b": [3, 4]}, index=["x", "y"])


@pytest.fixture
def trace_ds() -> TraceDataset:
    num_records = 5
    traces_df = pd.DataFrame(
        {
            "name": [f"name_{index}" for index in range(num_records)],
            "span_kind": ["LLM" for index in range(num_records)],
            "parent_id": [None for index in range(num_records)],
            "start_time": [datetime.now() for index in range(num_records)],
            "end_time": [datetime.now() for index in range(num_records)],
            "message": [f"message_{index}" for index in range(num_records)],
            "status_code": ["OK" for index in range(num_records)],
            "status_message": ["" for index in range(num_records)],
            "context.trace_id": [str(uuid4()) for index in range(num_records)],
            "context.span_id": [str(uuid4()) for index in range(num_records)],
        }
    )
    return TraceDataset(traces_df)


@pytest.fixture
def evaluations() -> SpanEvaluations:
    return SpanEvaluations(
        eval_name="test",
        dataframe=pd.DataFrame(
            {"score": [3, 4]},
            index=pd.Index(["x", "y"], name="span_id"),
        ),
    )


def _df_to_bytes(df: pd.DataFrame) -> bytes:
    return _table_to_bytes(pa.Table.from_pandas(df))


def _table_to_bytes(table: pa.Table) -> bytes:
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table, max_chunksize=65536)
    return cast(bytes, sink.getvalue().to_pybytes())


@pytest.fixture
def endpoint() -> str:
    return "http://localhost:6006"


@pytest.fixture
def client(endpoint: str) -> Client:
    return Client(endpoint=endpoint)
