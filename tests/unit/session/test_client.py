import gzip
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.parse import urljoin
from uuid import uuid4

import httpx
import pandas as pd
import pyarrow as pa
import pytest
from httpx import Request, Response
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from pandas.testing import assert_frame_equal
from respx import MockRouter
from strawberry.relay import GlobalID

from phoenix.session.client import Client, TimeoutError
from phoenix.trace import SpanEvaluations
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.trace_dataset import TraceDataset


def test_base_path(monkeypatch: pytest.MonkeyPatch) -> None:
    # Reset environment variables
    monkeypatch.delenv("PHOENIX_HOST", False)
    monkeypatch.delenv("PHOENIX_PORT", False)
    monkeypatch.delenv("PHOENIX_COLLECTOR_ENDPOINT", False)

    # Test that host and port environment variables are interpreted correctly
    monkeypatch.setenv("PHOENIX_HOST", "my-host")
    monkeypatch.setenv("PHOENIX_PORT", "1234")
    client = Client()
    assert client._client.base_url == "http://my-host:1234"

    # Test that a collector endpoint environment variables takes precedence
    monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "http://my-collector-endpoint/with/prefix")
    client = Client()
    assert client._client.base_url == "http://my-collector-endpoint/with/prefix/"

    # Test a given endpoint takes precedence over environment variables
    endpoint = "https://other-collector-endpoint/with/other/prefix"
    client = Client(endpoint=endpoint)
    assert client._client.base_url == "https://other-collector-endpoint/with/other/prefix/"


def test_get_spans_dataframe(
    client: Client, endpoint: str, dataframe: pd.DataFrame, respx_mock: MockRouter
) -> None:
    url = urljoin(endpoint, "v1/spans")

    respx_mock.post(url).mock(Response(200, content=_df_to_bytes(dataframe)))
    assert (df := client.get_spans_dataframe()) is not None
    assert_frame_equal(df, dataframe)

    respx_mock.post(url).mock(Response(404))
    assert client.get_spans_dataframe() is None


def test_query_spans(
    client: Client,
    endpoint: str,
    dataframe: pd.DataFrame,
    respx_mock: MockRouter,
) -> None:
    df0, df1 = dataframe.iloc[:1, :], dataframe.iloc[1:, :]
    url = urljoin(endpoint, "v1/spans")

    respx_mock.post(url).mock(
        Response(200, content=b"".join([_df_to_bytes(df0), _df_to_bytes(df1)]))
    )
    query = SpanQuery()
    assert isinstance(dfs := client.query_spans(query, query), list)
    assert len(dfs) == 2
    assert_frame_equal(dfs[0], df0)
    assert_frame_equal(dfs[1], df1)

    respx_mock.post(url).mock(Response(404))
    assert client.query_spans(query) is None

    respx_mock.post(url).mock(Response(200, content=_df_to_bytes(df0)))
    assert isinstance(df := client.query_spans(query), pd.DataFrame)
    assert_frame_equal(df, df0)

    respx_mock.post(url).mock(Response(200, content=_df_to_bytes(df1)))
    assert isinstance(df := client.query_spans(query), pd.DataFrame)
    assert_frame_equal(df, df1)


def test_query_spans_raises_custom_error_with_instructions_to_increase_timeout_parameter_on_timeout(
    client: Client,
    endpoint: str,
    dataframe: pd.DataFrame,
) -> None:
    query = SpanQuery()
    with patch("httpx.Client.post", side_effect=httpx.ReadTimeout("timeout")):
        with pytest.raises(TimeoutError, match="`timeout` parameter"):
            client.query_spans(query, query)


def test_get_evaluations(
    client: Client,
    endpoint: str,
    evaluations: SpanEvaluations,
    respx_mock: MockRouter,
) -> None:
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
) -> None:
    span_counter = 0

    def request_callback(request: Request) -> Response:
        assert request.headers["content-type"] == "application/x-protobuf"
        assert request.headers["content-encoding"] == "gzip"
        content = gzip.decompress(request.content)
        req = ExportTraceServiceRequest()
        req.ParseFromString(content)
        nonlocal span_counter
        span_counter += 1
        return Response(200)

    url = urljoin(endpoint, "v1/traces")
    respx_mock.post(url).mock(side_effect=request_callback)
    client.log_traces(trace_dataset=trace_ds)
    assert span_counter == len(trace_ds.dataframe)


def test_log_traces_to_project(
    client: Client,
    endpoint: str,
    trace_ds: TraceDataset,
    respx_mock: MockRouter,
) -> None:
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
    data = [
        {
            "version_id": "version-id-1",
            "description": "description-1",
            "created_at": "2024-07-23T17:32:06.646881+00:00",  # more precise timestamp
        },
        {
            "version_id": "version-id-2",
            "description": "description-2",
            "created_at": "2024-07-23T17:32:01+00:00",  # less precise timestamp
        },
    ]
    respx_mock.get(url).mock(
        Response(
            200,
            headers={"content-type": "application/json"},
            json={"next_cursor": "123", "data": data},
        )
    )

    # create a dataframe from the data
    expected = pd.DataFrame.from_records(
        [
            {
                "version_id": "version-id-1",
                "description": "description-1",
                "created_at": datetime(2024, 7, 23, 17, 32, 6, 646881, tzinfo=timezone.utc),
            },
            {
                "version_id": "version-id-2",
                "description": "description-2",
                "created_at": datetime(2024, 7, 23, 17, 32, 1, tzinfo=timezone.utc),
            },
        ],
        index="version_id",
    )
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


@pytest.mark.parametrize(
    "version_id",
    [
        pytest.param(str(GlobalID("DatasetVersion", str(1))), id="with-version-id"),
        pytest.param(None, id="without-version-id"),
    ],
)
def test_get_dataset_returns_expected_dataset(
    version_id: str,
    client: Client,
    endpoint: str,
    respx_mock: MockRouter,
) -> None:
    dataset_id = str(GlobalID("Dataset", str(1)))
    respx_mock.get(urljoin(endpoint, f"v1/datasets/{dataset_id}/examples")).mock(
        Response(
            200,
            json={
                "data": {
                    "dataset_id": str(GlobalID("Dataset", str(1))),
                    "version_id": str(GlobalID("DatasetVersion", str(1))),
                    "examples": [
                        {
                            "id": str(GlobalID("DatasetExample", str(1))),
                            "input": {"input": "input"},
                            "output": {"output": "output"},
                            "metadata": {"example-metadata-key": "example-metadata-value"},
                            "updated_at": "2024-06-12T22:46:31+00:00",
                        }
                    ],
                },
            },
        )
    )
    dataset = client.get_dataset(id=dataset_id, version_id=version_id)
    assert dataset.id == dataset_id
    assert dataset.version_id == str(GlobalID("DatasetVersion", str(1)))
    assert dataset.examples
    assert (example := next(iter(dataset.examples.values()), None)) is not None
    assert example.id == str(GlobalID("DatasetExample", str(1)))
    assert example.input == {"input": "input"}
    assert example.output == {"output": "output"}
    assert example.metadata == {"example-metadata-key": "example-metadata-value"}
    assert example.updated_at == datetime.fromisoformat("2024-06-12T22:46:31+00:00")


def test_client_headers(endpoint: str, respx_mock: MockRouter) -> None:
    client = Client(endpoint=endpoint, headers={"x-api-key": "my-api-key"})
    dataset_id = str(GlobalID("Dataset", str(1)))
    respx_mock.get(urljoin(endpoint, f"v1/datasets/{dataset_id}/examples")).mock(
        Response(
            200,
            json={
                "data": {
                    "dataset_id": str(GlobalID("Dataset", str(1))),
                    "version_id": str(GlobalID("DatasetVersion", str(1))),
                    "examples": [
                        {
                            "id": str(GlobalID("DatasetExample", str(1))),
                            "input": {"input": "input"},
                            "output": {"output": "output"},
                            "metadata": {"example-metadata-key": "example-metadata-value"},
                            "updated_at": "2024-06-12T22:46:31+00:00",
                        }
                    ],
                },
            },
        )
    )

    client.get_dataset(id=dataset_id)
    # Ensure that the client headers are passed to the request
    assert respx_mock.calls[0].request.headers["x-api-key"] == "my-api-key"


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
    return sink.getvalue().to_pybytes()


@pytest.fixture
def endpoint() -> str:
    return "http://localhost:6006"


@pytest.fixture
def client(endpoint: str) -> Client:
    return Client(endpoint=endpoint)
