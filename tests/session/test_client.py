import gzip
from datetime import datetime
from io import StringIO
from typing import cast
from urllib.parse import urljoin
from uuid import uuid4

import httpx
import pandas as pd
import pyarrow as pa
import pytest
import respx
from httpx import Response
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from pandas.testing import assert_frame_equal
from phoenix.session.client import Client
from phoenix.trace import SpanEvaluations
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.trace_dataset import TraceDataset
from respx import MockRouter
from strawberry.relay import GlobalID


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


def test_get_spans_dataframe(
    client: Client, endpoint: str, dataframe: pd.DataFrame, respx_mock: MockRouter
):
    url = urljoin(endpoint, "v1/spans")

    respx_mock.post(url).mock(Response(200, content=_df_to_bytes(dataframe)))
    df = client.get_spans_dataframe()
    assert_frame_equal(df, dataframe)

    respx_mock.post(url).mock(Response(404))
    assert client.get_spans_dataframe() is None


def test_query_spans(
    client: Client,
    endpoint: str,
    dataframe: pd.DataFrame,
    respx_mock: MockRouter,
):
    df0, df1 = dataframe.iloc[:1, :], dataframe.iloc[1:, :]
    url = urljoin(endpoint, "v1/spans")

    respx_mock.post(url).mock(
        Response(200, content=b"".join([_df_to_bytes(df0), _df_to_bytes(df1)]))
    )
    query = SpanQuery()
    dfs = client.query_spans(query, query)
    assert len(dfs) == 2
    assert_frame_equal(dfs[0], df0)
    assert_frame_equal(dfs[1], df1)

    respx_mock.post(url).mock(Response(404))
    assert client.query_spans(query) is None

    respx_mock.post(url).mock(Response(200, content=_df_to_bytes(df0)))
    assert_frame_equal(client.query_spans(query), df0)

    respx_mock.post(url).mock(Response(200, content=_df_to_bytes(df1)))
    assert_frame_equal(client.query_spans(), df1)


def test_get_evaluations(
    client: Client,
    endpoint: str,
    evaluations: SpanEvaluations,
    respx_mock: MockRouter,
):
    url = urljoin(endpoint, "v1/evaluations")

    table = evaluations.to_pyarrow_table()
    respx_mock.get(url).mock(Response(200, content=_table_to_bytes(table)))
    results = client.get_evaluations()
    assert len(results) == 1
    assert isinstance(results[0], SpanEvaluations)
    assert results[0].eval_name == evaluations.eval_name
    assert_frame_equal(results[0].dataframe, evaluations.dataframe)

    respx_mock.get(url).mock(Response(404))
    assert client.get_evaluations() == []


def test_log_traces_sends_oltp_spans(
    client: Client,
    endpoint: str,
    trace_ds: TraceDataset,
    respx_mock: MockRouter,
):
    span_counter = 0

    def request_callback(request):
        assert request.headers["content-type"] == "application/x-protobuf"
        assert request.headers["content-encoding"] == "gzip"
        content = gzip.decompress(request.content)
        req = ExportTraceServiceRequest()
        req.ParseFromString(content)
        nonlocal span_counter
        span_counter += 1
        return httpx.Response(200)

    url = urljoin(endpoint, "v1/traces")
    respx_mock.post(url).mock(side_effect=request_callback)
    client.log_traces(trace_dataset=trace_ds)
    assert span_counter == len(trace_ds.dataframe)


def test_log_traces_to_project(
    client: Client,
    endpoint: str,
    trace_ds: TraceDataset,
    respx_mock: MockRouter,
):
    span_counter = 0

    def request_callback(request: httpx.Request) -> httpx.Response:
        assert request.headers["content-type"] == "application/x-protobuf"
        assert request.headers["content-encoding"] == "gzip"
        content = gzip.decompress(request.content)
        req = ExportTraceServiceRequest()
        req.ParseFromString(content)
        resource_spans = req.resource_spans
        assert len(resource_spans) == 1
        resource = resource_spans[0].resource
        assert resource.attributes[0].key == "openinference.project.name"
        assert resource.attributes[0].value.string_value == "special-project"
        nonlocal span_counter
        span_counter += 1
        return httpx.Response(200)

    url = urljoin(endpoint, "v1/traces")
    respx_mock.post(url).mock(side_effect=request_callback)
    client.log_traces(trace_dataset=trace_ds, project_name="special-project")
    assert span_counter == len(trace_ds.dataframe)


def test_get_dataset_versions(
    client: Client,
    endpoint: str,
    respx_mock: MockRouter,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(999))
    url = urljoin(endpoint, f"v1/datasets/{dataset_global_id}/versions")
    data = [{"version_id": "abc", "description": "xyz", "created_at": "2024-05-28T00:00:00+00:00"}]
    respx_mock.get(url).mock(
        Response(
            200,
            headers={"content-type": "application/json"},
            json={"next_cursor": "123", "data": data},
        )
    )
    expected = pd.DataFrame.from_records(data, index="version_id")
    expected["created_at"] = pd.to_datetime(expected.created_at)
    actual = client.get_dataset_versions(str(dataset_global_id))
    assert_frame_equal(actual, expected)


def test_get_dataset_versions_empty_data(
    client: Client,
    endpoint: str,
    respx_mock: MockRouter,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(999))
    url = urljoin(endpoint, f"v1/datasets/{dataset_global_id}/versions")
    respx_mock.get(url).mock(
        Response(
            200,
            headers={"content-type": "application/json"},
            json={"next_cursor": None, "data": []},
        )
    )
    expected = pd.DataFrame()
    actual = client.get_dataset_versions(str(dataset_global_id))
    assert_frame_equal(actual, expected)


def test_download_dataset_examples_latest_version(
    client: Client,
    endpoint: str,
    respx_mock: MockRouter,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(999))
    url = urljoin(endpoint, f"v1/datasets/{dataset_global_id}/csv")
    content = gzip.compress("example_id,a,b,c\nRGF0YXNldEV4YW1wbGU6MQ==,x,y,z\n".encode())
    respx_mock.get(url).mock(
        Response(
            200,
            content=content,
            headers={"content-type": "text/csv", "content-encoding": "gzip"},
        )
    )
    expected = pd.read_csv(
        StringIO(gzip.decompress(content).decode()),
        index_col="example_id",
    )
    actual = client.download_dataset_examples(str(dataset_global_id))
    assert_frame_equal(actual, expected)


def test_download_dataset_examples_specific_version(
    client: Client,
    endpoint: str,
    respx_mock: MockRouter,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(999))
    dataset_version_global_id = GlobalID("DatasetVersion", str(888))
    url = urljoin(
        endpoint, f"v1/datasets/{dataset_global_id}/csv?version={dataset_version_global_id}"
    )
    content = gzip.compress("example_id,a,b,c\nRGF0YXNldEV4YW1wbGU6MQ==,x,y,z\n".encode())
    respx_mock.get(url).mock(
        Response(
            200,
            content=content,
            headers={"content-type": "text/csv", "content-encoding": "gzip"},
        )
    )
    expected = pd.read_csv(
        StringIO(gzip.decompress(content).decode()),
        index_col="example_id",
    )
    actual = client.download_dataset_examples(
        str(dataset_global_id),
        dataset_version_id=str(dataset_version_global_id),
    )
    assert_frame_equal(actual, expected)


@pytest.mark.parametrize(
    "version_id",
    [
        pytest.param(str(GlobalID("DatasetVersion", str(1))), id="with-version-id"),
        pytest.param(None, id="without-version-id"),
    ],
)
@respx.mock(assert_all_called=False)
def test_get_dataset_returns_expected_dataset(
    version_id: str,
    client: Client,
    endpoint: str,
    respx_mock: MockRouter,
) -> None:
    dataset_id = str(GlobalID("Dataset", str(1)))
    respx_mock.get(urljoin(endpoint, f"v1/datasets/{dataset_id}/versions?limit=1")).mock(
        Response(
            200,
            json={
                "next_cursor": str(GlobalID("DatasetVersion", str(2))),
                "data": [
                    {
                        "version_id": str(GlobalID("DatasetVersion", str(1))),
                        "description": None,
                        "metadata": {"version-metadata-key": "version-metadata-value"},
                        "created_at": "2024-06-12T22:46:31+00:00",
                    }
                ],
            },
        )
    )
    respx_mock.get(
        urljoin(
            endpoint,
            f"v1/datasets/{dataset_id}/examples?version-id={str(GlobalID("DatasetVersion", str(1)))}",  # noqa: E501
        )
    ).mock(
        Response(
            200,
            json=[
                {
                    "id": str(GlobalID("DatasetExample", str(1))),
                    "input": {"input": "input"},
                    "output": {"output": "output"},
                    "metadata": {"example-metadata-key": "example-metadata-value"},
                    "updated_at": "2024-06-12T22:46:31+00:00",
                }
            ],
        )
    )
    dataset = client.get_dataset(dataset_id, version_id=version_id)
    assert dataset.id == dataset_id
    assert dataset.version_id == str(GlobalID("DatasetVersion", str(1)))
    assert dataset.examples
    example = dataset.examples[0]
    assert example.id == str(GlobalID("DatasetExample", str(1)))
    assert example.input == {"input": "input"}
    assert example.output == {"output": "output"}
    assert example.metadata == {"example-metadata-key": "example-metadata-value"}
    assert example.updated_at == datetime.fromisoformat("2024-06-12T22:46:31+00:00")


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
