from asyncio import gather, sleep
from itertools import chain
from typing import Any, Awaitable, Callable, Iterator, List, Union, cast, get_args

import pandas as pd
from faker import Faker
from phoenix import Client, TraceDataset
from phoenix.trace import DocumentEvaluations, SpanEvaluations, TraceEvaluations
from typing_extensions import TypeAlias, assert_never

_Evals: TypeAlias = Union[SpanEvaluations, TraceEvaluations, DocumentEvaluations]


async def test_sending_evaluations_before_span(
    px_client: Client,
    span_data_with_documents: Any,
    acall: Callable[..., Awaitable[Any]],
    fake: Faker,
    rand_span_id: Iterator[str],
    rand_trace_id: Iterator[str],
) -> None:
    size = 3
    eval_names = [fake.pystr() for _ in range(size)]
    project_names = [fake.pystr() for _ in range(size)]
    span = cast(pd.DataFrame, await acall(px_client.get_spans_dataframe)).iloc[:1]
    span_ids, trace_ids, traces = {}, {}, {}
    for project_name in project_names:
        span_ids[project_name] = sorted(next(rand_span_id) for _ in range(size))
        trace_ids[project_name] = sorted(next(rand_trace_id) for _ in range(size))
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
                            chain.from_iterable(
                                [
                                    dict(score=j + s, span_id=next(rand_span_id)),
                                    dict(score=j + s, span_id=span_id),
                                ]
                                for j, span_id in enumerate(span_ids[project_name])
                            )
                        ).sample(frac=1),
                    ),
                    TraceEvaluations(
                        eval_name,
                        pd.DataFrame(
                            chain.from_iterable(
                                [
                                    dict(score=j + s, trace_id=next(rand_trace_id)),
                                    dict(score=j + s, trace_id=trace_id),
                                ]
                                for j, trace_id in enumerate(trace_ids[project_name])
                            )
                        ).sample(frac=1),
                    ),
                    DocumentEvaluations(
                        eval_name,
                        pd.DataFrame(
                            chain.from_iterable(
                                [
                                    dict(score=j + s, span_id=next(rand_span_id), position=0),
                                    dict(score=j + s, span_id=span_id, position=0),
                                    dict(score=j + s, span_id=span_id, position=-1),
                                    dict(score=j + s, span_id=span_id, position=999_999_999),
                                ]
                                for j, span_id in enumerate(span_ids[project_name])
                            )
                        ).sample(frac=1),
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
                List[List[_Evals]],
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
        assert len(evals[project_name]) == len(eval_names) * len(get_args(_Evals))
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
