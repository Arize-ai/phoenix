from asyncio import sleep
from datetime import datetime
from random import getrandbits
from typing import Any, Awaitable, Callable, cast

import pandas as pd
import pytest
from phoenix import Client, TraceDataset
from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.trace.dsl import SpanQuery
from sqlalchemy import insert, select
from strawberry.relay import GlobalID


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
    await sleep(0.1)
    docs = cast(pd.DataFrame, await acall(px_client.query_spans, doc_query))
    new_count = len(docs)
    assert new_count
    assert new_count == orig_count * 2


async def test_rest_span_annotation(
    session, test_client, project_with_a_single_trace_and_span
) -> None:
    span_gid = GlobalID("Span", "1")
    request_body = {
        "data": [
            {
                "span_id": str(span_gid),
                "name": "Test Annotation",
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

    response = await test_client.post("/v1/span_annotations", json=request_body)
    assert response.status_code == 200

    data = response.json()["data"]
    annotation_gid = GlobalID.from_id(data[0]["id"])
    annotation_id = from_global_id_with_expected_type(annotation_gid, "SpanAnnotation")
    orm_annotation = await session.scalar(
        select(models.SpanAnnotation).where(models.SpanAnnotation.id == annotation_id)
    )

    assert orm_annotation is not None
    assert orm_annotation.name == "Test Annotation"
    assert orm_annotation.annotator_kind == "HUMAN"
    assert orm_annotation.label == "True"
    assert orm_annotation.score == 0.95
    assert orm_annotation.explanation == "This is a test annotation."
    assert orm_annotation.metadata_ == dict()


@pytest.fixture
async def project_with_a_single_trace_and_span(session) -> None:
    """
    Contains a project with a single trace and a single span.
    """
    project_row_id = await session.scalar(
        insert(models.Project).values(name="project-name").returning(models.Project.id)
    )
    trace_id = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="1",
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
            span_id="1",
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
