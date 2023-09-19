"""
Callback handler for emitting trace data in OpenInference tracing format.
OpenInference tracing is an open standard for capturing and storing
LLM Application execution logs.

It enables production LLMapp servers to seamlessly integrate with LLM
observability solutions such as Arize and Phoenix.

For more information on the specification, see
https://github.com/Arize-ai/open-inference-spec
"""
import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, Iterator, List, Optional, Tuple, TypedDict, cast
from uuid import uuid4

from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import (
    TIMESTAMP_FORMAT,
    CBEvent,
    CBEventType,
    EventPayload,
)
from llama_index.llms.base import ChatMessage, ChatResponse
from llama_index.tools import ToolMetadata

from phoenix.trace.exporter import HttpExporter
from phoenix.trace.schemas import Span, SpanID, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_ID,
    DOCUMENT_METADATA,
    DOCUMENT_SCORE,
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_INVOCATION_PARAMETERS,
    LLM_MESSAGES,
    LLM_MODEL_NAME,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPTS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_NAME,
    MESSAGE_ROLE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
    TOOL_DESCRIPTION,
    TOOL_NAME,
    TOOL_PARAMETERS,
    MimeType,
)
from phoenix.trace.tracer import SpanExporter, Tracer

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

CBEventID = str
_LOCAL_TZINFO = datetime.now().astimezone().tzinfo


class CBEventData(TypedDict, total=False):
    name: str
    event_type: CBEventType
    start_event: CBEvent
    end_event: CBEvent
    attributes: Dict[str, Any]


def payload_to_semantic_attributes(
    event_type: CBEventType,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Converts a LLMapp payload to a dictionary of semantic conventions compliant attributes.
    """
    attributes: Dict[str, Any] = {}
    if event_type in (CBEventType.NODE_PARSING, CBEventType.CHUNKING):
        # TODO(maybe): handle these events
        return attributes
    if event_type == CBEventType.TEMPLATING:
        if template := payload.get(EventPayload.TEMPLATE):
            attributes[LLM_PROMPT_TEMPLATE] = template
        if template_vars := payload.get(EventPayload.TEMPLATE_VARS):
            attributes[LLM_PROMPT_TEMPLATE_VARIABLES] = template_vars
        # TODO(maybe)
        # EventPayload.SYSTEM_PROMPT
        # EventPayload.QUERY_WRAPPER_PROMPT
    if EventPayload.CHUNKS in payload and EventPayload.EMBEDDINGS in payload:
        attributes[EMBEDDING_EMBEDDINGS] = [
            {EMBEDDING_TEXT: text, EMBEDDING_VECTOR: vector}
            for text, vector in zip(payload[EventPayload.CHUNKS], payload[EventPayload.EMBEDDINGS])
        ]
    if EventPayload.QUERY_STR in payload:
        attributes[INPUT_VALUE] = payload[EventPayload.QUERY_STR]
        attributes[INPUT_MIME_TYPE] = MimeType.TEXT
    if EventPayload.NODES in payload:
        attributes[RETRIEVAL_DOCUMENTS] = [
            {
                DOCUMENT_ID: node_with_score.node.node_id,
                DOCUMENT_SCORE: node_with_score.score,
                DOCUMENT_CONTENT: node_with_score.node.text,
                DOCUMENT_METADATA: node_with_score.node.metadata,
            }
            for node_with_score in payload[EventPayload.NODES]
        ]
    if EventPayload.PROMPT in payload:
        attributes[LLM_PROMPTS] = [payload[EventPayload.PROMPT]]
    if EventPayload.MESSAGES in payload:
        messages = payload[EventPayload.MESSAGES]
        # Messages is only relevant to the LLM invocation
        if event_type is CBEventType.LLM:
            attributes[LLM_MESSAGES] = [
                _message_payload_to_attributes(message_data) for message_data in messages
            ]
        elif event_type is CBEventType.AGENT_STEP and len(messages):
            # the agent step contains a message that is actually the input
            # akin to the query_str
            attributes[INPUT_VALUE] = _message_payload_to_str(messages[0])
    if response := (payload.get(EventPayload.RESPONSE) or payload.get(EventPayload.COMPLETION)):
        attributes.update(_get_response_output(response))
        if (raw := getattr(response, "raw", None)) and (usage := getattr(raw, "usage", None)):
            if prompt_tokens := getattr(usage, "prompt_tokens", None):
                attributes[LLM_TOKEN_COUNT_PROMPT] = prompt_tokens
            if completion_tokens := getattr(usage, "completion_tokens", None):
                attributes[LLM_TOKEN_COUNT_COMPLETION] = completion_tokens
            if total_tokens := getattr(usage, "total_tokens", None):
                attributes[LLM_TOKEN_COUNT_TOTAL] = total_tokens
    if EventPayload.TEMPLATE in payload:
        ...
    if event_type is CBEventType.RERANKING:
        ...  # TODO
        # if EventPayload.TOP_K in payload:
        #     attributes[RERANKING_TOP_K] = payload[EventPayload.TOP_K]
        # if EventPayload.MODEL_NAME in payload:
        #     attributes[RERANKING_MODEL_NAME] = payload[EventPayload.MODEL_NAME]
    if EventPayload.TOOL in payload:
        tool_metadata = cast(ToolMetadata, payload.get(EventPayload.TOOL))
        attributes[TOOL_NAME] = tool_metadata.name
        attributes[TOOL_DESCRIPTION] = tool_metadata.description
        attributes[TOOL_PARAMETERS] = tool_metadata.to_openai_function()["parameters"]
    if EventPayload.SERIALIZED in payload:
        serialized = payload[EventPayload.SERIALIZED]
        if event_type is CBEventType.EMBEDDING:
            if model_name := serialized.get("model_name"):
                attributes[EMBEDDING_MODEL_NAME] = model_name
        if event_type is CBEventType.LLM:
            if model_name := serialized.get("model"):
                attributes[LLM_MODEL_NAME] = model_name
                attributes[LLM_INVOCATION_PARAMETERS] = json.dumps(
                    {
                        "model": model_name,
                        "temperature": serialized["temperature"],
                        "max_tokens": serialized["max_tokens"],
                        **serialized["additional_kwargs"],
                    }
                )
    return attributes


class OpenInferenceTraceCallbackHandler(BaseCallbackHandler):
    """Callback handler for storing LLM application trace data in OpenInference format.
    OpenInference is an open standard for capturing and storing AI model
    inferences. It enables production LLMapp servers to seamlessly integrate
    with LLM observability solutions such as Arize and Phoenix.

    For more information on the specification, see
    https://github.com/Arize-ai/open-inference-spec
    """

    def __init__(
        self,
        callback: Optional[Callable[[List[Span]], None]] = None,
        exporter: Optional[SpanExporter] = HttpExporter(),
    ) -> None:
        super().__init__(event_starts_to_ignore=[], event_ends_to_ignore=[])
        self._tracer = Tracer(on_append=callback, exporter=exporter)
        self._event_id_to_event_data: Dict[CBEventID, CBEventData] = defaultdict(
            lambda: CBEventData()
        )

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: CBEventID = "",
        **kwargs: Any,
    ) -> CBEventID:
        event_id = event_id or str(uuid4())
        event_data = self._event_id_to_event_data[event_id]
        event_data["name"] = event_type.value
        event_data["event_type"] = event_type
        event_data["start_event"] = CBEvent(
            event_type=event_type,
            payload=payload,
            id_=event_id,
        )
        event_data["attributes"] = {}
        # Parse the payload to extract the parameters
        if payload is not None:
            event_data["attributes"].update(
                payload_to_semantic_attributes(event_type, payload),
            )

        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: CBEventID = "",
        **kwargs: Any,
    ) -> None:
        event_data = self._event_id_to_event_data[event_id]
        event_data.setdefault("name", event_type.value)
        event_data.setdefault("event_type", event_type)
        event_data["end_event"] = CBEvent(
            event_type=event_type,
            payload=payload,
            id_=event_id,
        )

        # Parse the payload to extract the parameters
        if payload is not None:
            event_data["attributes"].update(
                payload_to_semantic_attributes(event_type, payload),
            )

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        self._event_id_to_event_data = defaultdict(lambda: CBEventData())

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[CBEventID, List[CBEventID]]] = None,
    ) -> None:
        if not trace_map:
            return  # TODO: investigate when empty or None trace_map is passed
        try:
            _add_to_tracer(
                event_id_to_event_data=self._event_id_to_event_data,
                trace_map=trace_map,
                tracer=self._tracer,
            )
        except Exception:
            logger.exception("OpenInferenceCallbackHandler trace processing failed")
        self._event_id_to_event_data = defaultdict(lambda: CBEventData())

    def get_spans(self) -> Iterator[Span]:
        """
        Returns the spans stored in the tracer. This is useful if you are running
        LlamaIndex in a notebook environment and you want to inspect the spans.
        """
        return self._tracer.get_spans()


def _add_to_tracer(
    event_id_to_event_data: Dict[CBEventID, CBEventData],
    trace_map: Dict[CBEventID, List[CBEventID]],
    tracer: Tracer,
) -> None:
    """Adds event data to the tracer, where it is converted to a span and stored in a buffer.

    Args:
        event_id_to_event_data (Dict[CBEventID, CBEventData]): A map of event IDs to event data.

        trace_map (Dict[CBEventID, List[CBEventID]]): A map of parent event IDs to child event IDs.
        The root event IDs are stored under the key "root".

        tracer (Tracer): The tracer that stores spans.
    """

    trace_id = uuid4()
    parent_child_id_stack: List[Tuple[Optional[SpanID], CBEventID]] = [
        (None, root_event_id) for root_event_id in trace_map["root"]
    ]
    while parent_child_id_stack:
        parent_span_id, event_id = parent_child_id_stack.pop()
        event_data = event_id_to_event_data[event_id]
        start_event = event_data["start_event"]
        start_time_tz_naive = datetime.strptime(start_event.time, TIMESTAMP_FORMAT)
        start_time_tz_aware = start_time_tz_naive.replace(tzinfo=_LOCAL_TZINFO)
        end_event = event_data["end_event"]
        end_time_tz_naive = datetime.strptime(end_event.time, TIMESTAMP_FORMAT)
        end_time_tz_aware = end_time_tz_naive.replace(tzinfo=_LOCAL_TZINFO)
        name = event_data["name"]
        event_type = event_data["event_type"]
        span_kind = _get_span_kind(event_type)
        span = tracer.create_span(
            name=name,
            span_kind=span_kind,
            trace_id=trace_id,
            start_time=start_time_tz_aware,
            end_time=end_time_tz_aware,
            status_code=SpanStatusCode.OK,
            status_message="",
            parent_id=parent_span_id,
            attributes=event_data["attributes"],
            events=None,
            conversation=None,
        )
        new_parent_span_id = span.context.span_id
        for new_child_event_id in trace_map.get(event_id, []):
            parent_child_id_stack.append((new_parent_span_id, new_child_event_id))


def _get_span_kind(event_type: CBEventType) -> SpanKind:
    """Maps a CBEventType to a SpanKind.

    Args:
        event_type (CBEventType): LlamaIndex callback event type.

    Returns:
        SpanKind: The corresponding span kind.
    """
    return {
        CBEventType.EMBEDDING: SpanKind.EMBEDDING,
        CBEventType.LLM: SpanKind.LLM,
        CBEventType.RETRIEVE: SpanKind.RETRIEVER,
        CBEventType.FUNCTION_CALL: SpanKind.TOOL,
        CBEventType.AGENT_STEP: SpanKind.AGENT,
    }.get(event_type, SpanKind.CHAIN)


def _message_payload_to_attributes(message: Any) -> Dict[str, Optional[str]]:
    if isinstance(message, ChatMessage):
        message_attributes = {
            MESSAGE_ROLE: message.role.value,
            MESSAGE_CONTENT: message.content,
        }
        # Parse the kwargs to extract the function name and parameters for function calling
        # NB: these additional kwargs exist both for 'agent' and 'function' roles
        if "name" in message.additional_kwargs:
            message_attributes[MESSAGE_NAME] = message.additional_kwargs["name"]
        if "function_call" in message.additional_kwargs:
            function_call = message.additional_kwargs["function_call"]
            message_attributes[MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON] = function_call.arguments
            message_attributes[MESSAGE_FUNCTION_CALL_NAME] = function_call.name
        return message_attributes

    return {
        MESSAGE_ROLE: "user",  # assume user if not ChatMessage
        MESSAGE_CONTENT: str(message),
    }


def _message_payload_to_str(message: Any) -> Optional[str]:
    """Converts a message payload to a string, if possible"""
    if isinstance(message, ChatMessage):
        return message.content

    return str(message)


def _get_response_output(response: Any) -> Iterator[Tuple[str, Any]]:
    """
    Gets output from response objects. This is needed since the string representation of some
    response objects includes extra information in addition to the content itself. In the
    case of an agent's ChatResponse the output may be a `function_call` object specifying
    the name of the function to call and the arguments to call it with.
    """
    if isinstance(response, ChatResponse):
        message = response.message
        if content := message.content:
            yield OUTPUT_VALUE, content
            yield OUTPUT_MIME_TYPE, MimeType.TEXT
        else:
            yield OUTPUT_VALUE, json.dumps(message.additional_kwargs)
            yield OUTPUT_MIME_TYPE, MimeType.JSON
    else:
        yield OUTPUT_VALUE, str(response)
        yield OUTPUT_MIME_TYPE, MimeType.TEXT
