import inspect
import warnings
from typing import Any, Dict, Optional
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
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.sdk.trace import TracerProvider as _TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor as _BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SimpleSpanProcessor
from opentelemetry.sdk.trace.export import SpanExporter

from .settings import get_env_client_headers, get_env_collector_endpoint, get_env_project_name

PROJECT_NAME = _ResourceAttributes.PROJECT_NAME


def register(
    *,
    endpoint: Optional[str] = None,
    project_name: Optional[str] = None,
    batch: bool = False,
    set_global=True,
    headers=None,
) -> _TracerProvider:
    """
    Globally sets an OpenTelemetry TracerProvider for enabling OpenInference tracing.

    For futher configuration, the `phoenix.otel` module provides drop-in replacements for
    OpenTelemetry TracerProvider, SimpleSpanProcessor, BatchSpanProcessor, HTTPSpanExporter, and
    GRPCSpanExporter objects with Phoenix-aware defaults. Documentation on how to configure tracing
    can be found at https://opentelemetry.io/docs/specs/otel/trace/sdk/.

    Args:
        endpoint (str, optional): The collector endpoint to which spans will be exported. If not
            provided, the `PHOENIX_OTEL_COLLECTOR_ENDPOINT` environment variable will be used. The
            export protocol will be inferred from the endpoint.
        project_name (str, optional): The name of the project to which spans will be associated. If
            not provided, the `PHOENIX_PROJECT_NAME` environment variable will be used.
        batch (bool): If True, spans will be processed using a BatchSpanprocessor. If False, spans
            will be processed one at a time using a SimpleSpanProcessor.
        set_global (bool): If False, the TracerProvider will not be set as the global provider.
            Defaults to True.
        headers (dict): Optional headers to include in the HTTP request to the collector.
    """

    project_name = project_name or get_env_project_name()
    resource = Resource.create({PROJECT_NAME: project_name})
    tracer_provider = _TracerProvider(resource=resource)
    span_processor: SpanProcessor
    if batch:
        span_processor = BatchSpanProcessor(endpoint=endpoint, headers=headers)
    else:
        span_processor = SimpleSpanProcessor(endpoint=endpoint, headers=headers)
    tracer_provider.add_span_processor(span_processor)

    if set_global:
        trace_api.set_tracer_provider(tracer_provider)
    return tracer_provider


class TracerProvider(_TracerProvider):
    def __init__(self, *args: Any, endpoint: Optional[str] = None, **kwargs: Any):
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
        assert isinstance(parsed_url, ParseResult)
        self._default_processor = False

        if _maybe_http_endpoint(parsed_url):
            print("Exporting spans via HTTP.")
            http_exporter: SpanExporter = HTTPSpanExporter(endpoint=endpoint)
            self.add_span_processor(SimpleSpanProcessor(exporter=http_exporter))
            self._default_processor = True
        elif _maybe_grpc_endpoint(parsed_url):
            print("Exporting spans via GRPC.")
            grpc_exporter: SpanExporter = GRPCSpanExporter(endpoint=endpoint)
            self.add_span_processor(SimpleSpanProcessor(exporter=grpc_exporter))
            self._default_processor = True
        else:
            warnings.warn(
                "Could not infer exporter to use. Use `add_span_processor` to configure span "
                "processing and export."
            )

    def add_span_processor(self, *args: Any, **kwargs: Any) -> None:
        if self._default_processor:
            print("Overriding default span processor.")
            self._active_span_processor.shutdown()
            self._active_span_processor._span_processors = tuple()  # remove default processors
            self._default_processor = False
        return super().add_span_processor(*args, **kwargs)


class SimpleSpanProcessor(_SimpleSpanProcessor):
    def __init__(
        self,
        exporter: Optional[SpanExporter] = None,
        endpoint: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        if exporter is None:
            endpoint = endpoint or get_env_collector_endpoint()
            parsed_url = urlparse(endpoint)
            assert isinstance(parsed_url, ParseResult)
            if _maybe_http_endpoint(parsed_url):
                print("Exporting spans via HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
            elif _maybe_grpc_endpoint(parsed_url):
                print("Exporting spans via GRPC.")
                exporter = GRPCSpanExporter(endpoint=endpoint, headers=headers)
            else:
                warnings.warn("Could not infer collector endpoint protocol, defaulting to HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
        super().__init__(exporter)


class BatchSpanProcessor(_BatchSpanProcessor):
    def __init__(
        self,
        exporter: Optional[SpanExporter] = None,
        endpoint: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        if exporter is None:
            endpoint = endpoint or get_env_collector_endpoint()
            parsed_url = urlparse(endpoint)
            assert isinstance(parsed_url, ParseResult)
            if _maybe_http_endpoint(parsed_url):
                print("Exporting spans via HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
            elif _maybe_grpc_endpoint(parsed_url):
                print("Exporting spans via GRPC.")
                exporter = GRPCSpanExporter(endpoint=endpoint, headers=headers)
            else:
                warnings.warn("Could not infer collector endpoint protocol, defaulting to HTTP.")
                exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
        super().__init__(exporter)


class HTTPSpanExporter(_HTTPSpanExporter):
    def __init__(self, *args: Any, **kwargs: Any):
        sig = inspect.signature(_HTTPSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()

        if not bound_args.arguments.get("headers"):
            bound_args.arguments["headers"] = get_env_client_headers()

        if bound_args.arguments.get("endpoint") is None:
            bound_args.arguments["endpoint"] = get_env_collector_endpoint()
        super().__init__(**bound_args.arguments)


class GRPCSpanExporter(_GRPCSpanExporter):
    def __init__(self, *args: Any, **kwargs: Any):
        sig = inspect.signature(_GRPCSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()

        if not bound_args.arguments.get("headers"):
            bound_args.arguments["headers"] = get_env_client_headers()

        if bound_args.arguments.get("endpoint") is None:
            bound_args.arguments["endpoint"] = get_env_collector_endpoint()
        super().__init__(*args, **kwargs)


def _maybe_http_endpoint(parsed_endpoint: ParseResult) -> bool:
    if parsed_endpoint.path == "/v1/traces":
        return True
    return False


def _maybe_grpc_endpoint(parsed_endpoint: ParseResult) -> bool:
    if not parsed_endpoint.path and parsed_endpoint.port == 4317:
        return True
    return False
