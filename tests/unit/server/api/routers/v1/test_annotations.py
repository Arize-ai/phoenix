from __future__ import annotations

import sys
from asyncio import gather, sleep
from datetime import datetime, timezone
from functools import partial
from itertools import product
from operator import gt, lt
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    Iterator,
    List,
    Literal,
    Set,
    Union,
    cast,
    get_args,
)

import pandas as pd
import pytest
from faker import Faker
from httpx import AsyncClient
from typing_extensions import TypeAlias, assert_never

from phoenix import Client, TraceDataset
from phoenix.trace import DocumentEvaluations, Evaluations, SpanEvaluations, TraceEvaluations


@pytest.mark.skipif(sys.platform.startswith("win"), reason="CI fails for unknown reason")
@pytest.mark.skip(reason="FIXME: this test has TimeoutError with postgresql for unknown reasons")
class TestSendingAnnotationsBeforeSpans:
    async def test_sending_annotations_before_spans(
        self,
        send_annotations: Callable[[float], Awaitable[None]],
        send_spans: Callable[[], Awaitable[None]],
        clear_all_projects: Callable[[], Awaitable[None]],
        assert_no_evals: Callable[[], Awaitable[None]],
        assert_no_summaries: Callable[[], Awaitable[None]],
        assert_eval_scores: Callable[[float], Awaitable[None]],
        assert_mean_scores: Callable[[float], Awaitable[None]],
        assert_last_updated_at: Callable[
            [Callable[[datetime, datetime], bool], datetime],
            Awaitable[None],
        ],
        dialect: str,
    ) -> None:
        if dialect == "postgresql":
            pytest.xfail("FIXME: this test has TimeoutError with postgresql")
        await send_annotations(0)
        await assert_no_evals()
        await assert_no_summaries()
        t = datetime.now(timezone.utc)
        await send_spans()
        await sleep(1)
        await assert_last_updated_at(gt, t)
        await assert_eval_scores(0)
        await assert_mean_scores(0)
        score_offset = 10
        await send_annotations(score_offset)
        await sleep(0.2)
        await assert_eval_scores(score_offset)
        await assert_mean_scores(score_offset)
        t = datetime.now(timezone.utc)
        await assert_last_updated_at(lt, t)
        await clear_all_projects()
        await sleep(0.2)
        await assert_last_updated_at(gt, t)
        await assert_no_evals()
        await assert_no_summaries()

    @staticmethod
    async def _last_updated_at(
        project_names: List[str],
        httpx_client: AsyncClient,
    ) -> Dict[str, datetime]:
        q = "query{projects{edges{node{name streamingLastUpdatedAt}}}}"
        resp = await httpx_client.post("/graphql", json=dict(query=q))
        assert resp.status_code == 200
        resp_json = resp.json()
        assert not resp_json.get("errors")
        return {
            edge["node"]["name"]: datetime.fromisoformat(edge["node"]["streamingLastUpdatedAt"])
            for edge in resp_json["data"]["projects"]["edges"]
            if edge["node"]["name"] in project_names and edge["node"]["streamingLastUpdatedAt"]
        }

    @staticmethod
    async def _mean_scores(
        httpx_client: AsyncClient,
        summary: _Summary,
        project_names: List[str],
        *names: str,
    ) -> Dict[str, Dict[str, float]]:
        ans = {}
        for name in names:
            q = "query{projects{edges{node{name " + f'{summary}Name:"{name}"' + "){meanScore}}}}}"
            resp = await httpx_client.post("/graphql", json=dict(query=q))
            assert resp.status_code == 200
            resp_json = resp.json()
            assert not resp_json.get("errors")
            ans[name] = {
                edge["node"]["name"]: edge["node"][summary.split("(")[0]]["meanScore"]
                for edge in resp_json["data"]["projects"]["edges"]
                if edge["node"]["name"] in project_names
                and edge["node"][summary.split("(")[0]] is not None
            }
        return ans

    @pytest.fixture
    async def clear_all_projects(
        self,
        httpx_client: AsyncClient,
    ) -> Callable[[], Awaitable[None]]:
        async def _() -> None:
            q = "query{projects{edges{node{id}}}}"
            resp = await httpx_client.post("/graphql", json=dict(query=q))
            assert resp.status_code == 200
            resp_json = resp.json()
            assert not resp_json.get("errors")
            for edge in resp_json["data"]["projects"]["edges"]:
                id_ = edge["node"]["id"]
                m = "mutation{clearProject(input:{id:" + f'"{id_}"' + "}){__typename}}"
                resp = await httpx_client.post("/graphql", json=dict(query=m))
                assert resp.status_code == 200
                assert not resp.json().get("errors")

        return _

    @pytest.fixture
    def send_spans(
        self,
        traces: Dict[str, TraceDataset],
        project_names: List[str],
        px_client: Client,
    ) -> Callable[[], Awaitable[None]]:
        log_traces = (
            px_client.log_traces(traces[project_name], project_name)
            for project_name in project_names
        )

        async def _() -> None:
            await gather(*log_traces)

        return _

    @pytest.fixture
    def send_annotations(
        self,
        project_names: List[str],
        eval_names: List[str],
        anno_names: List[str],
        rand_span_id: Iterator[str],
        rand_trace_id: Iterator[str],
        span_ids: Dict[str, List[str]],
        trace_ids: Dict[str, List[str]],
        traces: Dict[str, TraceDataset],
        px_client: Client,
        httpx_client: AsyncClient,
        fake: Faker,
        size: int,
    ) -> Callable[[float], Awaitable[None]]:
        def span_evaluations(s: float) -> Iterator[Dict[str, Any]]:
            for project_name in project_names:
                for j, span_id in enumerate(span_ids[project_name]):
                    yield dict(score=j + s, span_id=next(rand_span_id))
                    yield dict(score=j + s, span_id=span_id)

        def trace_evaluations(s: float) -> Iterator[Dict[str, Any]]:
            for project_name in project_names:
                for j, trace_id in enumerate(trace_ids[project_name]):
                    yield dict(score=j + s, trace_id=next(rand_trace_id))
                    yield dict(score=j + s, trace_id=trace_id)

        def document_evaluations(s: float) -> Iterator[Dict[str, Any]]:
            for project_name in project_names:
                for j, span_id in enumerate(span_ids[project_name]):
                    yield dict(score=j + s, span_id=next(rand_span_id), position=0)
                    yield dict(score=j + s, span_id=span_id, position=0)
                    yield dict(score=j + s, span_id=span_id, position=-1)
                    yield dict(score=j + s, span_id=span_id, position=999_999_999)

        def evaluations(s: float) -> Iterator[Evaluations]:
            for name, (cls, fn) in product(
                eval_names,
                zip(
                    (SpanEvaluations, TraceEvaluations, DocumentEvaluations),
                    (span_evaluations, trace_evaluations, document_evaluations),
                ),
            ):
                yield cls(name, pd.DataFrame(fn(s)).sample(frac=1))

        def kwargs(name: str, s: float) -> Dict[str, Any]:
            return dict(annotator_kind="HUMAN", metadata={}, name=name, result=dict(score=s))

        def span_annotations(s: float) -> Iterator[Dict[str, Any]]:
            for name, project_name in product(anno_names, project_names):
                for j, span_id in enumerate(span_ids[project_name]):
                    yield dict(span_id=next(rand_span_id), **kwargs(name, j + s))
                    yield dict(span_id=span_id, **kwargs(name, j + s))

        def trace_annotations(s: float) -> Iterator[Dict[str, Any]]:
            for name, project_name in product(anno_names, project_names):
                for j, trace_id in enumerate(trace_ids[project_name]):
                    yield dict(trace_id=next(rand_trace_id), **kwargs(name, j + s))
                    yield dict(trace_id=trace_id, **kwargs(name, j + s))

        async def _(score_offset: float = 0) -> None:
            for i in range(size - 1, -1, -1):
                s = i * fake.pyfloat() + score_offset
                px_client.log_evaluations(*evaluations(s))
                await gather(
                    httpx_client.post(
                        "v1/span_annotations?sync=false",
                        json=dict(data=list(span_annotations(s))),
                    ),
                    httpx_client.post(
                        "v1/trace_annotations?sync=false",
                        json=dict(data=list(trace_annotations(s))),
                    ),
                )
                await sleep(0.1)

        return _

    @pytest.fixture
    def assert_last_updated_at(
        self,
        project_names: List[str],
        httpx_client: AsyncClient,
    ) -> Callable[[Callable[[datetime, datetime], bool], datetime], Awaitable[None]]:
        async def _(compare: Callable[[datetime, datetime], bool], t: datetime) -> None:
            projects = await self._last_updated_at(project_names, httpx_client)
            for project_name in project_names:
                assert (last_updated_at := projects.get(project_name))
                assert compare(last_updated_at, t)

        return _

    @pytest.fixture
    def assert_evals(
        self,
        project_names: List[str],
        eval_names: List[str],
        anno_names: List[str],
        span_ids: Dict[str, List[str]],
        trace_ids: Dict[str, List[str]],
        traces: Dict[str, TraceDataset],
        px_client: Client,
        size: int,
    ) -> Callable[[bool, float], Awaitable[None]]:
        async def _(exist: bool, score_offset: float = 0) -> None:
            get_evaluations = (
                cast(List[_Evals], px_client.get_evaluations(project_name))
                for project_name in project_names
            )
            evals = dict(zip(project_names, await gather(*get_evaluations)))
            for project_name in project_names:
                if not exist:
                    assert not evals.get(project_name)
                    continue
                assert len(evals[project_name]) == len(eval_names) * len(get_args(_Evals))
                for e in evals[project_name]:
                    assert e.eval_name in eval_names
                    df = e.dataframe.sort_index()
                    assert len(df) == size
                    assert (df.score - score_offset).to_list() == list(range(size))
                    ids = df.index.to_list()
                    if isinstance(e, SpanEvaluations):
                        assert ids == span_ids[project_name]
                    elif isinstance(e, TraceEvaluations):
                        assert ids == trace_ids[project_name]
                    elif isinstance(e, DocumentEvaluations):
                        assert ids == [(span_id, 0) for span_id in span_ids[project_name]]
                    else:
                        assert_never(e)

        return _

    @pytest.fixture
    def assert_no_evals(
        self,
        assert_evals: Callable[[bool, float], Awaitable[None]],
    ) -> Callable[[], Awaitable[None]]:
        return partial(assert_evals, False, 0)

    @pytest.fixture
    def assert_eval_scores(
        self,
        assert_evals: Callable[[bool, float], Awaitable[None]],
    ) -> Callable[[float], Awaitable[None]]:
        return partial(assert_evals, True)

    @pytest.fixture
    def assert_summaries(
        self,
        project_names: List[str],
        eval_names: List[str],
        anno_names: List[str],
        span_ids: Dict[str, List[str]],
        trace_ids: Dict[str, List[str]],
        traces: Dict[str, TraceDataset],
        px_client: Client,
        httpx_client: AsyncClient,
        mean_score: float,
    ) -> Callable[[bool, float], Awaitable[None]]:
        async def _(exist: bool, score_offset: float = 0) -> None:
            expected = mean_score + score_offset
            summaries, names = anno_summaries, anno_names + eval_names
            for summary in summaries:
                mean_scores = await self._mean_scores(httpx_client, summary, project_names, *names)
                for name in names:
                    if not exist:
                        assert not mean_scores.get(name)
                        continue
                    assert (projects := mean_scores.get(name))
                    assert len(projects) == len(project_names)
                    for project_name in project_names:
                        actual = projects[project_name]
                        assert actual == expected

        return _

    @pytest.fixture
    def assert_mean_scores(
        self,
        assert_summaries: Callable[[bool, int], Awaitable[None]],
    ) -> Callable[[float], Awaitable[None]]:
        return partial(assert_summaries, True)

    @pytest.fixture
    def assert_no_summaries(
        self,
        assert_summaries: Callable[[bool, int], Awaitable[None]],
    ) -> Callable[[], Awaitable[None]]:
        return partial(assert_summaries, False, 0)

    @pytest.fixture
    def rand_str(self, fake: Faker) -> Iterator[str]:
        def _(seen: Set[str]) -> Iterator[str]:
            while True:
                if (name := fake.pystr()) not in seen:
                    seen.add(name)
                    yield name

        return _(set())

    @pytest.fixture
    def project_names(self, rand_str: Iterator[str], size: int) -> List[str]:
        return [f"proj_{next(rand_str)}" for _ in range(size)]

    @pytest.fixture
    def eval_names(self, rand_str: Iterator[str], size: int) -> List[str]:
        return [f"eval_{next(rand_str)}" for _ in range(size)]

    @pytest.fixture
    def anno_names(self, rand_str: Iterator[str], size: int) -> List[str]:
        return [f"anno_{next(rand_str)}" for _ in range(size)]

    @pytest.fixture
    async def span(
        self,
        px_client: Client,
        span_data_with_documents: Any,
    ) -> pd.DataFrame:
        return cast(pd.DataFrame, px_client.get_spans_dataframe()).iloc[:1]

    @pytest.fixture
    def span_ids(
        self,
        rand_span_id: Iterator[str],
        project_names: List[str],
        size: int,
    ) -> Dict[str, List[str]]:
        return {
            project_name: sorted(next(rand_span_id) for _ in range(size))
            for project_name in project_names
        }

    @pytest.fixture
    def trace_ids(
        self,
        rand_trace_id: Iterator[str],
        project_names: List[str],
        size: int,
    ) -> Dict[str, List[str]]:
        return {
            project_name: sorted(next(rand_trace_id) for _ in range(size))
            for project_name in project_names
        }

    @pytest.fixture
    def traces(
        self,
        span: pd.DataFrame,
        span_ids: Dict[str, List[str]],
        trace_ids: Dict[str, List[str]],
        project_names: List[str],
    ) -> Dict[str, TraceDataset]:
        assert len(span) == 1
        return {
            project_name: TraceDataset(
                pd.concat(
                    [
                        span.assign(**{"context.span_id": span_id, "context.trace_id": trace_id})
                        for span_id, trace_id in zip(
                            span_ids[project_name], trace_ids[project_name]
                        )
                    ]
                ).set_index("context.span_id", drop=False)
            )
            for project_name in project_names
        }

    @pytest.fixture
    def mean_score(self, size: int) -> float:
        return sum(range(size)) / size

    @pytest.fixture
    def size(self) -> int:
        return 3


_Evals: TypeAlias = Union[SpanEvaluations, TraceEvaluations, DocumentEvaluations]

_Summary: TypeAlias = Literal[
    "spanAnnotationSummary(annotation",
    "traceAnnotationSummary(annotation",
]
anno_summaries: List[_Summary] = [
    "spanAnnotationSummary(annotation",
    "traceAnnotationSummary(annotation",
]
