import inspect
from typing import Any, Optional
from urllib.parse import ParseResult, urlparse

from openinference.semconv.resource import ResourceAttributes as _ResourceAttributes
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as _GRPCSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as _HTTPSpanExporter,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider as _TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor as _BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SimpleSpanProcessor
from opentelemetry.sdk.trace.export import SpanExporter

from .settings import get_env_collector_endpoint, get_env_project_name

PROJECT_NAME = _ResourceAttributes.PROJECT_NAME


def register(
        endpoint: Optional[str] = None, project_name: Optional[str] = None, batch: bool = False
    ) -> _TracerProvider:
    project_name = project_name or get_env_project_name()
    resource = Resource.create({PROJECT_NAME: project_name})
    tracer_provider = _TracerProvider(resource=resource)
    if batch:
        span_processor = BatchSpanProcessor(endpoint=endpoint)
    else:
        span_processor = SimpleSpanProcessor(endpoint=endpoint)
    tracer_provider.add_span_processor(span_processor)
    trace_api.set_tracer_provider(tracer_provider)
    return tracer_provider


class TracerProvider(_TracerProvider):
    def __init__(self, *args, endpoint: Optional[str] = None, **kwargs):
        sig = inspect.signature(_TracerProvider)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("resource") is None:
            bound_args.arguments["resource"] = Resource.create(
                {PROJECT_NAME: get_env_project_name()}
            )
        super().__init__(**bound_args.arguments)

        endpoint = endpoint or get_env_collector_endpoint()
        parsed_url = urlparse(endpoint)
        self._default_processor = False

        if _maybe_http_endpoint(parsed_url):
            print("Exporting spans via HTTP.")
            self.add_span_processor(SimpleSpanProcessor(HTTPSpanExporter(endpoint=endpoint)))
            self._default_processor = True
        elif _maybe_grpc_endpoint(parsed_url):
            print("Exporting spans via GRPC.")
            self.add_span_processor(SimpleSpanProcessor(GRPCSpanExporter(endpoint=endpoint)))
            self._default_processor = True
        else:
            print("Could not infer exporter to use.")

    def add_span_processor(self, *args: Any, **kwargs: Any):
        if self._default_processor:
            print("Overriding default span processor.")
            self._active_span_processor.shutdown()
            self._active_span_processor._span_processors = tuple()  # remove default processors
            self._default_processor = False
        return super().add_span_processor(*args, **kwargs)


class SimpleSpanProcessor(_SimpleSpanProcessor):
    def __init__(self, endpoint: Optional[str] = None, exporter: Optional[SpanExporter] = None):
        if exporter is None:
            endpoint = endpoint or get_env_collector_endpoint()
            parsed_url = urlparse(endpoint)
            if _maybe_http_endpoint(parsed_url):
                print("Exporting spans via HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint)
            elif _maybe_grpc_endpoint(parsed_url):
                print("Exporting spans via GRPC.")
                exporter = GRPCSpanExporter(endpoint=endpoint)
            else:
                raise ValueError("Could not infer exporter to use.")
        super().__init__(exporter)


class BatchSpanProcessor(_BatchSpanProcessor):
    def __init__(self, endpoint: Optional[str] = None, exporter: Optional[SpanExporter] = None):
        if exporter is None:
            endpoint = endpoint or get_env_collector_endpoint()
            parsed_url = urlparse(endpoint)
            if _maybe_http_endpoint(parsed_url):
                print("Exporting spans via HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint)
            elif _maybe_grpc_endpoint(parsed_url):
                print("Exporting spans via GRPC.")
                exporter = GRPCSpanExporter(endpoint=endpoint)
            else:
                raise ValueError("Could not infer exporter to use.")
        super().__init__(exporter)


class HTTPSpanExporter(_HTTPSpanExporter):
    def __init__(self, *args, **kwargs):
        sig = inspect.signature(_HTTPSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("endpoint") is None:
            bound_args.arguments["endpoint"] = get_env_collector_endpoint()
        super().__init__(**bound_args.arguments)


class GRPCSpanExporter(_GRPCSpanExporter):
    def __init__(self, *args, **kwargs):
        sig = inspect.signature(_GRPCSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("endpoint") is None:
            bound_args.arguments["endpoint"] = get_env_collector_endpoint()
        super().__init__(*args, **kwargs)


def _maybe_http_endpoint(parsed_endpoint: ParseResult) -> bool:
    if parsed_endpoint.path == "/v1/traces":
        return True
    return False


def _maybe_grpc_endpoint(parsed_endpoint: ParseResult) -> bool:
    if not parsed_endpoint.path and parsed_endpoint.port:
        return True
    return False
