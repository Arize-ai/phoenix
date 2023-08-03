from datetime import datetime
from typing import Callable, List, Optional
from uuid import UUID, uuid4

from .schemas import (
    Span,
    SpanAttributes,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanID,
    SpanKind,
    SpanStatusCode,
)


class Tracer:
    """
    Tracer creates spans containing more information about what is happening for
    a given operation, such as a request in a service.

    OpenTelemetry Inspiration:
    https://opentelemetry.io/docs/concepts/signals/traces/#tracer
    """

    span_buffer: List[Span]
    on_append: Optional[Callable[[List[Span]], None]]

    def __init__(
        self,
        on_append: Optional[Callable[[List[Span]], None]] = None,
    ):
        """
        Create a new Tracer. A Tracer's main purpose is to create spans.
        Serialization should be handled by a separate component.

        Args:
            on_append:
                A callback function that will be called when a span is
                created and appended to the buffer. This is useful for
                serializing data to a file or sending it to a remote server.
        """
        self.span_buffer = []
        self.on_append = on_append

    def create_span(
        self,
        name: str,
        span_kind: SpanKind,
        start_time: datetime,
        end_time: datetime,
        status_code: SpanStatusCode,
        status_message: Optional[str] = "",
        parent_id: Optional[SpanID] = None,
        trace_id: Optional[UUID] = None,
        attributes: Optional[SpanAttributes] = None,
        events: Optional[List[SpanEvent]] = None,
        conversation: Optional[SpanConversationAttributes] = None,
    ) -> Span:
        """
        create_span creates a new span with the given name and options.
        """
        # If no trace_id is provided, generate a new one
        if trace_id is None:
            trace_id = uuid4()

        # If no attributes are provided, create an empty dict
        if attributes is None:
            attributes = {}

        # If no events are provided, create an empty list
        if events is None:
            events = []

        span = Span(
            name=name,
            context=SpanContext(trace_id=trace_id, span_id=uuid4()),
            span_kind=span_kind,
            parent_id=parent_id,
            start_time=start_time,
            end_time=end_time,
            status_code=status_code,
            status_message=status_message if status_message is not None else "",
            attributes=attributes,
            events=events,
            conversation=conversation,
        )

        self.span_buffer.append(span)

        if self.on_append is not None:
            self.on_append(self.span_buffer)
        return span
