"""Regression tests for server-side ``annotator_kind`` provenance.

``annotator_kind`` values ``LLM`` and ``CODE`` assert that an annotation was
produced by a Phoenix evaluator executed by the server itself. The only writer
that derives those values is the in-process experiment runner, which persists
through direct database inserts. Every external write surface (REST and
GraphQL) used to accept ``annotator_kind`` as a client-supplied literal and
persist it as-is, so any credential that could ingest could also forge judge
records indistinguishable from the server's own evaluator output.

These tests pin both directions of the fix:

- external submissions of ``LLM``/``CODE`` are re-stamped to ``EXTERNAL`` on
  every external write path (REST span annotations, REST experiment
  evaluations, GraphQL annotation mutations), while ``HUMAN`` passes through;
- direct database writes (the experiment runner's write path) can still
  persist ``LLM``/``CODE``.
"""

import datetime
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.annotator_provenance import resolve_external_annotator_kind
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def project_with_one_span(db: DbSessionFactory) -> None:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id="trace-1",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
        )
        session.add(trace)
        await session.flush()

        span = models.Span(
            trace_rowid=trace.id,
            span_id="span1",
            name="span1",
            span_kind="internal",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span)
        await session.commit()


@pytest.mark.parametrize(
    "submitted, stored",
    [
        ("LLM", "EXTERNAL"),
        ("CODE", "EXTERNAL"),
        ("HUMAN", "HUMAN"),
        ("EXTERNAL", "EXTERNAL"),
    ],
)
async def test_rest_span_annotations_restamp_server_derived_kinds(
    httpx_client: httpx.AsyncClient,
    project_with_one_span: None,
    db: DbSessionFactory,
    submitted: str,
    stored: str,
) -> None:
    """POST /v1/span_annotations must not persist client claims of LLM/CODE."""
    response = await httpx_client.post(
        "v1/span_annotations",
        params={"sync": "true"},
        json={
            "data": [
                {
                    "span_id": "span1",
                    "name": "correctness",
                    "annotator_kind": submitted,
                    "result": {"label": "correct", "score": 1.0},
                    "metadata": {},
                }
            ]
        },
    )
    assert response.status_code == 200

    async with db() as session:
        annotation = await session.scalar(select(models.SpanAnnotation))
    assert annotation is not None
    assert annotation.annotator_kind == stored
    assert annotation.source == "API"
    assert annotation.label == "correct"
    assert annotation.score == 1.0

    # the stored kind is also what read-back surfaces report
    read_back = await httpx_client.get(
        "v1/projects/default/span_annotations", params={"span_ids": ["span1"]}
    )
    assert read_back.status_code == 200
    (row,) = read_back.json()["data"]
    assert row["annotator_kind"] == stored


@pytest.mark.parametrize(
    "submitted, stored",
    [
        ("LLM", "EXTERNAL"),
        ("CODE", "EXTERNAL"),
        ("HUMAN", "HUMAN"),
    ],
)
async def test_rest_experiment_evaluations_restamp_server_derived_kinds(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
    db: DbSessionFactory,
    submitted: str,
    stored: str,
) -> None:
    """POST /v1/experiment_evaluations must not persist client claims of LLM/CODE."""
    dataset_gid = GlobalID("Dataset", "0")
    experiment_gid = (
        await httpx_client.post(
            f"v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
    ).json()["data"]["id"]
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    run_gid = (
        await httpx_client.post(
            f"v1/experiments/{experiment_gid}/runs",
            json={
                "dataset_example_id": str(GlobalID("DatasetExample", "0")),
                "output": "some output",
                "repetition_number": 1,
                "start_time": now,
                "end_time": now,
            },
        )
    ).json()["data"]["id"]

    response = await httpx_client.post(
        "v1/experiment_evaluations",
        json={
            "experiment_run_id": run_gid,
            "name": "some_evaluation_name",
            "annotator_kind": submitted,
            "result": {"label": "some label", "score": 0.5},
            "start_time": now,
            "end_time": now,
        },
    )
    assert response.status_code == 200

    async with db() as session:
        annotation = await session.scalar(select(models.ExperimentRunAnnotation))
    assert annotation is not None
    assert annotation.annotator_kind == stored


_CREATE_SPAN_ANNOTATIONS = """
mutation CreateSpanAnnotations($input: [CreateSpanAnnotationInput!]!) {
  createSpanAnnotations(input: $input) {
    spanAnnotations {
      id
      name
      annotatorKind
    }
  }
}
"""


@pytest.mark.parametrize(
    "submitted, stored",
    [
        ("LLM", "EXTERNAL"),
        ("CODE", "EXTERNAL"),
        ("HUMAN", "HUMAN"),
    ],
)
async def test_graphql_span_annotation_mutations_restamp_server_derived_kinds(
    project_with_one_span: None,
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    submitted: str,
    stored: str,
) -> None:
    result = await gql_client.execute(
        _CREATE_SPAN_ANNOTATIONS,
        {
            "input": [
                {
                    "spanId": str(GlobalID("Span", "1")),
                    "name": "correctness",
                    "annotatorKind": submitted,
                    "source": "API",
                    "score": 1.0,
                    "metadata": {},
                }
            ]
        },
    )
    assert result.data is not None
    assert not result.errors
    annotation = result.data["createSpanAnnotations"]["spanAnnotations"][0]
    assert annotation["annotatorKind"] == stored

    async with db() as session:
        stored_annotation = await session.scalar(select(models.SpanAnnotation))
    assert stored_annotation is not None
    assert stored_annotation.annotator_kind == stored


@pytest.mark.parametrize("kind", ["LLM", "CODE"])
async def test_direct_database_writes_still_persist_server_derived_kinds(
    project_with_one_span: None,
    db: DbSessionFactory,
    kind: str,
) -> None:
    """The in-process experiment runner persists via direct database inserts
    (``daemons/experiment_runner.py`` derives ``LLM``/``CODE`` from the
    evaluator class and never goes through the HTTP API). Those writes must
    keep working: the re-stamp belongs to the API boundary, not the model.
    """
    async with db() as session:
        span = await session.scalar(select(models.Span))
        assert span is not None
        session.add(
            models.SpanAnnotation(
                span_rowid=span.id,
                name="hallucination",
                annotator_kind=kind,
                label="grounded",
                score=1.0,
                explanation=None,
                metadata_={},
                source="APP",
                identifier="",
            )
        )
        await session.commit()

    async with db() as session:
        annotation = await session.scalar(
            select(models.SpanAnnotation).where(models.SpanAnnotation.name == "hallucination")
        )
    assert annotation is not None
    assert annotation.annotator_kind == kind


def test_resolve_external_annotator_kind() -> None:
    assert resolve_external_annotator_kind("LLM") == "EXTERNAL"
    assert resolve_external_annotator_kind("CODE") == "EXTERNAL"
    assert resolve_external_annotator_kind("HUMAN") == "HUMAN"
    assert resolve_external_annotator_kind("EXTERNAL") == "EXTERNAL"
