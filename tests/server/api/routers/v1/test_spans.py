from asyncio import sleep
from random import getrandbits
from typing import Any, Awaitable, Callable, cast

import pandas as pd
import pytest
from phoenix import Client, TraceDataset
from phoenix.trace.dsl import SpanQuery


async def test_span_round_tripping_with_docs(
    px_client: Client,
    dialect: str,
    span_data_with_documents: Any,
    acall: Callable[..., Awaitable[Any]],
) -> None:
    if dialect == "postgresql":
        pytest.xfail("undiagnosed async error")
    df = cast(pd.DataFrame, await acall(px_client.get_spans_dataframe))
    new_ids = {span_id: getrandbits(64).to_bytes(8, "big").hex() for span_id in df.index}
    for span_id_col_name in ("context.span_id", "parent_id"):
        df.loc[:, span_id_col_name] = df.loc[:, span_id_col_name].map(new_ids.get)
    df = df.set_index("context.span_id", drop=False)
    doc_query = SpanQuery().explode("retrieval.documents", content="document.content")
    orig_docs = cast(pd.DataFrame, await acall(px_client.query_spans, doc_query))
    orig_count = len(orig_docs)
    assert orig_count
    await acall(px_client.log_traces, TraceDataset(df))
    await sleep(0.01)
    docs = cast(pd.DataFrame, await acall(px_client.query_spans, doc_query))
    new_count = len(docs)
    assert new_count
    assert new_count == orig_count * 2
