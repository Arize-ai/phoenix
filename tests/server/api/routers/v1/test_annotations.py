from asyncio import gather, sleep
from random import getrandbits
from typing import Any, Awaitable, Callable, List, Union, cast

import pandas as pd
from faker import Faker
from phoenix import Client, TraceDataset
from phoenix.trace import DocumentEvaluations, SpanEvaluations, TraceEvaluations
from typing_extensions import assert_never


async def test_sending_evaluations_before_span(
    px_client: Client,
    span_data_with_documents: Any,
    acall: Callable[..., Awaitable[Any]],
    fake: Faker,
) -> None:
    size = 3
    eval_names = [fake.city() for _ in range(size)]
    project_names = [fake.company() for _ in range(size)]
    span_ids, trace_ids, traces = {}, {}, {}
    span = cast(pd.DataFrame, await acall(px_client.get_spans_dataframe)).iloc[:1]
    for project_name in project_names:
        span_ids[project_name] = sorted(
            getrandbits(64).to_bytes(8, "big").hex() for _ in range(size)
        )
        trace_ids[project_name] = sorted(
            getrandbits(128).to_bytes(16, "big").hex() for _ in range(size)
        )
        traces[project_name] = pd.concat(
            [
                span.assign(**{"context.span_id": span_id, "context.trace_id": trace_id})
                for span_id, trace_id in zip(span_ids[project_name], trace_ids[project_name])
            ]
        ).set_index("context.span_id", drop=False)
    for i in range(size - 1, -1, -1):
        s = i * fake.pyfloat()
        await gather(
            sleep(0.001),
            *(
                acall(
                    px_client.log_evaluations,
                    SpanEvaluations(
                        eval_name,
                        pd.DataFrame(
                            [
                                dict(score=j + s, span_id=span_id)
                                for j, span_id in enumerate(span_ids[project_name])
                            ]
                        ),
                    ),
                    TraceEvaluations(
                        eval_name,
                        pd.DataFrame(
                            [
                                dict(score=j + s, trace_id=trace_id)
                                for j, trace_id in enumerate(trace_ids[project_name])
                            ]
                        ),
                    ),
                    DocumentEvaluations(
                        eval_name,
                        pd.DataFrame(
                            [
                                dict(score=j + s, span_id=span_id, position=0)
                                for j, span_id in enumerate(span_ids[project_name])
                            ]
                            + [
                                dict(score=j + s, span_id=span_id, position=999_999_999)
                                for j, span_id in enumerate(span_ids[project_name])
                            ]
                        ),
                    ),
                )
                for eval_name in eval_names
                for project_name in project_names
            ),
        )
    await gather(
        sleep(1),
        *(
            acall(
                px_client.log_traces,
                TraceDataset(traces[project_name]),
                project_name=project_name,
            )
            for project_name in project_names
        ),
    )
    evals = dict(
        zip(
            project_names,
            cast(
                List[List[Union[SpanEvaluations, TraceEvaluations, DocumentEvaluations]]],
                await gather(
                    *(
                        acall(px_client.get_evaluations, project_name=project_name)
                        for project_name in project_names
                    )
                ),
            ),
        )
    )
    for project_name in project_names:
        assert len(evals[project_name]) == 3 * len(eval_names)
        for e in evals[project_name]:
            df = e.dataframe.sort_index()
            assert len(df) == size
            assert df.score.to_list() == list(range(size))
            if isinstance(e, SpanEvaluations):
                assert df.index.to_list() == span_ids[project_name]
            elif isinstance(e, TraceEvaluations):
                assert df.index.to_list() == trace_ids[project_name]
            elif isinstance(e, DocumentEvaluations):
                assert df.index.to_list() == [(span_id, 0) for span_id in span_ids[project_name]]
            else:
                assert_never(e)
