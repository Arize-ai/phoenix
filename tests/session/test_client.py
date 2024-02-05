from typing import cast
from urllib.parse import urljoin

import pandas as pd
import pyarrow as pa
import pytest
import responses
from pandas.testing import assert_frame_equal
from phoenix.session.client import Client
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


@pytest.fixture
def dataframe() -> pd.DataFrame:
    return pd.DataFrame({"a": [1, 2], "b": [3, 4]}, index=["x", "y"])


def _df_to_bytes(df: pd.DataFrame) -> bytes:
    pa_table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, pa_table.schema) as writer:
        writer.write_table(pa_table, max_chunksize=65536)
    return cast(bytes, sink.getvalue().to_pybytes())


@pytest.fixture
def endpoint() -> str:
    return "http://localhost:6006"


@pytest.fixture
def client(endpoint: str) -> Client:
    return Client(endpoint=endpoint)
