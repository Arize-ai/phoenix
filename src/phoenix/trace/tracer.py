import logging
from datetime import datetime
from threading import RLock
from typing import Any, Callable, Iterator, List, Optional, Protocol, Sequence, Union
from uuid import uuid4

from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.trace.exporter import (
    HttpExporter,
    NoOpExporter,
    OpenInferenceExporter,
    _convert_legacy_exporters,
)

from .schemas import (
    Span,
    SpanAttributes,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanID,
    SpanKind,
    SpanStatusCode,
    TraceID,
)

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


class SpanExporter(Protocol):
    def export(self, span: Span) -> None:
        ...


class OpenInferenceTracer:
    """
    A wrapper for OpenTelemetry TracerProvider that provides a simplified interface for configuring
    a TracerProvider and exporting spans to Phoenix.

    Args:
        exporter (Union[OpenInferenceExporter, SpanExporter]): A span exporter used to send spans to
            an OpenTelemetry collector. If not provided, the default OpenInferenceExporter will be
            used. Legacy SpanConverter objects are deprecated, but will be converted to
            OpenInferenceExporter objects.
        resource (Resource): An OpenTelemetry Resource object that contains attributes describing
            the entity that produced the spans. If not provided, an empty Resource will be used.
        span_processors (Sequence[SpanProcessor]): A list of OpenTelemetry SpanProcessor objects
            that will be used to process spans.
    """

    def __init__(
        self,
        exporter: Optional[Union[OpenInferenceExporter, HttpExporter, NoOpExporter]] = None,
        resource: Optional[Resource] = None,
        span_processors: Optional[Sequence[SpanProcessor]] = None,
        _on_append: Optional[Callable[[List[Span]], None]] = None,
    ):
        if resource is None:
            resource = Resource(attributes={})
        self.resource = resource

        if exporter is None:
            exporter = OpenInferenceExporter()
        self.exporter = _convert_legacy_exporters(exporter)

        if on_append is not None:
            self._on_append_deprecation_warning()

        self.span_processors = span_processors or []
        self.tracer_provider = trace_sdk.TracerProvider(resource=self.resource)

    def _configure_otel_tracer(self) -> None:
        span_processor = SimpleSpanProcessor(span_exporter=self.exporter.otel_exporter)
        self.tracer_provider.add_span_processor(span_processor)
        for processor in self.span_processors:
            self.tracer_provider.add_span_processor(processor)
        trace_api.set_tracer_provider(tracer_provider=self.tracer_provider)

    def get_spans(self) -> None:
        logger.warning(
            "OpenInference has been updated for full OpenTelemetry compliance. The legacy"
            "`get_spans` method has been removed. If you need access to spans for processing, "
            "some options include exporting spans from an OpenTelemetry collector or adding a "
            "SpanProcessor to the OpenTelemetry TracerProvider. More examples can be found in the "
            "Phoenix docs: https://docs.arize.com/phoenix/deployment/instrumentation"
        )

    def _on_append_deprecation_warning(self) -> None:
        logger.warning(
            "OpenInference has been updated for full OpenTelemetry compliance. The legacy"
            "`on_append` callbacks are removed. If you need access to spans for processing, "
            "some options include exporting spans from an OpenTelemetry collector or adding a "
            "SpanProcessor to the OpenTelemetry TracerProvider. More examples can be found in the "
            "Phoenix docs: https://docs.arize.com/phoenix/deployment/instrumentation"
        )

    @classmethod
    def _from_legacy_tracer(cls, tracer: "Tracer") -> "OpenInferenceTracer":
        logger.warning(
            "OpenInference has been updated for full OpenTelemetry compliance. The legacy"
            "Tracer objects are deprecated. Please migrate to OpenInferenceTracer or configure "
            "OpenTelemetry TracerProvider directly. More examples can be found in the Phoenix "
            "docs: https://docs.arize.com/phoenix/deployment/instrumentation"
        )
        exporter = tracer._exporter
        if (
            isinstance(exporter, (NoOpExporter, HttpExporter, OpenInferenceExporter))
            or exporter is None
        ):
            return cls(exporter=exporter, _on_append=tracer.on_append)
        else:
            raise TypeError(
                "OpenInference has been updated for full OpenTelemetry compliance. Generic "
                "TraceExporter objects are no longer supported. Legacy Phoenix HttpExporter and "
                "NoOpExporter objects are deprecated, but will continue to be supported. For "
                "custom exporters, consider adding an OpenTelemetry SpanProcessor to the "
                "OpenTelemetry TracerProvider. More examples can be found in the Phoenix docs: "
                "https://docs.arize.com/phoenix/deployment/instrumentation"
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
        exporter: Optional[SpanExporter] = None,
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
        self._exporter: Optional[SpanExporter] = exporter
        self._lock = RLock()
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
        trace_id: Optional[TraceID] = None,
        attributes: Optional[SpanAttributes] = None,
        events: Optional[List[SpanEvent]] = None,
        conversation: Optional[SpanConversationAttributes] = None,
        span_id: Optional[SpanID] = None,
    ) -> Span:
        """
        create_span creates a new span with the given name and options.
        """
        # If no trace_id is provided, generate a new one
        if trace_id is None:
            trace_id = TraceID(uuid4())

        # If no attributes are provided, create an empty dict
        if attributes is None:
            attributes = {}

        # If no events are provided, create an empty list
        if events is None:
            events = []

        span = Span(
            name=name,
            context=SpanContext(trace_id=trace_id, span_id=span_id or SpanID(uuid4())),
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

        if self._exporter:
            self._exporter.export(span)

        with self._lock:
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


def _convert_legacy_tracer(tracer: Union[OpenInferenceTracer, Tracer]) -> OpenInferenceTracer:
    if isinstance(tracer, Tracer):
        return OpenInferenceTracer._from_legacy_tracer(tracer)
    return tracer
