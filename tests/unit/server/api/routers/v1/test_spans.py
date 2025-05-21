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
from phoenix.server.api.routers.v1.spans import AnyValue, OtlpSpan, Status
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
async def project_with_a_single_trace_and_span_with_events(
    project_with_a_single_trace_and_span: None,
    db: DbSessionFactory,
) -> None:
    """
    Contains a project with a single trace and a single span that has events.
    """
    async with db() as session:
        span = await session.scalar(
            select(models.Span).where(models.Span.span_id == "7e2f08cb43bbf521")
        )
        assert span is not None
        assert span.events is not None
        span.events = [
            {
                "name": "test_event",
                "timestamp": "2021-01-01T00:00:15.000000+00:00",
                "attributes": {
                    "string_attr": "test_value",
                    "bool_attr": True,
                    "int_attr": 42,
                    "float_attr": 3.14,
                },
            }
        ]
        await session.commit()


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


async def test_span_search_basic(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp = await httpx_client.get("v1/projects/search-test/spans")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 3
    # Verify the spans have the expected structure
    for span in spans:
        assert isinstance(span.span_id, str)
        assert isinstance(span.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time_unix_nano, (int, str))
        assert isinstance(span.end_time_unix_nano, (int, str))
        assert isinstance(span.attributes, (list, type(None)))
        assert isinstance(span.status, (Status, type(None)))


async def test_span_search_annotation_filter(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"annotationNames": ["TestA"]},
    )
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 2
    # Verify the spans have the expected structure
    for span in spans:
        assert isinstance(span.span_id, str)
        assert isinstance(span.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time_unix_nano, (int, str))
        assert isinstance(span.end_time_unix_nano, (int, str))
        assert isinstance(span.attributes, (list, type(None)))
        assert isinstance(span.status, (Status, type(None)))


async def test_span_search_time_slice(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    start = "2021-01-01T00:01:00+00:00"
    end = "2021-01-01T00:03:00+00:00"
    resp = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"start_time": start, "end_time": end},
    )
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    # spans 1 and 2 fall in range
    assert len(spans) == 2
    # Verify the spans have the expected structure
    for span in spans:
        assert isinstance(span.span_id, str)
        assert isinstance(span.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time_unix_nano, (int, str))
        assert isinstance(span.end_time_unix_nano, (int, str))
        assert isinstance(span.attributes, (list, type(None)))
        assert isinstance(span.status, (Status, type(None)))


async def test_span_search_sort_direction(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp_desc = await httpx_client.get(
        "v1/projects/search-test/spans", params={"sort_direction": "desc"}
    )
    resp_asc = await httpx_client.get(
        "v1/projects/search-test/spans", params={"sort_direction": "asc"}
    )
    assert resp_desc.is_success and resp_asc.is_success
    spans_desc = [OtlpSpan.model_validate(s) for s in resp_desc.json()["data"]]
    spans_asc = [OtlpSpan.model_validate(s) for s in resp_asc.json()["data"]]
    ids_desc = [s.span_id for s in spans_desc]
    ids_asc = [s.span_id for s in spans_asc]
    assert ids_desc == list(reversed(ids_asc))


async def test_span_search_pagination(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp1 = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"limit": 2, "sort_direction": "asc"},
    )
    assert resp1.is_success
    body1 = resp1.json()
    spans1 = [OtlpSpan.model_validate(s) for s in body1["data"]]
    assert len(spans1) == 2 and body1["next_cursor"]

    cursor = body1["next_cursor"]
    # Second page
    resp2 = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"cursor": cursor, "sort_direction": "asc"},
    )
    assert resp2.is_success
    body2 = resp2.json()
    spans2 = [OtlpSpan.model_validate(s) for s in body2["data"]]
    assert len(spans2) == 1 and body2["next_cursor"] is None

    # Verify the spans have the expected structure
    for spans in [spans1, spans2]:
        for span in spans:
            assert isinstance(span.span_id, str)
            assert isinstance(span.trace_id, str)
            assert isinstance(span.name, str)
            assert isinstance(span.start_time_unix_nano, (int, str))
            assert isinstance(span.end_time_unix_nano, (int, str))
            assert isinstance(span.attributes, (list, type(None)))
            assert isinstance(span.status, (Status, type(None)))


async def test_span_attributes_conversion(
    httpx_client: httpx.AsyncClient, project_with_a_single_trace_and_span: None
) -> None:
    """Test that span attributes are properly converted to OTLP format."""
    resp = await httpx_client.get("v1/projects/project-name/spans")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert span.attributes is not None
    # Find the input and output attributes
    input_attr = next((attr for attr in span.attributes if attr.key == "input.value"), None)
    output_attr = next((attr for attr in span.attributes if attr.key == "output.value"), None)

    assert input_attr is not None
    assert output_attr is not None

    # Verify the input attribute value
    assert input_attr.value is not None
    assert isinstance(input_attr.value, AnyValue)
    assert input_attr.value.string_value == "chain-span-input-value"

    # Verify the output attribute value
    assert output_attr.value is not None
    assert isinstance(output_attr.value, AnyValue)
    assert output_attr.value.string_value == "chain-span-output-value"


async def test_span_events_conversion(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span_with_events: None,
) -> None:
    """Test that span events are properly converted to OTLP format."""
    resp = await httpx_client.get("v1/projects/project-name/spans")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert span.events is not None
    assert len(span.events) == 1

    event = span.events[0]
    assert event.name == "test_event"
    assert event.time_unix_nano == 1609459215000000000
    assert event.attributes is not None
    assert len(event.attributes) == 4

    string_attr = next((attr for attr in event.attributes if attr.key == "string_attr"), None)
    assert string_attr is not None
    assert string_attr.value is not None
    assert string_attr.value.string_value == "test_value"

    bool_attr = next((attr for attr in event.attributes if attr.key == "bool_attr"), None)
    assert bool_attr is not None
    assert bool_attr.value is not None
    assert bool_attr.value.bool_value is True

    int_attr = next((attr for attr in event.attributes if attr.key == "int_attr"), None)
    assert int_attr is not None
    assert int_attr.value is not None
    assert int_attr.value.int_value == 42

    float_attr = next((attr for attr in event.attributes if attr.key == "float_attr"), None)
    assert float_attr is not None
    assert float_attr.value is not None
    assert float_attr.value.double_value == 3.14
