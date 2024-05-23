from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.helpers.dataset_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from sqlalchemy import insert
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


@dataclass(frozen=True)
class MockSpan:
    span_kind: Optional[str]
    input_value: Any
    input_mime_type: Optional[str]
    output_value: Any
    output_mime_type: Optional[str]
    llm_prompt_template_variables: Any
    llm_input_messages: Any
    llm_output_messages: Any
    retrieval_documents: Any


@pytest.mark.parametrize(
    "span, expected_input_value",
    [
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables={"variable_name": "variable-value"},
                llm_input_messages=[{"content": "user-message", "role": "user"}],
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {
                "input_messages": [{"content": "user-message", "role": "user"}],
                "prompt_template_variables": {"variable_name": "variable-value"},
            },
            id="llm-span-with-input-messages-and-prompt-template-variables",
        ),
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=[{"content": "user-message", "role": "user"}],
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {
                "input_messages": [{"content": "user-message", "role": "user"}],
            },
            id="llm-span-with-input-messages-and-no-prompt-template-variables",
        ),
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"input": "plain-text-input"},
            id="llm-span-with-no-input-messages-and-plain-text-input",
        ),
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables={"variable_name": "variable-value"},
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {
                "input": "plain-text-input",
                "prompt_template_variables": {"variable_name": "variable-value"},
            },
            id="llm-span-with-no-input-messages-and-plain-text-input-with-prompt-template-variables",
        ),
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value={"llm-span-input": "llm-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"llm-span-input": "llm-input"},
            id="llm-span-with-no-input-messages-and-json-input",
        ),
        pytest.param(
            MockSpan(
                span_kind="CHAIN",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"input": "plain-text-input"},
            id="chain-span-with-plain-text-input",
        ),
        pytest.param(
            MockSpan(
                span_kind="CHAIN",
                input_value={"chain_input": "chain-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"chain_input": "chain-input"},
            id="chain-span-with-json-input",
        ),
    ],
)
def test_get_dataset_example_input(span, expected_input_value):
    input_value = get_dataset_example_input(span)
    assert expected_input_value == input_value


@pytest.mark.parametrize(
    "span, expected_output_value",
    [
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables={"variable_name": "variable-value"},
                llm_input_messages=[{"content": "user-message", "role": "user"}],
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"output_messages": [{"content": "assistant-message", "role": "assistant"}]},
            id="llm-span-with-output-messages",
        ),
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=[{"content": "user-message", "role": "user"}],
                llm_output_messages=None,
                retrieval_documents=None,
            ),
            {
                "output": "plain-text-output",
            },
            id="llm-span-with-no-output-messages-but-with-plain-text-output",
        ),
        pytest.param(
            MockSpan(
                span_kind="LLM",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value={"llm-span-output": "value"},
                output_mime_type="application/json",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=None,
                retrieval_documents=None,
            ),
            {"llm-span-output": "value"},
            id="llm-span-with-no-output-messages-and-json-output",
        ),
        pytest.param(
            MockSpan(
                span_kind="RETRIEVER",
                input_value={"retriever-input": "retriever-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=None,
                retrieval_documents=[{"id": "1", "score": 0.5, "content": "document-content"}],
            ),
            {"retrieval_documents": [{"id": "1", "score": 0.5, "content": "document-content"}]},
            id="retriever-span-with-retrieval-documents",
        ),
        pytest.param(
            MockSpan(
                span_kind="RETRIEVER",
                input_value={"retriever-input": "retriever-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=None,
                retrieval_documents=None,
            ),
            {"output": "plain-text-output"},
            id="retriever-span-with-plain-text-output-and-no-retrieval-documents",
        ),
        pytest.param(
            MockSpan(
                span_kind="RETRIEVER",
                input_value={"retriever-input": "retriever-input"},
                input_mime_type="application/json",
                output_value={"retriever_output": "retriever-output"},
                output_mime_type="application/json",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=None,
                retrieval_documents=None,
            ),
            {"retriever_output": "retriever-output"},
            id="retriever-span-with-json-output-and-no-retrieval-documents",
        ),
        pytest.param(
            MockSpan(
                span_kind="CHAIN",
                input_value={"chain_input": "chain-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=None,
                retrieval_documents=None,
            ),
            {"output": "plain-text-output"},
            id="chain-span-with-plain-text-output",
        ),
        pytest.param(
            MockSpan(
                span_kind="CHAIN",
                input_value={"chain_input": "chain-input"},
                input_mime_type="application/json",
                output_value={"chain_output": "chain-output"},
                output_mime_type="application/json",
                llm_prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=None,
                retrieval_documents=None,
            ),
            {"chain_output": "chain-output"},
            id="chain-span-with-json-output",
        ),
    ],
)
def test_get_dataset_example_output(span, expected_output_value):
    output_value = get_dataset_example_output(span)
    assert expected_output_value == output_value
