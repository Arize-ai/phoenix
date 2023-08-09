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
from typing import Any, Callable, Dict, List, Optional, Tuple, TypedDict
from uuid import uuid4

from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import CBEvent, CBEventType

from phoenix.trace.schemas import Span, SpanID, SpanKind, SpanStatusCode
from phoenix.trace.tracer import Tracer

logger = logging.getLogger(__name__)


CBEventID = str


class CBEventData(TypedDict, total=False):
    name: str
    event_type: CBEventType
    start_event: CBEvent
    end_event: CBEvent


class OpenInferenceCallbackHandler(BaseCallbackHandler):
    """Callback handler for storing generation data in OpenInference format.
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
        self._event_id_to_event_data[event_id]["name"] = event_type.value
        self._event_id_to_event_data[event_id]["event_type"] = event_type
        self._event_id_to_event_data[event_id]["start_event"] = CBEvent(
            event_type=event_type,
            payload=payload,
            id_=event_id,
        )
        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: CBEventID = "",
        **kwargs: Any,
    ) -> None:
        self._event_id_to_event_data[event_id].setdefault("name", event_type.value)
        self._event_id_to_event_data[event_id].setdefault("event_type", event_type)
        self._event_id_to_event_data[event_id]["end_event"] = CBEvent(
            event_type=event_type,
            payload=payload,
            id_=event_id,
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
            logger.exception("Trace processing failed")
        self._event_id_to_event_data = defaultdict(lambda: CBEventData())


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
            start_time=start_event.time,
            end_time=end_event.time,
            status_code=SpanStatusCode.OK,
            status_message="",
            parent_id=parent_span_id,
            attributes=None,
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
