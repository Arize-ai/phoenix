from dataclasses import dataclass, field
from typing import Any, Container, Dict, Iterable, List, NamedTuple, Optional, Tuple, cast
from uuid import UUID

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from typing_extensions import TypeAlias

from phoenix.trace.otel.utils import (
    decode_key_values,
    decode_unix_nano,
)
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanEvent,
    SpanException,
    SpanID,
    SpanKind,
    SpanStatusCode,
    TraceID,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_METADATA,
    EMBEDDING_EMBEDDINGS,
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    LLM_INPUT_MESSAGES,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    PHOENIX_EMBEDDING_OBJECT,
    PHOENIX_RETRIEVED_DOCUMENT,
    PHOENIX_SPAN_KIND,
    RETRIEVAL_DOCUMENTS,
)


def decode(otlp_span: otlp.Span) -> Span:
    trace_id = cast(TraceID, _decode_identifier(otlp_span.trace_id))
    span_id = cast(SpanID, _decode_identifier(otlp_span.span_id))
    parent_id = _decode_identifier(otlp_span.parent_span_id)

    start_time = decode_unix_nano(otlp_span.start_time_unix_nano)
    end_time = (
        decode_unix_nano(otlp_span.end_time_unix_nano) if otlp_span.end_time_unix_nano else None
    )

    attributes = dict(decode_key_values(otlp_span.attributes))
    span_kind = SpanKind(attributes.pop(PHOENIX_SPAN_KIND, None))

    (
        events,
        documents,
        embeddings,
        input_messages,
        output_messages,
        prompt_template_variables,
    ) = _decode_events(otlp_span.events)
    if documents:
        attributes[RETRIEVAL_DOCUMENTS] = documents
    if embeddings:
        attributes[EMBEDDING_EMBEDDINGS] = embeddings
    if input_messages:
        attributes[LLM_INPUT_MESSAGES] = input_messages
    if output_messages:
        attributes[LLM_OUTPUT_MESSAGES] = output_messages
    if prompt_template_variables:
        attributes[LLM_PROMPT_TEMPLATE_VARIABLES] = prompt_template_variables

    status_code, status_message = _decode_status(otlp_span.status)

    return Span(
        name=otlp_span.name,
        context=SpanContext(
            trace_id=trace_id,
            span_id=span_id,
        ),
        parent_id=parent_id,
        start_time=start_time,
        end_time=end_time,
        attributes=attributes,
        span_kind=span_kind,
        status_code=status_code,
        status_message=status_message,
        events=events,
        conversation=None,
    )


def _decode_identifier(identifier: bytes) -> Optional[UUID]:
    if not identifier:
        return None
    try:
        return UUID(bytes=identifier)
    except ValueError:
        pass
    # Based on the int-to-bytes implementation in OpenTelemetry Python SDK. See:
    # https://github.com/open-telemetry/opentelemetry-python/blob/3dfe2249cc4a203bf24578483b192fec7266596b/exporter/opentelemetry-exporter-otlp-proto-common/src/opentelemetry/exporter/otlp/proto/common/_internal/__init__.py#L88-L93  # noqa: E501
    # Ultimately, we should probably stop using UUID altogether, and just use bytes everywhere.
    return UUID(int=int.from_bytes(identifier, byteorder="big"))


Document: TypeAlias = Dict[str, Any]
Embedding: TypeAlias = Dict[str, Any]
PromptTemplateVariables: TypeAlias = Dict[str, Any]
OutputMessage: TypeAlias = Dict[str, Any]
InputMessage: TypeAlias = Dict[str, Any]


class SortableObject(NamedTuple):
    time_unix_nano: int
    tie_breaker: int
    key_values: Iterable[Tuple[str, Any]]


@dataclass
class SortableObjects:
    json_load_keys: Container[str] = field(default=())
    objects: List[SortableObject] = field(init=False, default_factory=list)

    def append(self, pb_event: otlp.Span.Event) -> None:
        self.objects.append(
            SortableObject(
                time_unix_nano=pb_event.time_unix_nano,
                tie_breaker=len(self.objects),
                key_values=decode_key_values(pb_event.attributes, self.json_load_keys),
            )
        )


def _decode_events(
    pb_events: Iterable[otlp.Span.Event],
) -> Tuple[
    List[SpanEvent],
    List[Document],
    List[Embedding],
    List[InputMessage],
    List[OutputMessage],
    PromptTemplateVariables,
]:
    events: List[SpanEvent] = []
    documents = SortableObjects(json_load_keys=(DOCUMENT_METADATA,))
    embeddings = SortableObjects()
    input_messages = SortableObjects()
    output_messages = SortableObjects()
    prompt_template_variables: Dict[str, Any] = {}
    for pb_event in pb_events:
        if pb_event.name == PHOENIX_RETRIEVED_DOCUMENT:
            documents.append(pb_event)
        elif pb_event.name == PHOENIX_EMBEDDING_OBJECT:
            embeddings.append(pb_event)
        elif pb_event.name == LLM_INPUT_MESSAGES:
            input_messages.append(pb_event)
        elif pb_event.name == LLM_OUTPUT_MESSAGES:
            output_messages.append(pb_event)
        elif pb_event.name == LLM_PROMPT_TEMPLATE_VARIABLES:
            prompt_template_variables.update(decode_key_values(pb_event.attributes))
        else:
            events.append(_decode_event(pb_event))
    return (
        events,
        [dict(obj.key_values) for obj in sorted(documents.objects)],
        [dict(obj.key_values) for obj in sorted(embeddings.objects)],
        [dict(obj.key_values) for obj in sorted(input_messages.objects)],
        [dict(obj.key_values) for obj in sorted(output_messages.objects)],
        prompt_template_variables,
    )


def _decode_event(pb_event: otlp.Span.Event) -> SpanEvent:
    name = pb_event.name
    timestamp = decode_unix_nano(pb_event.time_unix_nano)
    attributes = dict(decode_key_values(pb_event.attributes))
    if name == "exception":
        return SpanException(
            timestamp=timestamp,
            message=attributes.get(EXCEPTION_MESSAGE) or "",
            exception_type=attributes.get(EXCEPTION_TYPE),
            exception_escaped=attributes.get(EXCEPTION_ESCAPED),
            exception_stacktrace=attributes.get(EXCEPTION_STACKTRACE),
        )
    return SpanEvent(
        name=name,
        timestamp=timestamp,
        attributes=attributes,
    )


StatusMessage: TypeAlias = str


def _decode_status(pb_status: otlp.Status) -> Tuple[SpanStatusCode, StatusMessage]:
    pb_status_code = pb_status.code
    if pb_status_code is otlp.Status.StatusCode.STATUS_CODE_OK:
        status_code = SpanStatusCode.OK
    elif pb_status_code is otlp.Status.StatusCode.STATUS_CODE_ERROR:
        status_code = SpanStatusCode.ERROR
    elif pb_status_code is otlp.Status.StatusCode.STATUS_CODE_UNSET:
        status_code = SpanStatusCode.UNSET
    else:
        raise ValueError(f"Unknown status code: {pb_status_code}")
    return status_code, pb_status.message
