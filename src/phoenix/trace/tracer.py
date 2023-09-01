import logging
import pickle
import weakref
from datetime import datetime
from queue import SimpleQueue
from threading import Thread
from typing import Any, Callable, Iterator, List, Optional, Protocol, TypeVar
from uuid import UUID, uuid4

from requests import Session

from ..config import PORT
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

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

T = TypeVar("T", contravariant=True)


class Exporter(Protocol[T]):
    def export(self, obj: T) -> None:
        ...


class NoOpExporter:
    def export(self, span: Span) -> None:
        ...


class HttpExporter:
    def __init__(self, port: int = PORT) -> None:
        self._url = f"http://localhost:{port}/v1/spans"
        self._session = Session()
        weakref.finalize(self, self._session.close)
        self._session.headers.update({"content-type": "application/octet-stream"})
        self._queue: "SimpleQueue[Optional[Span]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._queue.put, None)
        Thread(target=self._consume_spans, daemon=True).start()

    def export(self, span: Span) -> None:
        self._queue.put(span)

    def _consume_spans(self) -> None:
        while True:
            if not (span := self._queue.get()):
                return
            self._send(span)

    def _send(self, span: Span) -> None:
        try:
            self._session.post(
                self._url,
                data=pickle.dumps(span),
            ).raise_for_status()
        except Exception as e:
            logger.exception(e)


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
        exporter: Optional[Exporter[Span]] = HttpExporter(),
        on_append: Optional[Callable[[List[Span]], None]] = None,
        *args: Any,
        **kwargs: Any,
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
        self._exporter: Exporter[Span] = exporter or NoOpExporter()
        super().__init__(*args, **kwargs)

    def create_span(
        self,
        name: str,
        span_kind: SpanKind,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        status_code: SpanStatusCode = SpanStatusCode.UNSET,
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

        self._exporter.export(span)
        self.span_buffer.append(span)

        if self.on_append is not None:
            self.on_append(self.span_buffer)
        return span

    def get_spans(self) -> Iterator[Span]:
        """
        Returns the spans stored in the tracer. This is useful if you are running
        in a notebook environment and you want to inspect the spans.
        """
        yield from self.span_buffer
