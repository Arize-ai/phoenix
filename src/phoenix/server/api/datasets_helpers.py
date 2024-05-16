from typing import Any, Dict, Literal, Optional, Protocol

from openinference.semconv.trace import OpenInferenceMimeTypeValues, OpenInferenceSpanKindValues


class HasSpanIOAttributes(Protocol):
    span_kind: Optional[str]
    input_value: Any
    input_mime_type: Optional[str]
    output_value: Any
    output_mime_type: Optional[str]
    prompt_template_variables: Any
    llm_input_messages: Any
    llm_output_messages: Any
    retrieval_documents: Any


def get_dataset_example_input(span: HasSpanIOAttributes) -> Dict[str, Any]:
    input_value = span.input_value
    input_mime_type = span.input_mime_type
    if span.span_kind == OpenInferenceSpanKindValues.LLM.value:
        return _get_llm_span_input(
            llm_input_messages=span.llm_input_messages,
            input_value=input_value,
            input_mime_type=input_mime_type,
            prompt_template_variables=span.prompt_template_variables,
        )
    return _get_generic_io_value(io_value=input_value, mime_type=input_mime_type, kind="input")


def get_dataset_example_output(span: HasSpanIOAttributes) -> Dict[str, Any]:
    output_value = span.output_value
    output_mime_type = span.output_mime_type
    if (span_kind := span.span_kind) == OpenInferenceSpanKindValues.LLM.value:
        return _get_llm_span_output(
            llm_output_messages=span.llm_output_messages,
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
    llm_input_messages: Any,
    input_value: Any,
    input_mime_type: Optional[str],
    prompt_template_variables: Any,
) -> Dict[str, Any]:
    input: Dict[str, Any]
    if llm_input_messages is not None:
        input = {"input_messages": llm_input_messages}
    else:
        input = _get_generic_io_value(io_value=input_value, mime_type=input_mime_type, kind="input")
    if prompt_template_variables:
        input = {**input, "prompt_template_variables": prompt_template_variables}
    return input


def _get_llm_span_output(
    llm_output_messages: Any,
    output_value: Any,
    output_mime_type: Optional[str],
) -> Dict[str, Any]:
    if llm_output_messages is not None:
        return {"output_messages": llm_output_messages}
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="input")


def _get_retriever_span_output(
    retrieval_documents: Any,
    output_value: Any,
    output_mime_type: Optional[str],
) -> Dict[str, Any]:
    if retrieval_documents is not None:
        return {"retrieval_documents": retrieval_documents}
    return _get_generic_io_value(io_value=output_value, mime_type=output_mime_type, kind="input")


def _get_generic_io_value(
    io_value: Any, mime_type: Optional[str], kind: Literal["input", "output"]
) -> Dict[str, Any]:
    if isinstance(io_value, str) and (
        mime_type == OpenInferenceMimeTypeValues.TEXT.value or mime_type is None
    ):
        return {kind: io_value}
    if isinstance(io_value, dict) and (
        mime_type == OpenInferenceMimeTypeValues.JSON.value or mime_type is None
    ):
        return io_value
    return {}
