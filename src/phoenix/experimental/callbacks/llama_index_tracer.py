"""
Callback handler for emitting trace data in OpenInference format.
OpenInference is an open standard for capturing and storing AI model inferences.
It enables production LLMapp servers to seamlessly integrate with LLM
observability solutions such as Arize and Phoenix.

For more information on the specification, see
https://github.com/Arize-ai/open-inference-spec
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Generator, List, Optional, Tuple, TypedDict
from uuid import UUID, uuid4

from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import CBEvent, CBEventType

from phoenix.trace.schemas import Span, SpanKind, SpanStatusCode
from phoenix.trace.tracer import Tracer


@dataclass
class TraceData:
    id: UUID = field(default_factory=uuid4)


class CBEventData(TypedDict, total=False):
    name: str
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
        self._event_id_to_event_data: Dict[str, CBEventData] = defaultdict(lambda: CBEventData())

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> str:
        event_id = event_id or str(uuid4())
        self._event_id_to_event_data[event_id]["name"] = event_type.value
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
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        event_id = event_id or str(uuid4())
        self._event_id_to_event_data[event_id].setdefault("name", event_type.value)
        self._event_id_to_event_data[event_id]["end_event"] = CBEvent(
            event_type=event_type,
            payload=payload,
            id_=event_id,
        )

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        ...

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        _add_to_tracer(
            event_id_to_event_data=self._event_id_to_event_data,
            child_to_parent_trace_id=dict(
                _generate_child_to_parent_trace_id_pairs(trace_map or {})
            ),
            tracer=self._tracer,
        )
        self._event_id_to_event_data = defaultdict(lambda: CBEventData())


def _add_to_tracer(
    event_id_to_event_data: Dict[str, CBEventData],
    child_to_parent_trace_id: Dict[str, str],
    tracer: Tracer,
) -> None:
    """Adds event data to the tracer, where it is converted to a span and stored in a buffer.

    Args:
        event_id_to_event_data (Dict[str, CBEventData]): A map of event IDs to event data.

        child_to_parent_trace_id (Dict[str, str]): A map of child trace IDs to parent trace IDs.

        tracer (Tracer): The tracer that stores spans.
    """
    for event_id, event_data in event_id_to_event_data.items():
        parent_event_id = child_to_parent_trace_id.get(event_id)
        start_event = event_data.get("start_event")
        end_event = event_data.get("end_event")
        name = event_data.get("name", "")
        if start_event:
            span_kind = _get_span_kind(start_event.event_type)
        elif end_event:
            span_kind = _get_span_kind(end_event.event_type)
        else:
            span_kind = SpanKind.CHAIN
        tracer.create_span(
            name=name,
            span_kind=span_kind,
            start_time=start_event.time if start_event else None,
            end_time=end_event.time if end_event else None,
            status_code=SpanStatusCode.OK,
            status_message="",
            parent_id=UUID(parent_event_id) if parent_event_id is not None else parent_event_id,
            span_id=UUID(event_id),
            attributes=None,
            events=None,
            conversation=None,
        )


def _generate_child_to_parent_trace_id_pairs(
    trace_map: Dict[str, List[str]]
) -> Generator[Tuple[str, str], None, None]:
    """Yields tuples of child trace IDs and parent trace IDs.

    Args:
        trace_map (Dict[str, List[str]]): A mapping of each parent trace ID to a list of its
        children trace IDs.

    Yields:
        Generator[Tuple[str, str], None, None]: A generator yielding (child trace ID, parent trace
        ID) pairs.
    """
    parent_trace_id: Optional[str]
    for parent_trace_id, children_trace_ids in trace_map.items():
        if parent_trace_id == "root":
            continue
        for child_trace_id in children_trace_ids:
            yield child_trace_id, parent_trace_id


def _get_span_kind(event_type: CBEventType) -> SpanKind:
    """Maps a CBEventType to a SpanKind.

    Args:
        event_type (CBEventType): LlamaIndex callback event type.

    Returns:
        SpanKind: The corresponding span kind.
    """
    if event_type is CBEventType.EMBEDDING:
        return SpanKind.EMBEDDING
    elif event_type is CBEventType.LLM:
        return SpanKind.LLM
    return SpanKind.CHAIN
