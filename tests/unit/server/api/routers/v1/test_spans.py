from asyncio import sleep
from datetime import datetime
from random import getrandbits
from typing import Any, Set, cast

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
from phoenix.utilities.json import decode_df_from_json_string


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


@pytest.mark.asyncio
async def test_span_search_matches_legacy_spans_endpoint(
    httpx_client: httpx.AsyncClient,
    span_data_with_documents: Any,
):
    """Ensure the new span_search endpoint returns the same span IDs as the legacy
    /spans endpoint (JSON-encoded DataFrame) for the same query.
    """

    project_identifier = "default"
    body = {"queries": [{}]}

    url_new = f"v1/projects/{project_identifier}/span_search"
    resp_new = await httpx_client.post(url_new, json=body)
    assert resp_new.is_success, f"{url_new} failed: {resp_new.text}"

    payload_new = resp_new.json()
    assert payload_new.get("data"), "No data in span_search response"
    spans_new = payload_new["data"][0]
    span_ids_new: Set[str] = {span["span_id"] for span in spans_new}
    assert span_ids_new, "span_search returned no spans"

    headers_old = {"accept": "application/json"}
    url_old = f"v1/spans?project_name={project_identifier}"
    resp_old = await httpx_client.post(url_old, json=body, headers=headers_old)
    assert resp_old.is_success, f"{url_old} failed: {resp_old.text}"

    ctype = resp_old.headers.get("content-type", "")
    assert "boundary=" in ctype, "Legacy /spans response missing boundary"
    boundary = ctype.split("boundary=")[1]

    span_ids_old: Set[str] = set()
    for part in resp_old.text.split(f"--{boundary}"):
        part = part.strip().lstrip("\r\n").rstrip("\r\n")
        if not part or part == "--":
            continue
        if "\r\n\r\n" not in part:
            continue
        _, json_payload = part.split("\r\n\r\n", 1)
        json_payload = json_payload.strip()
        if not json_payload:
            continue
        df = decode_df_from_json_string(json_payload)
        col = "context.span_id" if "context.span_id" in df.columns else "span_id"
        span_ids_old.update(df[col].astype(str).tolist())

    assert span_ids_old, "Legacy /spans returned no spans"
    assert span_ids_new == span_ids_old, "Mismatch between span_search and legacy spans endpoint"
