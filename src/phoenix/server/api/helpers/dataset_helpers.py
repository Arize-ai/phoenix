import json
from collections.abc import Mapping
from typing import Any, Literal, Optional

from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)

from phoenix.db.models import Span
from phoenix.trace.attributes import get_attribute_value


def get_dataset_example_input(span: Span) -> dict[str, Any]:
    """
    Extracts the input value from a span and returns it as a dictionary. Input
    values from LLM spans are extracted from the input messages and prompt
    template variables (if present). For other span kinds, the input is
    extracted from the input value and input mime type attributes.
    """
    span_kind = span.span_kind
    attributes = span.attributes
    input_value = get_attribute_value(attributes, INPUT_VALUE)
    input_mime_type = get_attribute_value(attributes, INPUT_MIME_TYPE)
    prompt_template_variables = get_attribute_value(attributes, LLM_PROMPT_TEMPLATE_VARIABLES)
    input_messages = get_attribute_value(attributes, LLM_INPUT_MESSAGES)
    tool_definitions = []
    if tools := get_attribute_value(attributes, LLM_TOOLS):
        for tool in tools:
            if definition := get_attribute_value(tool, TOOL_DEFINITION):
                tool_definitions.append(definition)
    if span_kind == LLM:
        return _get_llm_span_input(
            input_messages=input_messages,
            input_value=input_value,
            input_mime_type=input_mime_type,
            prompt_template_variables=prompt_template_variables,
            tools=tool_definitions,
        )
    return _get_generic_io_value(io_value=input_value, mime_type=input_mime_type, kind="input")


def get_dataset_example_output(span: Span) -> dict[str, Any]:
    """
    Extracts the output value from a span and returns it as a dictionary. Output
    values from LLM spans are extracted from the output messages (if present).
    Output from retriever spans are extracted from the retrieval documents (if
    present). For other span kinds, the output is extracted from the output
    value and output mime type attributes.
    """
    span_kind = span.span_kind
    attributes = span.attributes
    output_value = get_attribute_value(attributes, OUTPUT_VALUE)
    output_mime_type = get_attribute_value(attributes, OUTPUT_MIME_TYPE)
    output_messages = get_attribute_value(attributes, LLM_OUTPUT_MESSAGES)
    retrieval_documents = get_attribute_value(attributes, RETRIEVAL_DOCUMENTS)
    if span_kind == LLM:
        return _get_llm_span_output(
            output_messages=output_messages,
            output_value=output_value,
            output_mime_type=output_mime_type,
        )
    if span_kind == OpenInferenceSpanKindValues.RETRIEVER.value:
        return _get_retriever_span_output(
            retrieval_documents=retrieval_documents,
            output_value=output_value,
            output_mime_type=output_mime_type,
        )
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="output")


def _get_llm_span_input(
    input_messages: Any,
    input_value: Any,
    input_mime_type: Optional[str],
    prompt_template_variables: Any,
    tools: Any,
) -> dict[str, Any]:
    """
    Extracts the input value from an LLM span and returns it as a dictionary.
    The input is extracted from the input messages (if present) and prompt
    template variables (if present).
    """
    input: dict[str, Any] = {}
    if messages := [_get_message(m) for m in input_messages or ()]:
        input["messages"] = messages
    if not input:
        input = _get_generic_io_value(io_value=input_value, mime_type=input_mime_type, kind="input")
    if prompt_template_variables_data := _safely_json_decode(prompt_template_variables):
        # Hoist template variables to top level as individual key-value pairs
        input.update(prompt_template_variables_data)
        # Keep the original nested structure for compatibility
    if tool_definitions_data := [_safely_json_decode(tool_definition) for tool_definition in tools]:
        input["tools"] = tool_definitions_data
    return input


def _get_llm_span_output(
    output_messages: Any,
    output_value: Any,
    output_mime_type: Optional[str],
) -> dict[str, Any]:
    """
    Extracts the output value from an LLM span and returns it as a dictionary.
    The output is extracted from the output messages (if present).
    """
    if messages := [_get_message(m) for m in output_messages or ()]:
        return {"messages": messages}
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="output")


def _get_retriever_span_output(
    retrieval_documents: Any,
    output_value: Any,
    output_mime_type: Optional[str],
) -> dict[str, Any]:
    """
    Extracts the output value from a retriever span and returns it as a dictionary.
    The output is extracted from the retrieval documents (if present).
    """
    if (retrieval_documents := _parse_retrieval_documents(retrieval_documents)) is not None:
        return {"documents": retrieval_documents}
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="output")


def _get_generic_io_value(
    io_value: Any, mime_type: Optional[str], kind: Literal["input", "output"]
) -> dict[str, Any]:
    """
    Makes a best-effort attempt to extract the input or output value from a span
    and returns it as a dictionary.
    """
    if (
        mime_type == OpenInferenceMimeTypeValues.JSON.value
        and (io_value_data := _safely_json_decode(io_value)) is not None
    ):
        if isinstance(io_value_data, dict):
            return io_value_data
        else:
            return {kind: io_value_data}
    if isinstance(io_value, str):
        return {kind: io_value}
    return {}


def _get_message(message: Mapping[str, Any]) -> dict[str, Any]:
    content = get_attribute_value(message, MESSAGE_CONTENT)
    name = get_attribute_value(message, MESSAGE_NAME)
    function_call_name = get_attribute_value(message, MESSAGE_FUNCTION_CALL_NAME)
    function_call_arguments = get_attribute_value(message, MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON)
    function_call = (
        {"name": function_call_name, "arguments": function_call_arguments}
        if function_call_name is not None or function_call_arguments is not None
        else None
    )
    tool_calls = [
        {
            "function": {
                "name": get_attribute_value(tool_call, TOOL_CALL_FUNCTION_NAME),
                "arguments": get_attribute_value(tool_call, TOOL_CALL_FUNCTION_ARGUMENTS_JSON),
            }
        }
        for tool_call in get_attribute_value(message, MESSAGE_TOOL_CALLS) or ()
    ]
    return {
        "role": get_attribute_value(message, MESSAGE_ROLE),
        **({"content": content} if content is not None else {}),
        **({"name": name} if name is not None else {}),
        **({"function_call": function_call} if function_call is not None else {}),
        **({"tool_calls": tool_calls} if tool_calls else {}),
    }


def _parse_retrieval_documents(retrieval_documents: Any) -> Optional[list[dict[str, Any]]]:
    """
    Safely un-nests a list of retrieval documents.

    Example: [{"document": {"content": "..."}}] -> [{"content": "..."}]
    """
    if not isinstance(retrieval_documents, list):
        return None
    docs = []
    for retrieval_doc in retrieval_documents:
        if not isinstance(retrieval_doc, dict) or not (doc := retrieval_doc.get("document")):
            return None
        docs.append(doc)
    return docs


def _safely_json_decode(value: Any) -> Any:
    """
    Safely decodes a JSON-encoded value.
    """
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


# MessageAttributes
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = MessageAttributes.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON
MESSAGE_FUNCTION_CALL_NAME = MessageAttributes.MESSAGE_FUNCTION_CALL_NAME
MESSAGE_NAME = MessageAttributes.MESSAGE_NAME
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

# OpenInferenceSpanKindValues
LLM = OpenInferenceSpanKindValues.LLM.value

# SpanAttributes
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

# ToolCallAttributes
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME

# ToolAttributes
LLM_TOOLS = SpanAttributes.LLM_TOOLS
TOOL_DEFINITION = ToolAttributes.TOOL_JSON_SCHEMA
