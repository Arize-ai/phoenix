from itertools import chain
from random import Random
from typing import (
    Any,
    Container,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    cast,
)

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from opentelemetry.util.types import Attributes
from typing_extensions import assert_never

from phoenix.trace.otel.utils import encode_attributes
from phoenix.trace.schemas import (
    Span,
    SpanEvent,
    SpanID,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_METADATA,
    EMBEDDING_EMBEDDINGS,
    LLM_INPUT_MESSAGES,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    PHOENIX_EMBEDDING_OBJECT,
    PHOENIX_LLM_INPUT_MESSAGE,
    PHOENIX_LLM_OUTPUT_MESSAGE,
    PHOENIX_RETRIEVED_DOCUMENT,
    PHOENIX_SPAN_KIND,
    RETRIEVAL_DOCUMENTS,
)

NANO = 1_000_000_000  # for converting seconds to nanoseconds


def encode(span: Span) -> otlp.Span:
    trace_id: bytes = span.context.trace_id.bytes
    span_id: bytes = _span_id_to_bytes(span.context.span_id)
    parent_span_id: bytes = _span_id_to_bytes(span.parent_id) if span.parent_id else bytes()

    # floating point rounding error can cause the timestamp to be slightly different from expected
    start_time_unix_nano: int = int(span.start_time.timestamp() * NANO)
    end_time_unix_nano: int = int(span.end_time.timestamp() * NANO) if span.end_time else 0

    attributes: Dict[str, Any] = dict(span.attributes)

    documents, attributes = _excise_attribute(
        attributes, RETRIEVAL_DOCUMENTS, PHOENIX_RETRIEVED_DOCUMENT, (DOCUMENT_METADATA,)
    )
    embeddings, attributes = _excise_attribute(
        attributes, EMBEDDING_EMBEDDINGS, PHOENIX_EMBEDDING_OBJECT
    )
    input_messages, attributes = _excise_attribute(
        attributes, LLM_INPUT_MESSAGES, PHOENIX_LLM_INPUT_MESSAGE
    )
    output_messages, attributes = _excise_attribute(
        attributes, LLM_OUTPUT_MESSAGES, PHOENIX_LLM_OUTPUT_MESSAGE
    )
    prompt_template_variables, attributes = _excise_attribute(
        attributes, LLM_PROMPT_TEMPLATE_VARIABLES
    )

    events = chain(
        _encode_events(span.events),
        documents,
        embeddings,
        input_messages,
        output_messages,
        prompt_template_variables,
    )

    attributes[PHOENIX_SPAN_KIND] = span.span_kind.value

    status = _encode_status(span.status_code, span.status_message)

    return otlp.Span(
        name=span.name,
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        start_time_unix_nano=start_time_unix_nano,
        end_time_unix_nano=end_time_unix_nano,
        attributes=encode_attributes(cast(Attributes, attributes)),
        events=events,
        status=status,
    )


def _encode_status(span_status_code: SpanStatusCode, status_message: str) -> otlp.Status:
    if span_status_code is SpanStatusCode.OK:
        code = otlp.Status.StatusCode.STATUS_CODE_OK
    elif span_status_code is SpanStatusCode.ERROR:
        code = otlp.Status.StatusCode.STATUS_CODE_ERROR
    elif span_status_code is SpanStatusCode.UNSET:
        code = otlp.Status.StatusCode.STATUS_CODE_UNSET
    else:
        assert_never(span_status_code)
    return otlp.Status(code=code, message=status_message)


def _span_id_to_bytes(span_id: SpanID) -> bytes:
    return Random(span_id.bytes).getrandbits(64).to_bytes(8, byteorder="big")


def _excise_attribute(
    attributes: Mapping[str, Any],
    attribute_key: str,
    event_name: Optional[str] = None,
    json_dump_keys: Container[str] = (),
) -> Tuple[List[otlp.Span.Event], Dict[str, Any]]:
    event_name = event_name or attribute_key
    events, _attributes = [], dict(attributes)
    attribute_value = _attributes.pop(attribute_key, None)
    if isinstance(attribute_value, Mapping):
        event = otlp.Span.Event(
            name=event_name,
            attributes=encode_attributes(attribute_value, json_dump_keys),
        )
        events.append(event)
    elif isinstance(attribute_value, Iterable):
        for value in attribute_value:
            event = otlp.Span.Event(
                name=event_name,
                attributes=encode_attributes(value, json_dump_keys),
            )
            events.append(event)
    return events, _attributes


def _encode_event(event: SpanEvent) -> otlp.Span.Event:
    return otlp.Span.Event(
        name=event.name,
        time_unix_nano=int(event.timestamp.timestamp() * NANO),
        attributes=encode_attributes(cast(Attributes, event.attributes)),
    )


def _encode_events(events: Iterable[SpanEvent]) -> Iterator[otlp.Span.Event]:
    return (_encode_event(event) for event in events)
