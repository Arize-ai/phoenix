"""Convert OTel GenAI semantic-convention attributes back to OpenInference attributes."""

import json
from collections.abc import Mapping, Sequence
from enum import Enum
from typing import Any, Optional, TypeVar

from openinference.semconv.trace import (
    DocumentAttributes,
    ImageAttributes,
    MessageAttributes,
    MessageContentAttributes,
    OpenInferenceLLMProviderValues,
    OpenInferenceLLMSystemValues,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.semconv._incubating.attributes import gen_ai_attributes as gen_ai
from opentelemetry.semconv._incubating.attributes.gen_ai_attributes import (
    GenAiOperationNameValues,
    GenAiOutputTypeValues,
    GenAiProviderNameValues,
)
from opentelemetry.util.types import AttributeValue
from pydantic import RootModel, ValidationError

from phoenix.trace.gen_ai.__generated__.models import (
    BlobPart,
    ChatMessage,
    FunctionToolDefinition,
    GenericToolDefinition,
    InputMessages,
    OutputMessage,
    OutputMessages,
    RetrievalDocument,
    RetrievalDocuments,
    Role,
    SystemInstructions,
    TextPart,
    ToolCallRequestPart,
    ToolCallResponsePart,
    ToolDefinitions,
    UriPart,
)

# Pinned locally because they aren't yet exposed by opentelemetry-semantic-conventions
# (as of 0.62b1). All names and values are from the OTel semconv spec v1.41.1.

_GEN_AI_REQUEST_STREAM = "gen_ai.request.stream"
"""Attribute: whether the GenAI request was made in streaming mode. Added in
semconv v1.41; not yet exposed in opentelemetry-semantic-conventions."""


def get_openinference_attributes(
    attributes: Optional[Mapping[str, AttributeValue]],
) -> dict[str, AttributeValue]:
    if not attributes:
        return {}
    # Hot-path bail: every code path below reads at least one ``gen_ai.*`` key,
    # so a span with no semconv attrs (HTTP middleware, DB queries, etc.) gets
    # no OI synthesis. One short-circuiting any() beats ~30 dict lookups per span.
    if not any(k.startswith("gen_ai.") for k in attributes):
        return {}

    span_kind = _infer_span_kind(attributes)
    oi_attributes: dict[str, AttributeValue] = {}
    if span_kind is not None:
        oi_attributes[SpanAttributes.OPENINFERENCE_SPAN_KIND] = span_kind

    oi_attributes.update(get_openinference_base_attributes(attributes))
    oi_attributes.update(get_openinference_request_attributes(attributes, span_kind=span_kind))
    oi_attributes.update(get_openinference_usage_attributes(attributes))
    oi_attributes.update(get_openinference_message_attributes(attributes))
    oi_attributes.update(get_openinference_response_attributes(attributes))
    oi_attributes.update(get_openinference_tool_attributes(attributes, span_kind=span_kind))
    oi_attributes.update(get_openinference_retrieval_attributes(attributes, span_kind=span_kind))
    oi_attributes.update(get_openinference_embedding_attributes(attributes, span_kind=span_kind))
    return oi_attributes


def get_openinference_base_attributes(
    attributes: Mapping[str, AttributeValue],
) -> dict[str, AttributeValue]:
    oi_attributes: dict[str, AttributeValue] = {}

    provider, system = _resolve_provider_and_system(attributes)
    if provider is not None:
        oi_attributes[SpanAttributes.LLM_PROVIDER] = provider
    if system is not None:
        oi_attributes[SpanAttributes.LLM_SYSTEM] = system

    if conversation_id := _as_optional_str(attributes.get(gen_ai.GEN_AI_CONVERSATION_ID)):
        oi_attributes[SpanAttributes.SESSION_ID] = conversation_id

    return oi_attributes


def get_openinference_request_attributes(
    attributes: Mapping[str, AttributeValue],
    *,
    span_kind: Optional[str] = None,
) -> dict[str, AttributeValue]:
    oi_attributes: dict[str, AttributeValue] = {}

    if request_model := _as_optional_str(attributes.get(gen_ai.GEN_AI_REQUEST_MODEL)):
        if span_kind == OpenInferenceSpanKindValues.EMBEDDING.value:
            oi_attributes[SpanAttributes.EMBEDDING_MODEL_NAME] = request_model
        else:
            oi_attributes[SpanAttributes.LLM_MODEL_NAME] = request_model

    invocation_parameters = _build_invocation_parameters(attributes)
    if invocation_parameters:
        target_key = (
            SpanAttributes.EMBEDDING_INVOCATION_PARAMETERS
            if span_kind == OpenInferenceSpanKindValues.EMBEDDING.value
            else SpanAttributes.LLM_INVOCATION_PARAMETERS
        )
        oi_attributes[target_key] = json.dumps(invocation_parameters, ensure_ascii=False)

    return oi_attributes


def get_openinference_usage_attributes(
    attributes: Mapping[str, AttributeValue],
) -> dict[str, AttributeValue]:
    oi_attributes: dict[str, AttributeValue] = {}

    input_tokens = _coerce_int(attributes.get(gen_ai.GEN_AI_USAGE_INPUT_TOKENS))
    output_tokens = _coerce_int(attributes.get(gen_ai.GEN_AI_USAGE_OUTPUT_TOKENS))
    cache_read = _coerce_int(attributes.get(gen_ai.GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS))
    cache_write = _coerce_int(attributes.get(gen_ai.GEN_AI_USAGE_CACHE_CREATION_INPUT_TOKENS))

    if input_tokens is not None:
        oi_attributes[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = input_tokens
    if output_tokens is not None:
        oi_attributes[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = output_tokens
    if input_tokens is not None and output_tokens is not None:
        oi_attributes[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = input_tokens + output_tokens
    if cache_read is not None:
        oi_attributes[SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ] = cache_read
    if cache_write is not None:
        oi_attributes[SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] = cache_write

    return oi_attributes


def get_openinference_message_attributes(
    attributes: Mapping[str, AttributeValue],
) -> dict[str, AttributeValue]:
    oi_attributes: dict[str, AttributeValue] = {}

    # OTel emits the system prompt as a separate ``gen_ai.system_instructions``
    # attribute (a flat list of parts). Project it into OI's message surface as a
    # synthetic system-role message at input_messages.0, shifting the actual
    # user/assistant turns down by one.
    next_input_index = 0
    sys_parts = _validate_root_list(
        attributes.get(gen_ai.GEN_AI_SYSTEM_INSTRUCTIONS), SystemInstructions
    )
    if sys_parts:
        sys_msg = ChatMessage.model_construct(role=Role.system, parts=list(sys_parts))
        oi_attributes.update(
            _flatten_message(sys_msg, SpanAttributes.LLM_INPUT_MESSAGES, next_input_index)
        )
        next_input_index += 1

    for in_msg in _validate_root_list(attributes.get(gen_ai.GEN_AI_INPUT_MESSAGES), InputMessages):
        oi_attributes.update(
            _flatten_message(in_msg, SpanAttributes.LLM_INPUT_MESSAGES, next_input_index)
        )
        next_input_index += 1

    for index, out_msg in enumerate(
        _validate_root_list(attributes.get(gen_ai.GEN_AI_OUTPUT_MESSAGES), OutputMessages)
    ):
        oi_attributes.update(_flatten_message(out_msg, SpanAttributes.LLM_OUTPUT_MESSAGES, index))

    return oi_attributes


def get_openinference_response_attributes(
    attributes: Mapping[str, AttributeValue],
) -> dict[str, AttributeValue]:
    oi_attributes: dict[str, AttributeValue] = {}

    finish_reasons = attributes.get(gen_ai.GEN_AI_RESPONSE_FINISH_REASONS)
    normalized_reasons = _coerce_string_sequence(finish_reasons)
    if normalized_reasons:
        if len(normalized_reasons) == 1:
            oi_attributes[SpanAttributes.LLM_FINISH_REASON] = normalized_reasons[0]
        else:
            oi_attributes[SpanAttributes.LLM_FINISH_REASON] = normalized_reasons

    response_payload: dict[str, Any] = {}
    if response_id := _as_optional_str(attributes.get(gen_ai.GEN_AI_RESPONSE_ID)):
        response_payload["id"] = response_id
    if response_model := _as_optional_str(attributes.get(gen_ai.GEN_AI_RESPONSE_MODEL)):
        response_payload["model"] = response_model
    if response_payload:
        oi_attributes[SpanAttributes.OUTPUT_VALUE] = json.dumps(
            response_payload, ensure_ascii=False
        )
        oi_attributes[SpanAttributes.OUTPUT_MIME_TYPE] = OpenInferenceMimeTypeValues.JSON.value

    return oi_attributes


def get_openinference_tool_attributes(
    attributes: Mapping[str, AttributeValue],
    *,
    span_kind: Optional[str] = None,
) -> dict[str, AttributeValue]:
    oi_attributes: dict[str, AttributeValue] = {}

    for index, definition in enumerate(
        _validate_tool_definitions(attributes.get(gen_ai.GEN_AI_TOOL_DEFINITIONS))
    ):
        key = f"{SpanAttributes.LLM_TOOLS}.{index}.{ToolAttributes.TOOL_JSON_SCHEMA}"
        oi_attributes[key] = json.dumps(_definition_to_oi_schema(definition), ensure_ascii=False)

    if span_kind != OpenInferenceSpanKindValues.TOOL.value:
        return oi_attributes

    if tool_name := _as_optional_str(attributes.get(gen_ai.GEN_AI_TOOL_NAME)):
        oi_attributes[SpanAttributes.TOOL_NAME] = tool_name
    tool_description = _as_optional_str(attributes.get(gen_ai.GEN_AI_TOOL_DESCRIPTION))
    if tool_description:
        oi_attributes[SpanAttributes.TOOL_DESCRIPTION] = tool_description
    if tool_call_id := _as_optional_str(attributes.get(gen_ai.GEN_AI_TOOL_CALL_ID)):
        oi_attributes[SpanAttributes.TOOL_ID] = tool_call_id

    raw_arguments = attributes.get(gen_ai.GEN_AI_TOOL_CALL_ARGUMENTS)
    if raw_arguments is not None:
        parsed_arguments = _maybe_parse_json(raw_arguments)
        if isinstance(parsed_arguments, Mapping):
            oi_attributes[SpanAttributes.TOOL_PARAMETERS] = json.dumps(
                dict(parsed_arguments), ensure_ascii=False
            )
        else:
            oi_attributes[SpanAttributes.TOOL_PARAMETERS] = _as_string(raw_arguments)

    if (result := attributes.get(gen_ai.GEN_AI_TOOL_CALL_RESULT)) is not None:
        oi_attributes[SpanAttributes.OUTPUT_VALUE] = _as_string(result)
        parsed_result = _maybe_parse_json(result)
        if isinstance(parsed_result, (Mapping, list)):
            oi_attributes[SpanAttributes.OUTPUT_MIME_TYPE] = OpenInferenceMimeTypeValues.JSON.value

    return oi_attributes


def get_openinference_retrieval_attributes(
    attributes: Mapping[str, AttributeValue],
    *,
    span_kind: Optional[str] = None,
) -> dict[str, AttributeValue]:
    if span_kind != OpenInferenceSpanKindValues.RETRIEVER.value:
        return {}

    oi_attributes: dict[str, AttributeValue] = {}

    if query_text := _as_optional_str(attributes.get(gen_ai.GEN_AI_RETRIEVAL_QUERY_TEXT)):
        oi_attributes[SpanAttributes.INPUT_VALUE] = query_text
        oi_attributes[SpanAttributes.INPUT_MIME_TYPE] = OpenInferenceMimeTypeValues.TEXT.value

    for index, document in enumerate(
        _validate_root_list(attributes.get(gen_ai.GEN_AI_RETRIEVAL_DOCUMENTS), RetrievalDocuments)
    ):
        oi_attributes.update(_flatten_document(document, index))

    return oi_attributes


def get_openinference_embedding_attributes(
    attributes: Mapping[str, AttributeValue],
    *,
    span_kind: Optional[str] = None,
) -> dict[str, AttributeValue]:
    if span_kind != OpenInferenceSpanKindValues.EMBEDDING.value:
        return {}
    # gen_ai.embeddings.dimension.count cannot be inverted to a vector; the dimension
    # alone is not part of OI's embedding attribute surface. Skip silently.
    return {}


def _infer_span_kind(attributes: Mapping[str, AttributeValue]) -> Optional[str]:
    operation = _as_optional_str(attributes.get(gen_ai.GEN_AI_OPERATION_NAME))
    if operation is None:
        if attributes.get(gen_ai.GEN_AI_TOOL_CALL_ID) or attributes.get(gen_ai.GEN_AI_TOOL_NAME):
            return OpenInferenceSpanKindValues.TOOL.value
        if attributes.get(gen_ai.GEN_AI_RETRIEVAL_DOCUMENTS) or attributes.get(
            gen_ai.GEN_AI_RETRIEVAL_QUERY_TEXT
        ):
            return OpenInferenceSpanKindValues.RETRIEVER.value
        if attributes.get(gen_ai.GEN_AI_EMBEDDINGS_DIMENSION_COUNT) is not None:
            return OpenInferenceSpanKindValues.EMBEDDING.value
        if (
            attributes.get(gen_ai.GEN_AI_INPUT_MESSAGES)
            or attributes.get(gen_ai.GEN_AI_OUTPUT_MESSAGES)
            or attributes.get(gen_ai.GEN_AI_REQUEST_MODEL)
        ):
            return OpenInferenceSpanKindValues.LLM.value
        return None

    if operation in {
        GenAiOperationNameValues.CHAT.value,
        GenAiOperationNameValues.TEXT_COMPLETION.value,
        GenAiOperationNameValues.GENERATE_CONTENT.value,
    }:
        return OpenInferenceSpanKindValues.LLM.value
    if operation == GenAiOperationNameValues.EMBEDDINGS.value:
        return OpenInferenceSpanKindValues.EMBEDDING.value
    if operation == GenAiOperationNameValues.EXECUTE_TOOL.value:
        return OpenInferenceSpanKindValues.TOOL.value
    if operation == GenAiOperationNameValues.RETRIEVAL.value:
        return OpenInferenceSpanKindValues.RETRIEVER.value
    if operation in {
        GenAiOperationNameValues.INVOKE_AGENT.value,
        GenAiOperationNameValues.CREATE_AGENT.value,
    }:
        return OpenInferenceSpanKindValues.AGENT.value
    return None


_PROVIDER_NAME_TO_OI: dict[str, tuple[Optional[str], Optional[str]]] = {
    GenAiProviderNameValues.OPENAI.value: (
        OpenInferenceLLMProviderValues.OPENAI.value,
        OpenInferenceLLMSystemValues.OPENAI.value,
    ),
    GenAiProviderNameValues.ANTHROPIC.value: (
        OpenInferenceLLMProviderValues.ANTHROPIC.value,
        OpenInferenceLLMSystemValues.ANTHROPIC.value,
    ),
    GenAiProviderNameValues.COHERE.value: (
        OpenInferenceLLMProviderValues.COHERE.value,
        OpenInferenceLLMSystemValues.COHERE.value,
    ),
    GenAiProviderNameValues.MISTRAL_AI.value: (
        OpenInferenceLLMProviderValues.MISTRALAI.value,
        OpenInferenceLLMSystemValues.MISTRALAI.value,
    ),
    GenAiProviderNameValues.DEEPSEEK.value: (
        OpenInferenceLLMProviderValues.DEEPSEEK.value,
        None,
    ),
    GenAiProviderNameValues.GROQ.value: (
        OpenInferenceLLMProviderValues.GROQ.value,
        None,
    ),
    GenAiProviderNameValues.PERPLEXITY.value: (
        OpenInferenceLLMProviderValues.PERPLEXITY.value,
        None,
    ),
    GenAiProviderNameValues.X_AI.value: (
        OpenInferenceLLMProviderValues.XAI.value,
        None,
    ),
    GenAiProviderNameValues.AZURE_AI_OPENAI.value: (
        OpenInferenceLLMProviderValues.AZURE.value,
        OpenInferenceLLMSystemValues.OPENAI.value,
    ),
    GenAiProviderNameValues.AZURE_AI_INFERENCE.value: (
        OpenInferenceLLMProviderValues.AZURE.value,
        None,
    ),
    GenAiProviderNameValues.AWS_BEDROCK.value: (
        OpenInferenceLLMProviderValues.AWS.value,
        None,
    ),
    GenAiProviderNameValues.GCP_VERTEX_AI.value: (
        OpenInferenceLLMProviderValues.GOOGLE.value,
        OpenInferenceLLMSystemValues.VERTEXAI.value,
    ),
    GenAiProviderNameValues.GCP_GEN_AI.value: (
        OpenInferenceLLMProviderValues.GOOGLE.value,
        None,
    ),
    GenAiProviderNameValues.GCP_GEMINI.value: (
        OpenInferenceLLMProviderValues.GOOGLE.value,
        None,
    ),
}


def _resolve_provider_and_system(
    attributes: Mapping[str, AttributeValue],
) -> tuple[Optional[str], Optional[str]]:
    provider_name = _as_optional_str(attributes.get(gen_ai.GEN_AI_PROVIDER_NAME))
    if provider_name is None:
        # Some external instrumentations only set the legacy `gen_ai.system` attribute.
        legacy_system = _as_optional_str(attributes.get(gen_ai.GEN_AI_SYSTEM))
        if legacy_system is None:
            return None, None
        provider_name = legacy_system.lower()
    return _PROVIDER_NAME_TO_OI.get(provider_name, (None, provider_name))


_REQUEST_PARAMETER_KEYS: tuple[tuple[str, str], ...] = (
    (gen_ai.GEN_AI_REQUEST_TEMPERATURE, "temperature"),
    (gen_ai.GEN_AI_REQUEST_TOP_P, "top_p"),
    (gen_ai.GEN_AI_REQUEST_TOP_K, "top_k"),
    (gen_ai.GEN_AI_REQUEST_MAX_TOKENS, "max_tokens"),
    (gen_ai.GEN_AI_REQUEST_FREQUENCY_PENALTY, "frequency_penalty"),
    (gen_ai.GEN_AI_REQUEST_PRESENCE_PENALTY, "presence_penalty"),
    (gen_ai.GEN_AI_REQUEST_SEED, "seed"),
    (_GEN_AI_REQUEST_STREAM, "stream"),
    (gen_ai.GEN_AI_REQUEST_CHOICE_COUNT, "n"),
)


def _build_invocation_parameters(
    attributes: Mapping[str, AttributeValue],
) -> dict[str, Any]:
    parameters: dict[str, Any] = {}

    for genai_key, oi_key in _REQUEST_PARAMETER_KEYS:
        if genai_key in attributes:
            value = attributes[genai_key]
            if value is not None:
                parameters[oi_key] = _jsonable_attribute_value(value)

    if stop := _coerce_string_sequence(attributes.get(gen_ai.GEN_AI_REQUEST_STOP_SEQUENCES)):
        parameters["stop"] = list(stop)

    if encoding_formats := _coerce_string_sequence(
        attributes.get(gen_ai.GEN_AI_REQUEST_ENCODING_FORMATS)
    ):
        # OpenAI's embeddings API uses singular `encoding_format`; preserve plural when len > 1.
        if len(encoding_formats) == 1:
            parameters["encoding_format"] = encoding_formats[0]
        else:
            parameters["encoding_formats"] = list(encoding_formats)

    if output_type := _as_optional_str(attributes.get(gen_ai.GEN_AI_OUTPUT_TYPE)):
        if output_type == GenAiOutputTypeValues.JSON.value:
            parameters["response_format"] = {"type": "json_object"}
        elif output_type == GenAiOutputTypeValues.TEXT.value:
            parameters["response_format"] = {"type": "text"}

    return parameters


# TODO: handle OTel GenAI semconv drift between producers.
# Our generated models target semconv v1.41.1 (BlobPart has ``content: bytes`` and a
# required ``modality`` field; UriPart/FilePart similarly renamed). Some producers
# emit older drafts — notably opentelemetry-instrumentation-google-genai uses the
# v1.30-era shape: ``data`` instead of ``content``, no ``modality``. Pydantic union
# validation falls through to GenericPart for those parts, and ``_flatten_message``
# below drops them silently (e.g. images vanish from llm.input_messages).
# Three options when we get to this:
#   1. Loosen the generated models (accept ``data``/``content`` aliases, optional
#      ``modality``). Most permissive but modifies generated code.
#   2. Pre-normalize part dicts in ``_validate_root_list`` (rename ``data`` ->
#      ``content``, default ``modality`` from ``mime_type``). Contained.
#   3. Sniff GenericPart for known ``type`` values (``blob``/``uri``/``file``) in
#      ``_flatten_message`` and pull image fields from ``model_extra``. Most
#      defensive — covers future drift too.
def _flatten_message(
    message: ChatMessage | OutputMessage,
    prefix: str,
    index: int,
) -> dict[str, AttributeValue]:
    flat: dict[str, AttributeValue] = {}
    base = f"{prefix}.{index}"

    flat[f"{base}.{MessageAttributes.MESSAGE_ROLE}"] = _enum_value(message.role)

    if message.name:
        flat[f"{base}.{MessageAttributes.MESSAGE_NAME}"] = message.name

    if isinstance(message, OutputMessage):
        # Streaming chunks can carry an empty finish_reason mid-stream; skip rather
        # than render ``llm.{...}.message.finish_reason = ""`` in the OI surface.
        finish_reason = _enum_value(message.finish_reason)
        if finish_reason:
            flat[f"{base}.message.finish_reason"] = finish_reason

    text_parts: list[str] = []
    content_parts: list[TextPart | UriPart | BlobPart] = []
    tool_calls: list[ToolCallRequestPart] = []
    tool_response_part: Optional[ToolCallResponsePart] = None

    for part in message.parts:
        if isinstance(part, TextPart):
            text_parts.append(part.content)
            content_parts.append(part)
        elif isinstance(part, (UriPart, BlobPart)):
            content_parts.append(part)
        elif isinstance(part, ToolCallRequestPart):
            tool_calls.append(part)
        elif isinstance(part, ToolCallResponsePart):
            tool_response_part = part

    if tool_response_part is not None:
        if tool_response_part.id:
            flat[f"{base}.{MessageAttributes.MESSAGE_TOOL_CALL_ID}"] = tool_response_part.id
        if tool_response_part.response is not None:
            flat[f"{base}.{MessageAttributes.MESSAGE_CONTENT}"] = _as_string(
                tool_response_part.response
            )
        return flat

    has_non_text_content = any(not isinstance(part, TextPart) for part in content_parts)

    if content_parts and (has_non_text_content or len(text_parts) > 1):
        for content_index, content_part in enumerate(content_parts):
            content_prefix = f"{base}.{MessageAttributes.MESSAGE_CONTENTS}.{content_index}"
            if isinstance(content_part, TextPart):
                flat[f"{content_prefix}.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] = "text"
                flat[f"{content_prefix}.{MessageContentAttributes.MESSAGE_CONTENT_TEXT}"] = (
                    content_part.content
                )
            else:
                flat[f"{content_prefix}.{MessageContentAttributes.MESSAGE_CONTENT_TYPE}"] = "image"
                if image_url := _image_url_from_part(content_part):
                    flat[
                        f"{content_prefix}.{MessageContentAttributes.MESSAGE_CONTENT_IMAGE}"
                        f".{ImageAttributes.IMAGE_URL}"
                    ] = image_url
    elif text_parts:
        flat[f"{base}.{MessageAttributes.MESSAGE_CONTENT}"] = "".join(text_parts)

    for call_index, tool_call in enumerate(tool_calls):
        call_prefix = f"{base}.{MessageAttributes.MESSAGE_TOOL_CALLS}.{call_index}"
        if tool_call.id:
            flat[f"{call_prefix}.{ToolCallAttributes.TOOL_CALL_ID}"] = tool_call.id
        if tool_call.name:
            flat[f"{call_prefix}.{ToolCallAttributes.TOOL_CALL_FUNCTION_NAME}"] = tool_call.name
        if tool_call.arguments is not None:
            flat[f"{call_prefix}.{ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"] = (
                _as_string(tool_call.arguments)
            )

    return flat


def _image_url_from_part(part: UriPart | BlobPart) -> Optional[str]:
    if isinstance(part, UriPart):
        return part.uri
    # BlobPart: rebuild the data URL. ``content`` is bytes after validation but its
    # value is the original base64 string the wire format used, so decoding to ascii
    # round-trips losslessly without re-encoding.
    mime_type = part.mime_type or "application/octet-stream"
    try:
        encoded = part.content.decode("ascii")
    except UnicodeDecodeError:
        return None
    return f"data:{mime_type};base64,{encoded}"


def _flatten_document(
    document: RetrievalDocument,
    index: int,
) -> dict[str, AttributeValue]:
    flat: dict[str, AttributeValue] = {}
    base = f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.{index}"

    if document.id:
        flat[f"{base}.{DocumentAttributes.DOCUMENT_ID}"] = document.id
    flat[f"{base}.{DocumentAttributes.DOCUMENT_SCORE}"] = float(document.score)

    # ``content`` and ``metadata`` aren't in the OTel RetrievalDocument schema but
    # real producers commonly include them; they land in model_extra because of
    # extra="allow" on the model.
    extra = document.model_extra or {}
    if (content := extra.get("content")) is not None:
        flat[f"{base}.{DocumentAttributes.DOCUMENT_CONTENT}"] = _as_string(content)
    if (metadata := extra.get("metadata")) is not None:
        flat[f"{base}.{DocumentAttributes.DOCUMENT_METADATA}"] = (
            metadata if isinstance(metadata, str) else json.dumps(metadata, ensure_ascii=False)
        )

    return flat


def _definition_to_oi_schema(
    definition: FunctionToolDefinition | GenericToolDefinition,
) -> dict[str, Any]:
    """Rewrap a gen_ai.tool.definitions entry into the OpenAI-style JSON schema OI uses."""
    function: dict[str, Any] = {"name": definition.name}
    if isinstance(definition, FunctionToolDefinition):
        description = definition.description
        parameters = definition.parameters
    else:
        # GenericToolDefinition's schema only declares ``type`` and ``name``, but real
        # producers attach ``description`` / ``parameters`` for non-function tool types
        # too; ``extra="allow"`` puts them in model_extra.
        extra = definition.model_extra or {}
        description = extra.get("description")
        parameters = extra.get("parameters")
    if description:
        function["description"] = description
    if parameters is not None:
        function["parameters"] = parameters
    return {"type": definition.type, "function": function}


_R = TypeVar("_R")


def _validate_root_list(
    value: Any,
    model_cls: type[RootModel[list[_R]]],
) -> list[_R]:
    """Validate a JSON-list attribute end-to-end with pydantic-core's JSON parser.

    A single malformed item drops the whole payload (MVP tradeoff for using the
    fast ``model_validate_json`` path). The OTel-emitted attribute is always a JSON
    string; non-string values yield an empty list."""
    if not isinstance(value, (str, bytes, bytearray)):
        return []
    try:
        return model_cls.model_validate_json(value).root
    except ValidationError:
        return []


def _validate_tool_definitions(
    value: Any,
) -> list[FunctionToolDefinition | GenericToolDefinition]:
    """Tool-definition list with a small forgiveness step before validation.

    Some producers omit the ``type`` field on tool definitions — e.g. Anthropic's
    instrumentor emits ``[{"name": ..., "description": ..., "input_schema": ...}]``
    with no ``type``. The OTel semconv requires it, so without this the whole list
    fails validation and silently drops. We default missing ``type`` to ``"function"``
    (matching how Anthropic models the tools internally) so these definitions still
    surface as ``llm.tools`` instead of vanishing."""
    if not isinstance(value, (str, bytes, bytearray)):
        return []
    try:
        items = json.loads(value)
    except (TypeError, ValueError):
        return []
    if not isinstance(items, list):
        return []
    for item in items:
        if isinstance(item, dict) and "type" not in item:
            item["type"] = "function"
    try:
        return ToolDefinitions.model_validate(items).root
    except ValidationError:
        return []


def _enum_value(value: Enum | str) -> str:
    if isinstance(value, Enum):
        return str(value.value)
    return value


def _coerce_int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return None
    return None


def _coerce_string_sequence(value: Any) -> Optional[tuple[str, ...]]:
    if value is None:
        return None
    if isinstance(value, str):
        return (value,)
    if isinstance(value, Sequence):
        return tuple(str(item) for item in value)
    return None


def _as_optional_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def _as_string(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def _maybe_parse_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _jsonable_attribute_value(value: Any) -> Any:
    if isinstance(value, tuple):
        return list(value)
    return value
