import json
from dataclasses import dataclass
from typing import Any, Optional

import pytest
from openinference.semconv.trace import (
    DocumentAttributes,
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)

from phoenix.db.models import Span
from phoenix.server.api.helpers.dataset_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from phoenix.trace.attributes import unflatten


@dataclass
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


LLM = OpenInferenceSpanKindValues.LLM.value
RETRIEVER = OpenInferenceSpanKindValues.RETRIEVER.value
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
TEXT = OpenInferenceMimeTypeValues.TEXT.value
JSON = OpenInferenceMimeTypeValues.JSON.value
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_NAME = MessageAttributes.MESSAGE_NAME
MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = MessageAttributes.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON
MESSAGE_FUNCTION_CALL_NAME = MessageAttributes.MESSAGE_FUNCTION_CALL_NAME
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS
DOCUMENT_ID = DocumentAttributes.DOCUMENT_ID
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT


@pytest.mark.parametrize(
    "span, expected_input_value",
    [
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (OPENINFERENCE_SPAN_KIND, LLM),
                        (INPUT_MIME_TYPE, TEXT),
                        (INPUT_VALUE, "plain-text-input"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (
                            LLM_PROMPT_TEMPLATE_VARIABLES,
                            json.dumps({"variable_name": "variable-value"}),
                        ),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "123"),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_NAME}", "xyz"),
                        (f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}", "user-message"),
                        (f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}", "user"),
                        (f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_ROLE}", "assistant"),
                        (f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_FUNCTION_CALL_NAME}", "add"),
                        (
                            f"{LLM_INPUT_MESSAGES}.2.{MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON}",
                            json.dumps({"a": 363, "b": 42}),
                        ),
                        (f"{LLM_INPUT_MESSAGES}.3.{MESSAGE_CONTENT}", "user-message"),
                        (f"{LLM_INPUT_MESSAGES}.3.{MESSAGE_ROLE}", "user"),
                        (f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_ROLE}", "assistant"),
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}",
                            "multiply",
                        ),  # noqa: E501
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                            json.dumps(  # noqa: E501
                                {"a": 121, "b": 3}
                            ),
                        ),
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.1.{TOOL_CALL_FUNCTION_NAME}",
                            "add",
                        ),  # noqa: E501
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.1.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                            json.dumps(  # noqa: E501
                                {"a": 363, "b": 42}
                            ),
                        ),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {
                "messages": [
                    {"content": "123", "role": "assistant", "name": "xyz"},
                    {"content": "user-message", "role": "user"},
                    {
                        "role": "assistant",
                        "function_call": {"name": "add", "arguments": '{"a": 363, "b": 42}'},
                    },
                    {"content": "user-message", "role": "user"},
                    {
                        "role": "assistant",
                        "tool_calls": [
                            {"function": {"name": "multiply", "arguments": '{"a": 121, "b": 3}'}},
                            {"function": {"name": "add", "arguments": '{"a": 363, "b": 42}'}},
                        ],
                    },
                ],
                "prompt_template_variables": {"variable_name": "variable-value"},
            },
            id="llm-span-with-input-messages-and-prompt-template-variables",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "user-message"),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}", "user"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {
                "messages": [{"content": "user-message", "role": "user"}],
            },
            id="llm-span-with-input-messages-and-no-prompt-template-variables",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"input": "plain-text-input"},
            id="llm-span-with-no-input-messages-and-plain-text-input",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (
                            LLM_PROMPT_TEMPLATE_VARIABLES,
                            json.dumps({"variable_name": "variable-value"}),
                        ),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {
                "input": "plain-text-input",
                "prompt_template_variables": {"variable_name": "variable-value"},
            },
            id="llm-span-with-no-input-messages-and-plain-text-input-with-prompt-template-variables",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"llm-span-input": "llm-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"llm-span-input": "llm-input"},
            id="llm-span-with-no-input-messages-and-json-input",
        ),
        pytest.param(
            Span(
                span_kind="CHAIN",
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"input": "plain-text-input"},
            id="chain-span-with-plain-text-input",
        ),
        pytest.param(
            Span(
                span_kind="CHAIN",
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"chain_input": "chain-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"chain_input": "chain-input"},
            id="chain-span-with-json-input",
        ),
    ],
)
def test_get_dataset_example_input(span: Span, expected_input_value: dict[str, Any]) -> None:
    input_value = get_dataset_example_input(span)
    assert expected_input_value == input_value


@pytest.mark.parametrize(
    "span, expected_output_value",
    [
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (
                            LLM_PROMPT_TEMPLATE_VARIABLES,
                            json.dumps({"variable_name": "variable-value"}),
                        ),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "user-message"),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}", "user"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant-message"),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"messages": [{"content": "assistant-message", "role": "assistant"}]},
            id="llm-span-with-output-messages",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "user-message"),
                        (f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}", "user"),
                    )
                ),
            ),
            {"output": "plain-text-output"},
            id="llm-span-with-no-output-messages-but-with-plain-text-output",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, json.dumps({"llm-span-output": "value"})),
                        (OUTPUT_MIME_TYPE, JSON),
                    )
                ),
            ),
            {"llm-span-output": "value"},
            id="llm-span-with-no-output-messages-and-json-output",
        ),
        pytest.param(
            Span(
                span_kind=RETRIEVER,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"retriever-input": "retriever-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (f"{RETRIEVAL_DOCUMENTS}.0.{DOCUMENT_ID}", "1"),
                        (f"{RETRIEVAL_DOCUMENTS}.0.{DOCUMENT_SCORE}", 0.5),
                        (f"{RETRIEVAL_DOCUMENTS}.0.{DOCUMENT_CONTENT}", "document-content"),
                    )
                ),
            ),
            {"documents": [{"id": "1", "score": 0.5, "content": "document-content"}]},
            id="retriever-span-with-retrieval-documents",
        ),
        pytest.param(
            MockSpan(
                span_kind="RETRIEVER",
                input_value={"retriever-input": "retriever-input"},
                input_mime_type=JSON,
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
                input_value=json.dumps({"retriever-input": "retriever-input"}),
                input_mime_type=JSON,
                output_value=json.dumps({"retriever_output": "retriever-output"}),
                output_mime_type=JSON,
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
                input_mime_type=JSON,
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
                input_value=json.dumps({"chain_input": "chain-input"}),
                input_mime_type=JSON,
                output_value=json.dumps({"chain_output": "chain-output"}),
                output_mime_type=JSON,
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
def test_get_dataset_example_output(span: Span, expected_output_value: dict[str, Any]) -> None:
    output_value = get_dataset_example_output(span)
    assert expected_output_value == output_value
