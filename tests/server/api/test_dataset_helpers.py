from dataclasses import dataclass
from typing import Any, Optional

import pytest
from phoenix.server.api.datasets_helpers import (
    get_dataset_example_input,
)


@dataclass(frozen=True)
class MockSpan:
    span_kind: Optional[str]
    input_value: Any
    input_mime_type: Optional[str]
    output_value: Any
    output_mime_type: Optional[str]
    prompt_template_variables: Any
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
                prompt_template_variables={"variable_name": "variable-value"},
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
                prompt_template_variables=None,
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
                prompt_template_variables=None,
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
                prompt_template_variables={"variable_name": "variable-value"},
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
                input_value={"chain_input": "chain-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"chain_input": "chain-input"},
            id="llm-span-with-no-input-messages-and-json-input",
        ),
        # pytest.param(
        #     MockSpan(
        #         span_kind="RETRIEVER",
        #         input_value={"chain_input": "chain-input"},
        #         input_mime_type="application/json",
        #         output_value="plain-text-output",
        #         output_mime_type="text/plain",
        #         prompt_template_variables=None,
        #         llm_input_messages=None,
        #         llm_output_messages=None,
        #         retrieval_documents=[{"id": "1", "score": 0.5, "content": "document-content"}],
        #     ),
        #     {"chain_input": "chain-input"},
        #     id="llm-span-with-no-input-messages-and-json-input",
        # ),
        pytest.param(
            MockSpan(
                span_kind="CHAIN",
                input_value="plain-text-input",
                input_mime_type="text/plain",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"input": "plain-text-input"},
            id="non-llm-span-with-plain-text-input",
        ),
        pytest.param(
            MockSpan(
                span_kind="CHAIN",
                input_value={"chain_input": "chain-input"},
                input_mime_type="application/json",
                output_value="plain-text-output",
                output_mime_type="text/plain",
                prompt_template_variables=None,
                llm_input_messages=None,
                llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
                retrieval_documents=None,
            ),
            {"chain_input": "chain-input"},
            id="non-llm-span-with-json-input",
        ),
    ],
)
def test_get_dataset_example_input(span, expected_input_value):
    input_value = get_dataset_example_input(span)
    assert expected_input_value == input_value
