import json
from typing import Any, Dict, Literal, Mapping, Optional, Protocol

from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    ToolCallAttributes,
)

from phoenix.trace.attributes import get_attribute_value


class HasSpanIO(Protocol):
    """
    An interface that contains the information needed to extract dataset example
    input and output values from a span.
    """

    span_kind: Optional[str]
    input_value: Any
    input_mime_type: Optional[str]
    output_value: Any
    output_mime_type: Optional[str]
    llm_prompt_template_variables: Any
    llm_input_messages: Any
    llm_output_messages: Any
    retrieval_documents: Any


def get_dataset_example_input(span: HasSpanIO) -> Dict[str, Any]:
    """
    Extracts the input value from a span and returns it as a dictionary. Input
    values from LLM spans are extracted from the input messages and prompt
    template variables (if present). For other span kinds, the input is
    extracted from the input value and input mime type attributes.
    """
    input_value = span.input_value
    input_mime_type = span.input_mime_type
    if span.span_kind == OpenInferenceSpanKindValues.LLM.value:
        return _get_llm_span_input(
            input_messages=span.llm_input_messages,
            input_value=input_value,
            input_mime_type=input_mime_type,
            prompt_template_variables=span.llm_prompt_template_variables,
        )
    return _get_generic_io_value(io_value=input_value, mime_type=input_mime_type, kind="input")


def get_dataset_example_output(span: HasSpanIO) -> Dict[str, Any]:
    """
    Extracts the output value from a span and returns it as a dictionary. Output
    values from LLM spans are extracted from the output messages (if present).
    Output from retriever spans are extracted from the retrieval documents (if
    present). For other span kinds, the output is extracted from the output
    value and output mime type attributes.
    """

    output_value = span.output_value
    output_mime_type = span.output_mime_type
    if (span_kind := span.span_kind) == OpenInferenceSpanKindValues.LLM.value:
        return _get_llm_span_output(
            output_messages=span.llm_output_messages,
            output_value=output_value,
            output_mime_type=output_mime_type,
        )
    if span_kind == OpenInferenceSpanKindValues.RETRIEVER.value:
        return _get_retriever_span_output(
            retrieval_documents=span.retrieval_documents,
            output_value=output_value,
            output_mime_type=output_mime_type,
        )
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="output")


def _get_llm_span_input(
    input_messages: Any,
    input_value: Any,
    input_mime_type: Optional[str],
    prompt_template_variables: Any,
) -> Dict[str, Any]:
    """
    Extracts the input value from an LLM span and returns it as a dictionary.
    The input is extracted from the input messages (if present) and prompt
    template variables (if present).
    """
    input: Dict[str, Any] = {}
    if messages := [_get_message(m) for m in input_messages or ()]:
        input["messages"] = messages
    if not input:
        input = _get_generic_io_value(io_value=input_value, mime_type=input_mime_type, kind="input")
    if prompt_template_variables:
        input = {**input, "prompt_template_variables": prompt_template_variables}
    return input


def _get_llm_span_output(
    output_messages: Any,
    output_value: Any,
    output_mime_type: Optional[str],
) -> Dict[str, Any]:
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
) -> Dict[str, Any]:
    """
    Extracts the output value from a retriever span and returns it as a dictionary.
    The output is extracted from the retrieval documents (if present).
    """
    if retrieval_documents is not None:
        return {"documents": retrieval_documents}
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="output")


def _get_generic_io_value(
    io_value: Any, mime_type: Optional[str], kind: Literal["input", "output"]
) -> Dict[str, Any]:
    """
    Makes a best-effort attempt to extract the input or output value from a span
    and returns it as a dictionary.
    """
    if mime_type == OpenInferenceMimeTypeValues.JSON.value:
        parsed_value = json.loads(io_value)
        if isinstance(parsed_value, dict):
            return parsed_value
        else:
            return {kind: parsed_value}
    if isinstance(io_value, str):
        return {kind: io_value}
    return {}


def _get_message(message: Mapping[str, Any]) -> Dict[str, Any]:
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


MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = MessageAttributes.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON
MESSAGE_FUNCTION_CALL_NAME = MessageAttributes.MESSAGE_FUNCTION_CALL_NAME
MESSAGE_NAME = MessageAttributes.MESSAGE_NAME
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
