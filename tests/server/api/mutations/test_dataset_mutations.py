from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.mutations.dataset_mutations import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

ADD_SPANS_TO_DATASET_MUTATION = """
mutation($datasetId: GlobalID!, $spanIds: [GlobalID!]!) {
	addSpansToDataset(input: {datasetId: $datasetId, spanIds: $spanIds}) {
    dataset {
      id
    }
  }
}
"""


async def test_add_span_to_dataset(
    test_client,
    simple_dataset,
    spans,
) -> None:
    dataset_id = GlobalID("Dataset", str(0))
    span_ids = [GlobalID("Span", str(1)), GlobalID("Span", str(2))]
    response = await test_client.post(
        "/graphql",
        json={
            "query": ADD_SPANS_TO_DATASET_MUTATION,
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
