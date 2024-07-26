from asyncio import sleep
from random import getrandbits
from typing import Any, Awaitable, Callable, List, Union, cast

import pandas as pd
from faker import Faker
from phoenix import Client, TraceDataset
from phoenix.trace import DocumentEvaluations, SpanEvaluations, TraceEvaluations
from typing_extensions import assert_never


async def test_sending_evaluations_before_span(
    px_client: Client,
    dialect: str,
    span_data_with_documents: Any,
    acall: Callable[..., Awaitable[Any]],
    fake: Faker,
) -> None:
    span = cast(pd.DataFrame, await acall(px_client.get_spans_dataframe)).iloc[:1]
    size = 100
    span_ids = sorted(getrandbits(64).to_bytes(8, "big").hex() for _ in range(size))
    trace_ids = sorted(getrandbits(128).to_bytes(16, "big").hex() for _ in range(size))
    df = pd.concat(
        [
            span.assign(**{"context.span_id": span_id, "context.trace_id": trace_id})
            for span_id, trace_id in zip(span_ids, trace_ids)
        ]
    ).set_index("context.span_id", drop=False)
    eval_name, project_name = fake.pystr(), fake.pystr()
    for i in range(10, -1, -1):
        s = i * fake.pyfloat()
        await acall(
            px_client.log_evaluations,
            SpanEvaluations(
                eval_name,
                pd.DataFrame([dict(score=j + s, span_id=_) for j, _ in enumerate(span_ids)]),
            ),
            TraceEvaluations(
                eval_name,
                pd.DataFrame([dict(score=j + s, trace_id=_) for j, _ in enumerate(trace_ids)]),
            ),
            DocumentEvaluations(
                eval_name,
                pd.DataFrame(
                    [dict(score=j + s, span_id=_, position=0) for j, _ in enumerate(span_ids)]
                    + [
                        dict(score=j + s, span_id=_, position=999_999_999)
                        for j, _ in enumerate(span_ids)
                    ]
                ),
            ),
        )
        await sleep(0.001)
    await acall(px_client.log_traces, TraceDataset(df), project_name=project_name)
    await sleep(1)
    evals = cast(
        List[Union[SpanEvaluations, TraceEvaluations, DocumentEvaluations]],
        await acall(px_client.get_evaluations, project_name=project_name),
    )
    evals = [ev for ev in evals if ev.eval_name == eval_name]
    assert len(evals) == 3
    for e in evals:
        _ = e.dataframe.sort_index()
        assert len(_) == size
        assert _.score.to_list() == list(range(size))
        if isinstance(e, SpanEvaluations):
            assert _.index.to_list() == span_ids
        elif isinstance(e, TraceEvaluations):
            assert _.index.to_list() == trace_ids
        elif isinstance(e, DocumentEvaluations):
            assert _.index.to_list() == [(span_id, 0) for span_id in span_ids]
        else:
            assert_never(e)
