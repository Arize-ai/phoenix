from datetime import datetime

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID


async def test_add_span_to_dataset(
    test_client,
    simple_dataset,
    spans,
) -> None:
    # todo: enhance this query to return the newly created examples
    mutation = """
mutation($datasetId: GlobalID!, $spanIds: [GlobalID!]!) {
	addSpansToDataset(input: {datasetId: $datasetId, spanIds: $spanIds}) {
    dataset {
      id
    }
  }
}
"""
    dataset_id = GlobalID("Dataset", str(0))
    span_ids = [GlobalID("Span", str(1)), GlobalID("Span", str(2))]
    response = await test_client.post(
        "/graphql",
        json={
            "query": mutation,
            "variables": {
                "datasetId": str(dataset_id),
                "spanIds": [str(span_id) for span_id in span_ids],
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == {"addSpansToDataset": {"dataset": {"id": str(dataset_id)}}}


@pytest.fixture
async def spans(session: AsyncSession) -> None:
    project_row_id = await session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_row_id = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="0123",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="2345",
            parent_id=None,
            name="root span",
            span_kind="UNKNOWN",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
            attributes={
                "input": {"value": "210", "mime_type": "text/plain"},
                "output": {"value": "321", "mime_type": "text/plain"},
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
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="4567",
            parent_id="2345",
            name="retriever span",
            span_kind="RETRIEVER",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "input": {
                    "value": "xyz",
                },
                "retrieval": {
                    "documents": [
                        {"document": {"content": "A", "score": 1}},
                        {"document": {"content": "B", "score": 2}},
                        {"document": {"content": "C", "score": 3}},
                    ],
                },
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
