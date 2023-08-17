"""
Callback handler for emitting trace data in OpenInference format.
OpenInference is an open standard for capturing and storing AI model inferences.
It enables production LLMapp servers to seamlessly integrate with LLM
observability solutions such as Arize and Phoenix.

For more information on the specification, see
https://github.com/Arize-ai/open-inference-spec
"""

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, Iterator, List, Optional, Tuple, TypedDict
from uuid import uuid4

from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import (
    TIMESTAMP_FORMAT,
    CBEvent,
    CBEventType,
    EventPayload,
)

from phoenix.trace.schemas import Span, SpanID, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.tracer import Tracer

logger = logging.getLogger(__name__)


CBEventID = str


class CBEventData(TypedDict, total=False):
    name: str
    event_type: CBEventType
    start_event: CBEvent
    end_event: CBEvent
    attributes: Dict[str, Any]


def payload_to_semantic_attributes(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts a LLMapp payload to a dictionary of semantic conventions compliant attributes.
    """
    attributes = {}

    if EventPayload.QUERY_STR in payload:
        attributes[INPUT_VALUE] = payload[EventPayload.QUERY_STR]
        attributes[INPUT_MIME_TYPE] = MimeType.TEXT
    if EventPayload.CHUNKS in payload:
        ...
    if EventPayload.NODES in payload:
        ...
    if EventPayload.PROMPT in payload:
        ...
    if EventPayload.MESSAGES in payload:
        ...
    if EventPayload.COMPLETION in payload:
        ...
    if EventPayload.RESPONSE in payload:
        response = payload[EventPayload.RESPONSE]
        attributes[OUTPUT_VALUE] = str(response)
        attributes[OUTPUT_MIME_TYPE] = MimeType.TEXT
    if EventPayload.TEMPLATE in payload:
        ...
    return attributes


class OpenInferenceTraceCallbackHandler(BaseCallbackHandler):
    """Callback handler for storing LLM application trace data in OpenInference format.
    OpenInference is an open standard for capturing and storing AI model
    inferences. It enables production LLMapp servers to seamlessly integrate
    with LLM observability solutions such as Arize and Phoenix.

    For more information on the specification, see
    https://github.com/Arize-ai/open-inference-spec
    """

    def __init__(self, callback: Optional[Callable[[List[Span]], None]] = None) -> None:
        super().__init__(event_starts_to_ignore=[], event_ends_to_ignore=[])
        self._tracer = Tracer(on_append=callback)
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
            event_data["attributes"].update(payload_to_semantic_attributes(payload))

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
            event_data["attributes"].update(payload_to_semantic_attributes(payload))

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
        end_event = event_data["end_event"]
        name = event_data["name"]
        event_type = event_data["event_type"]
        span_kind = _get_span_kind(event_type)
        span = tracer.create_span(
            name=name,
            span_kind=span_kind,
            trace_id=trace_id,
            start_time=datetime.strptime(start_event.time, TIMESTAMP_FORMAT),
            end_time=datetime.strptime(end_event.time, TIMESTAMP_FORMAT),
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
    }.get(event_type, SpanKind.CHAIN)
