from asyncio import sleep
from datetime import datetime, timedelta
from random import getrandbits
from typing import Any, cast

import httpx
import pandas as pd
import pytest
from faker import Faker
from sqlalchemy import insert, select

from phoenix import Client as LegacyClient
from phoenix import TraceDataset
from phoenix.client import Client
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanQuery


async def test_span_round_tripping_with_docs(
    legacy_px_client: LegacyClient,
    dialect: str,
    span_data_with_documents: Any,
) -> None:
    df = cast(pd.DataFrame, legacy_px_client.get_spans_dataframe())
    new_ids = {span_id: getrandbits(64).to_bytes(8, "big").hex() for span_id in df.index}
    for span_id_col_name in ("context.span_id", "parent_id"):
        df.loc[:, span_id_col_name] = df.loc[:, span_id_col_name].map(new_ids.get)
    df = df.set_index("context.span_id", drop=False)
    doc_query = SpanQuery().explode("retrieval.documents", content="document.content")
    orig_docs = cast(pd.DataFrame, legacy_px_client.query_spans(doc_query))
    orig_count = len(orig_docs)
    assert orig_count
    legacy_px_client.log_traces(TraceDataset(df))
    await sleep(1)  # Wait for the spans to be inserted
    docs = cast(pd.DataFrame, legacy_px_client.query_spans(doc_query))
    new_count = len(docs)
    assert new_count
    assert new_count == orig_count * 2


@pytest.mark.xfail(condition=True, reason="The spans client is not yet released")
async def test_querying_spans_with_new_client(
    legacy_px_client: LegacyClient,
    px_client: Client,
    dialect: str,
    span_data_with_documents: Any,
) -> None:
    legacy_df = cast(pd.DataFrame, legacy_px_client.get_spans_dataframe())
    df = cast(pd.DataFrame, px_client.spans.get_spans_dataframe())  # type: ignore
    assert legacy_df.equals(df)


@pytest.mark.parametrize("sync", [False, True])
async def test_rest_span_annotation(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    sync: bool,
    fake: Faker,
) -> None:
    name = fake.pystr()
    request_body = {
        "data": [
            {
                "span_id": "7e2f08cb43bbf521",
                "name": name,
                "annotator_kind": "HUMAN",
                "result": {
                    "label": "True",
                    "score": 0.95,
                    "explanation": "This is a test annotation.",
                },
                "metadata": {},
            }
        ]
    }

    response = await httpx_client.post(f"v1/span_annotations?sync={sync}", json=request_body)
    assert response.status_code == 200
    if not sync:
        await sleep(0.1)
    async with db() as session:
        orm_annotation = await session.scalar(
            select(models.SpanAnnotation).where(models.SpanAnnotation.name == name)
        )

    assert orm_annotation is not None
    assert orm_annotation.name == name
    assert orm_annotation.annotator_kind == "HUMAN"
    assert orm_annotation.label == "True"
    assert orm_annotation.score == 0.95
    assert orm_annotation.explanation == "This is a test annotation."
    assert orm_annotation.metadata_ == dict()


@pytest.fixture
async def project_with_a_single_trace_and_span(
    db: DbSessionFactory,
) -> None:
    """
    Contains a project with a single trace and a single span.
    """
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="project-name").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="649993371fa95c788177f739b7423818",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        await session.execute(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="7e2f08cb43bbf521",
                parent_id=None,
                name="chain span",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={
                    "input": {"value": "chain-span-input-value", "mime_type": "text/plain"},
                    "output": {"value": "chain-span-output-value", "mime_type": "text/plain"},
                },
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )


@pytest.fixture
async def span_search_test_data(db: DbSessionFactory) -> None:
    """Insert three spans with different times and annotations for filter tests."""

    async with db() as session:
        project = models.Project(name="search-test")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id="abcd1234",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00+00:00"),
        )
        session.add(trace)
        await session.flush()

        # 3 spans 1 minute apart
        spans: list[models.Span] = []
        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        for i in range(3):
            span = models.Span(
                trace_rowid=trace.id,
                span_id=f"span{i}",
                parent_id=None,
                name=f"span-{i}",
                span_kind="CHAIN",
                start_time=base_time + timedelta(minutes=i),
                end_time=base_time + timedelta(minutes=i, seconds=30),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            spans.append(span)
        await session.flush()

        # Add annotations to first two spans
        for span in spans[:2]:
            session.add(
                models.SpanAnnotation(
                    span_rowid=span.id,
                    name="TestA",
                    annotator_kind="HUMAN",
                    label="L",
                    score=1.0,
                    explanation="",
                    metadata_={},
                    identifier="",  # noqa
                    source="API",
                    user_id=None,
                )
            )


async def test_span_search_basic(httpx_client: httpx.AsyncClient, span_search_test_data: None):
    resp = await httpx_client.get("v1/projects/search-test/spans")
    assert resp.is_success
    data = resp.json()
    assert len(data["data"]) == 3


async def test_span_search_annotation_filter(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
):
    resp = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"annotationNames": ["TestA"]},
    )
    assert resp.is_success
    data = resp.json()
    assert len(data["data"]) == 2


async def test_span_search_time_slice(httpx_client: httpx.AsyncClient, span_search_test_data: None):
    start = "2021-01-01T00:01:00+00:00"
    end = "2021-01-01T00:03:00+00:00"
    resp = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"start_time": start, "end_time": end},
    )
    assert resp.is_success
    data = resp.json()
    # spans 1 and 2 fall in range
    assert len(data["data"]) == 2


async def test_span_search_sort_direction(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
):
    resp_desc = await httpx_client.get(
        "v1/projects/search-test/spans", params={"sort_direction": "desc"}
    )
    resp_asc = await httpx_client.get(
        "v1/projects/search-test/spans", params={"sort_direction": "asc"}
    )
    assert resp_desc.is_success and resp_asc.is_success
    ids_desc = [s["span_id"] for s in resp_desc.json()["data"]]
    ids_asc = [s["span_id"] for s in resp_asc.json()["data"]]
    assert ids_desc == list(reversed(ids_asc))


async def test_span_search_pagination(httpx_client: httpx.AsyncClient, span_search_test_data: None):
    resp1 = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"limit": 2, "sort_direction": "asc"},
    )
    assert resp1.is_success
    body1 = resp1.json()
    assert len(body1["data"]) == 2 and body1["next_cursor"]

    cursor = body1["next_cursor"]
    # Second page
    resp2 = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"cursor": cursor, "sort_direction": "asc"},
    )
    assert resp2.is_success
    body2 = resp2.json()
    assert len(body2["data"]) == 1 and body2["next_cursor"] is None
