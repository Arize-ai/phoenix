import textwrap
from datetime import datetime

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from sqlalchemy import insert, select
from strawberry.relay import GlobalID


async def test_add_span_to_dataset(
    test_client,
    empty_dataset,
    spans,
) -> None:
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = """
mutation ($datasetId: GlobalID!, $spanIds: [GlobalID!]!) {
  addSpansToDataset(input: {datasetId: $datasetId, spanIds: $spanIds}) {
    dataset {
      id
      examples {
        edges {
          node {
            input
            output
            metadata
          }
        }
      }
    }
  }
}
"""
    response = await test_client.post(
        "/graphql",
        json={
            "query": mutation,
            "variables": {
                "datasetId": str(dataset_id),
                "spanIds": [
                    str(GlobalID(type_name="Span", node_id=span_id))
                    for span_id in map(str, range(1, 4))
                ],
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == {
        "addSpansToDataset": {
            "dataset": {
                "id": str(dataset_id),
                "examples": {
                    "edges": [
                        {
                            "node": {
                                "input": {"input": "chain-span-input-value"},
                                "output": {"output": "chain-span-output-value"},
                                "metadata": {
                                    "input": {
                                        "value": "chain-span-input-value",
                                        "mime_type": "text/plain",
                                    },
                                    "output": {
                                        "value": "chain-span-output-value",
                                        "mime_type": "text/plain",
                                    },
                                },
                            }
                        },
                        {
                            "node": {
                                "input": {"input": "retriever-span-input"},
                                "output": {
                                    "retrieval_documents": [
                                        {
                                            "document": {
                                                "content": "retrieved-document-content",
                                                "score": 1,
                                            }
                                        }
                                    ]
                                },
                                "metadata": {
                                    "input": {
                                        "value": "retriever-span-input",
                                        "mime_type": "text/plain",
                                    },
                                    "retrieval": {
                                        "documents": [
                                            {
                                                "document": {
                                                    "content": "retrieved-document-content",
                                                    "score": 1,
                                                }
                                            }
                                        ]
                                    },
                                },
                            }
                        },
                        {
                            "node": {
                                "input": {
                                    "input_messages": [
                                        {"content": "user-message-content", "role": "user"}
                                    ]
                                },
                                "metadata": {
                                    "llm": {
                                        "input_messages": [
                                            {"content": "user-message-content", "role": "user"}
                                        ],
                                        "invocation_parameters": {"temperature": 1},
                                        "output_messages": [
                                            {
                                                "content": "assistant-message-content",
                                                "role": "assistant",
                                            }
                                        ],
                                    }
                                },
                                "output": {
                                    "output_messages": [
                                        {
                                            "content": "assistant-message-content",
                                            "role": "assistant",
                                        }
                                    ]
                                },
                            }
                        },
                    ]
                },
            }
        }
    }


@pytest.fixture
async def empty_dataset(session):
    """
    Inserts an empty dataset.
    """

    dataset = models.Dataset(
        id=1,
        name="empty dataset",
        description=None,
        metadata_={},
    )
    session.add(dataset)
    await session.flush()


@pytest.fixture
async def spans(session):
    """
    Inserts three spans from a single trace: a chain root span, a retriever
    child span, and an llm child span.
    """
    project_row_id = await session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_row_id = await session.scalar(
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
            trace_rowid=trace_row_id,
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
    await session.execute(
        insert(models.Span).values(
            trace_rowid=trace_row_id,
            span_id="2",
            parent_id="1",
            name="retriever span",
            span_kind="RETRIEVER",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "input": {
                    "value": "retriever-span-input",
                    "mime_type": "text/plain",
                },
                "retrieval": {
                    "documents": [
                        {"document": {"content": "retrieved-document-content", "score": 1}},
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
    )
    await session.execute(
        insert(models.Span).values(
            trace_rowid=trace_row_id,
            span_id="3",
            parent_id="1",
            name="llm span",
            span_kind="LLM",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "llm": {
                    "input_messages": [{"role": "user", "content": "user-message-content"}],
                    "output_messages": [
                        {"role": "assistant", "content": "assistant-message-content"}
                    ],
                    "invocation_parameters": {"temperature": 1},
                },
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
    )


async def test_delete_a_dataset(
    session,
    test_client,
    empty_dataset,
) -> None:
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = textwrap.dedent(
        """
        mutation ($datasetId: GlobalID!) {
          deleteDataset(input: { datasetId: $datasetId })
        }
        """
    )

    response = await test_client.post(
        "/graphql",
        json={
            "query": mutation,
            "variables": {
                "datasetId": str(dataset_id),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    dataset_query = (
        await session.execute(select(models.Dataset).where(models.Dataset.id == 1))
    ).first()
    assert not dataset_query
