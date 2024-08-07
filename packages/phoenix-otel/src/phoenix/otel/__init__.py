import inspect
from urllib.parse import urlparse

from openinference.semconv.resource import ResourceAttributes as _ResourceAttributes
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as _GRPCSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as _HTTPSpanExporter,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor as _BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SimpleSpanProcessor

from .settings import get_env_collector_endpoint, get_env_project_name

PROJECT_NAME = _ResourceAttributes.PROJECT_NAME


class CustomTracerProvider(TracerProvider):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        sig = inspect.signature(TracerProvider)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("resource") is None:
            bound_args.arguments["resource"] = Resource.create(
                {PROJECT_NAME: get_env_project_name()}
            )
        self._default_processors = True
        self._endpoint = get_env_collector_endpoint()
        parsed_url = urlparse(self._endpoint)
        if parsed_url.port == 6006:
            print("Exporting spans via HTTP.")
            self.add_span_processor(SimpleSpanProcessor(HTTPSpanExporter(endpoint=self._endpoint)))
        elif parsed_url.port == 4317:
            print("Exporting spans via GRPC.")
            self.add_span_processor(SimpleSpanProcessor(GRPCSpanExporter(endpoint=self._endpoint)))
        else:
            # cannot infer exporter to use
            print("Could not infer exporter to use")
            self._default_processors = False

    def add_span_processor(self, *args, **kwargs):
        if self._default_processors:
            print("Removing default span processors.")
            self._active_span_processor.shutdown()
            self._active_span_processor._span_processors = tuple()  # remove default processors
            self._default_processors = False
        return super().add_span_processor(*args, **kwargs)


class SimpleSpanProcessor(_SimpleSpanProcessor):
    def __init__(self, exporter=None):
        if exporter is None:
            endpoint = get_env_collector_endpoint()
            parsed_url = urlparse(endpoint)
            if parsed_url.port == 6006:
                print("Exporting spans via HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint)
            elif parsed_url.port == 4317:
                print("Exporting spans via GRPC.")
                exporter = GRPCSpanExporter(endpoint=endpoint)
            else:
                raise ValueError("Could not infer exporter to use")
        super().__init__(exporter)


class BatchSpanProcessor(_BatchSpanProcessor):
    def __init__(self, exporter=None):
        if exporter is None:
            endpoint = get_env_collector_endpoint()
            parsed_url = urlparse(endpoint)
            if parsed_url.port == 6006:
                print("Exporting spans via HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint)
            elif parsed_url.port == 4317:
                print("Exporting spans via GRPC.")
                exporter = GRPCSpanExporter(endpoint=endpoint)
            else:
                raise ValueError("Could not infer exporter to use")
        super().__init__(exporter)


class HTTPSpanExporter(_HTTPSpanExporter):
    def __init__(self, *args, **kwargs):
        sig = inspect.signature(_HTTPSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("endpoint") is None:
            bound_args.arguments["endpoint"] = get_env_collector_endpoint()
        super().__init__(*args, **kwargs)


class GRPCSpanExporter(_GRPCSpanExporter):
    def __init__(self, *args, **kwargs):
        sig = inspect.signature(_GRPCSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("endpoint") is None:
            bound_args.arguments["endpoint"] = get_env_collector_endpoint()
        super().__init__(*args, **kwargs)
