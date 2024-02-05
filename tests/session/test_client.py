from typing import cast
from urllib.parse import urljoin

import pandas as pd
import pyarrow as pa
import pytest
import responses
from pandas.testing import assert_frame_equal
from phoenix.session.client import Client
from phoenix.trace import SpanEvaluations
from phoenix.trace.dsl import SpanQuery


@responses.activate
def test_get_spans_dataframe(client: Client, endpoint: str, dataframe: pd.DataFrame):
    url = urljoin(endpoint, "v1/spans")

    responses.get(url, body=_df_to_bytes(dataframe))
    df = client.get_spans_dataframe()
    assert_frame_equal(df, dataframe)

    responses.get(url, status=404)
    assert client.get_spans_dataframe() is None


@responses.activate
def test_query_spans(client: Client, endpoint: str, dataframe: pd.DataFrame):
    df0, df1 = dataframe.iloc[:1, :], dataframe.iloc[1:, :]
    url = urljoin(endpoint, "v1/spans")

    responses.get(url, body=b"".join([_df_to_bytes(df0), _df_to_bytes(df1)]))
    query = SpanQuery()
    dfs = client.query_spans(query, query)
    assert len(dfs) == 2
    assert_frame_equal(dfs[0], df0)
    assert_frame_equal(dfs[1], df1)

    responses.get(url, status=404)
    assert client.query_spans(query) is None

    responses.get(url, body=_df_to_bytes(df0))
    assert_frame_equal(client.query_spans(query), df0)

    responses.get(url, body=_df_to_bytes(df1))
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


@pytest.fixture
def dataframe() -> pd.DataFrame:
    return pd.DataFrame({"a": [1, 2], "b": [3, 4]}, index=["x", "y"])


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
