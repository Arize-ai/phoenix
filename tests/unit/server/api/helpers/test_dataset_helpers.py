import json
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
    _normalize_tool_definition_to_openai,
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

# ToolAttributes
LLM_TOOLS = SpanAttributes.LLM_TOOLS
TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA

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
    ],
)
def test_get_dataset_example_output(span: Span, expected_output_value: dict[str, Any]) -> None:
    output_value = get_dataset_example_output(span)
    assert expected_output_value == output_value


@pytest.mark.parametrize(
    "tool_def,expected_type,expected_name",
    [
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                    },
                },
            },
            "function",
            "get_weather",
            id="openai-format-passthrough",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "description": "Get the weather",
                "input_schema": {"type": "object", "properties": {"location": {"type": "string"}}},
            },
            "function",
            "get_weather",
            id="anthropic-format-normalized",
        ),
        pytest.param(
            {
                "toolSpec": {
                    "name": "get_weather",
                    "description": "Get the weather",
                    "inputSchema": {
                        "json": {"type": "object", "properties": {"location": {"type": "string"}}}
                    },
                }
            },
            "function",
            "get_weather",
            id="bedrock-format-normalized",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "description": "Get the weather",
                "parameters": {"type": "object", "properties": {"location": {"type": "string"}}},
            },
            "function",
            "get_weather",
            id="gemini-format-normalized",
        ),
        pytest.param(
            {"some_weird_key": "some_value", "another_key": {"nested": "data"}},
            None,
            None,
            id="unknown-format-unchanged",
        ),
    ],
)
def test_normalize_tool_definition_to_openai(
    tool_def: dict[str, Any], expected_type: Optional[str], expected_name: Optional[str]
) -> None:
    """Test tool definition normalization across different provider formats"""
    result = _normalize_tool_definition_to_openai(tool_def)

    if expected_type is None:
        # Unknown format should be returned as-is
        assert result == tool_def
    else:
        # All known formats should normalize to OpenAI structure
        assert result["type"] == expected_type
        assert result["function"]["name"] == expected_name


@pytest.mark.parametrize(
    "tools,expected_count",
    [
        pytest.param(
            [
                {
                    "type": "function",
                    "function": {"name": "get_weather", "parameters": {"type": "object"}},
                }
            ],
            1,
            id="openai-tool",
        ),
        pytest.param(
            [{"name": "get_weather", "input_schema": {"type": "object"}}],
            1,
            id="anthropic-tool-normalized",
        ),
        pytest.param(
            [
                {
                    "type": "function",
                    "function": {"name": "openai_tool", "parameters": {"type": "object"}},
                },
                {"name": "anthropic_tool", "input_schema": {"type": "object"}},
            ],
            2,
            id="mixed-providers",
        ),
        pytest.param([], 0, id="no-tools"),
    ],
)
def test_get_experiment_example_output_with_tools(
    tools: list[dict[str, Any]], expected_count: int
) -> None:
    """Test experiment output includes normalized available_tools"""
    attributes_list = [
        (INPUT_VALUE, "input"),
        (OUTPUT_VALUE, "output"),
        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", "assistant response"),
        (f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"),
    ]

    for idx, tool in enumerate(tools):
        attributes_list.append((f"{LLM_TOOLS}.{idx}.{TOOL_JSON_SCHEMA}", json.dumps(tool)))

    span = Span(span_kind=LLM, attributes=unflatten(tuple(attributes_list)))
    result = get_experiment_example_output(span)

    assert "available_tools" in result
    assert len(result["available_tools"]) == expected_count

    # All tools should be normalized to OpenAI format
    for tool in result["available_tools"]:
        assert tool["type"] == "function"
        assert "name" in tool["function"]
