import json
from typing import Any

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
    get_experiment_example_output,
)
from phoenix.trace.attributes import unflatten

# DocumentAttributes
DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_ID = DocumentAttributes.DOCUMENT_ID
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE

# MessageAttributes
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = MessageAttributes.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON
MESSAGE_FUNCTION_CALL_NAME = MessageAttributes.MESSAGE_FUNCTION_CALL_NAME
MESSAGE_NAME = MessageAttributes.MESSAGE_NAME
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

# OpenInferenceMimeTypeValues
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

# OpenInferenceSpanKindValues
CHAIN = OpenInferenceSpanKindValues.CHAIN.value
LLM = OpenInferenceSpanKindValues.LLM.value
RETRIEVER = OpenInferenceSpanKindValues.RETRIEVER.value

# SpanAttributes
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

# ToolCallAttributes
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME


@pytest.mark.parametrize(
    "span, expected_input_value",
    [
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (OPENINFERENCE_SPAN_KIND, LLM),
                        (INPUT_VALUE, "plain-text-input"),
                        (INPUT_MIME_TYPE, TEXT),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
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
                        ),
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                            json.dumps({"a": 121, "b": 3}),
                        ),
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.1.{TOOL_CALL_FUNCTION_NAME}",
                            "add",
                        ),
                        (
                            f"{LLM_INPUT_MESSAGES}.4.{MESSAGE_TOOL_CALLS}.1.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                            json.dumps({"a": 363, "b": 42}),
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
                "variable_name": "variable-value",
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
                "variable_name": "variable-value",
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
            Span(
                span_kind=RETRIEVER,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"retriever-input": "retriever-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                    )
                ),
            ),
            {"output": "plain-text-output"},
            id="retriever-span-with-plain-text-output-and-no-retrieval-documents",
        ),
        pytest.param(
            Span(
                span_kind=RETRIEVER,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"retriever-input": "retriever-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, json.dumps({"retriever_output": "retriever-output"})),
                        (OUTPUT_MIME_TYPE, JSON),
                    )
                ),
            ),
            {"retriever_output": "retriever-output"},
            id="retriever-span-with-json-output-and-no-retrieval-documents",
        ),
        pytest.param(
            Span(
                span_kind=CHAIN,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"chain_input": "chain-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                    )
                ),
            ),
            {"output": "plain-text-output"},
            id="chain-span-with-plain-text-output",
        ),
        pytest.param(
            Span(
                span_kind=CHAIN,
                attributes=unflatten(
                    (
                        (INPUT_VALUE, json.dumps({"chain_input": "chain-input"})),
                        (INPUT_MIME_TYPE, JSON),
                        (OUTPUT_VALUE, json.dumps({"chain_output": "chain-output"})),
                        (OUTPUT_MIME_TYPE, JSON),
                    )
                ),
            ),
            {"chain_output": "chain-output"},
            id="chain-span-with-json-output",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "No tools here."),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"messages": [{"content": "No tools here.", "role": "assistant"}]},
            id="llm-span-without-tools",
        ),
    ],
)
def test_get_dataset_example_output(span: Span, expected_output_value: dict[str, Any]) -> None:
    output_value = get_dataset_example_output(span)
    assert expected_output_value == output_value


@pytest.mark.parametrize(
    "span, expected_output_value",
    [
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "I can help with weather."),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                        (
                            f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}",
                            json.dumps(
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "description": "Get current weather",
                                        "parameters": {
                                            "type": "object",
                                            "properties": {"location": {"type": "string"}},
                                            "required": ["location"],
                                        },
                                    },
                                }
                            ),
                        ),
                    )
                ),
            ),
            {
                "messages": [{"content": "I can help with weather.", "role": "assistant"}],
                "available_tools": [
                    {
                        "type": "function",
                        "function": {
                            "name": "get_weather",
                            "description": "Get current weather",
                            "parameters": {
                                "type": "object",
                                "properties": {"location": {"type": "string"}},
                                "required": ["location"],
                            },
                        },
                    }
                ],
            },
            id="llm-span-with-output-messages-and-single-tool",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "I have multiple tools."),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                        (
                            f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}",
                            json.dumps(
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "parameters": {"type": "object"},
                                    },
                                }
                            ),
                        ),
                        (
                            f"{SpanAttributes.LLM_TOOLS}.1.{ToolAttributes.TOOL_JSON_SCHEMA}",
                            json.dumps(
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "send_email",
                                        "parameters": {"type": "object"},
                                    },
                                }
                            ),
                        ),
                    )
                ),
            ),
            {
                "messages": [{"content": "I have multiple tools.", "role": "assistant"}],
                "available_tools": [
                    {
                        "type": "function",
                        "function": {"name": "get_weather", "parameters": {"type": "object"}},
                    },
                    {
                        "type": "function",
                        "function": {"name": "send_email", "parameters": {"type": "object"}},
                    },
                ],
            },
            id="llm-span-with-output-messages-and-multiple-tools",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "No tools here."),
                        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
                    )
                ),
            ),
            {"messages": [{"content": "No tools here.", "role": "assistant"}]},
            id="llm-span-without-tools",
        ),
        pytest.param(
            Span(
                span_kind=LLM,
                attributes=unflatten(
                    (
                        (OUTPUT_VALUE, "plain-text-output"),
                        (OUTPUT_MIME_TYPE, TEXT),
                        (
                            f"{SpanAttributes.LLM_TOOLS}.0.{ToolAttributes.TOOL_JSON_SCHEMA}",
                            json.dumps(
                                {
                                    "type": "function",
                                    "function": {
                                        "name": "calculator",
                                        "parameters": {"type": "object"},
                                    },
                                }
                            ),
                        ),
                    )
                ),
            ),
            {
                "output": "plain-text-output",
                "available_tools": [
                    {
                        "type": "function",
                        "function": {"name": "calculator", "parameters": {"type": "object"}},
                    }
                ],
            },
            id="llm-span-with-plain-text-output-and-tools",
        ),
    ],
)
def test_get_experiment_example_output(span: Span, expected_output_value: dict[str, Any]) -> None:
    output_value = get_experiment_example_output(span)
    assert expected_output_value == output_value
