import inspect
import os
import warnings
from typing import Any, Dict, List, Optional, Tuple, Union, cast
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

_DEFAULT_GRPC_PORT = 4317


def register(
    *,
    endpoint: Optional[str] = None,
    project_name: Optional[str] = None,
    batch: bool = False,
    set_global_tracer_provider: bool = True,
    headers: Optional[Dict[str, str]] = None,
    verbose: bool = True,
) -> _TracerProvider:
    """
    Creates an OpenTelemetry TracerProvider for enabling OpenInference tracing.

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
        set_global_tracer_provider (bool): If False, the TracerProvider will not be set as the global
            tracer provider. Defaults to True.
        headers (dict, optional): Optional headers to include in the HTTP request to the collector.
        verbose (bool): If True, configuration details will be printed to stdout.
    """

    project_name = project_name or get_env_project_name()
    resource = Resource.create({PROJECT_NAME: project_name})
    tracer_provider = TracerProvider(resource=resource, verbose=False)
    span_processor: SpanProcessor
    if batch:
        span_processor = BatchSpanProcessor(endpoint=endpoint, headers=headers)
    else:
        span_processor = SimpleSpanProcessor(endpoint=endpoint, headers=headers)
    tracer_provider.add_span_processor(span_processor)
    tracer_provider._default_processor = True

    if set_global_tracer_provider:
        trace_api.set_tracer_provider(tracer_provider)
        global_provider_msg = (
            "|  \n"
            "|  `register` has set this TracerProvider as the global OpenTelemetry default.\n"
            "|  To disable this behavior, call `register` with `set_global_tracer_provider=False`.\n"
        )
    else:
        global_provider_msg = ""

    details = tracer_provider._tracing_details()
    if verbose:
        print(f"{details}" f"{global_provider_msg}")
    return tracer_provider


class TracerProvider(_TracerProvider):
    def __init__(
        self, *args: Any, endpoint: Optional[str] = None, verbose: bool = True, **kwargs: Any
    ):
        sig = inspect.signature(_TracerProvider)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("resource") is None:
            bound_args.arguments["resource"] = Resource.create(
                {PROJECT_NAME: get_env_project_name()}
            )
        super().__init__(**bound_args.arguments)

        parsed_url, endpoint = _normalized_endpoint(endpoint)
        self._default_processor = False

        if _maybe_http_endpoint(parsed_url):
            http_exporter: SpanExporter = HTTPSpanExporter(endpoint=endpoint)
            self.add_span_processor(SimpleSpanProcessor(span_exporter=http_exporter))
            self._default_processor = True
        elif _maybe_grpc_endpoint(parsed_url):
            grpc_exporter: SpanExporter = GRPCSpanExporter(endpoint=endpoint)
            self.add_span_processor(SimpleSpanProcessor(span_exporter=grpc_exporter))
            self._default_processor = True
        if verbose:
            print(self._tracing_details())

    def add_span_processor(self, *args: Any, **kwargs: Any) -> None:
        if self._default_processor:
            self._active_span_processor.shutdown()
            self._active_span_processor._span_processors = tuple()  # remove default processors
            self._default_processor = False
        return super().add_span_processor(*args, **kwargs)

    def _tracing_details(self) -> str:
        project = self.resource.attributes.get(PROJECT_NAME)
        processor_name: Optional[str] = None
        endpoint: Optional[str] = None
        transport: Optional[str] = None
        headers: Optional[Union[Dict[str, str], str]] = None

        if self._active_span_processor:
            if processors := self._active_span_processor._span_processors:
                if len(processors) == 1:
                    span_processor = self._active_span_processor._span_processors[0]
                    if exporter := getattr(span_processor, "span_exporter"):
                        processor_name = span_processor.__class__.__name__
                        endpoint = exporter._endpoint
                        transport = _exporter_transport(exporter)
                        headers = _printable_headers(exporter._headers)
                else:
                    processor_name = "Multiple Span Processors"
                    endpoint = "Multiple Span Exporters"
                    transport = "Multiple Span Exporters"
                    headers = "Multiple Span Exporters"

        if os.name == "nt":
            details_header = "OpenTelemetry Tracing Details"
        else:
            details_header = "🔭 OpenTelemetry Tracing Details 🔭"

        configuration_msg = (
            "|  Using a default SpanProcessor. `add_span_processor` will overwrite this default.\n"
        )

        details_msg = (
            f"{details_header}\n"
            f"|  Phoenix Project: {project}\n"
            f"|  Span Processor: {processor_name}\n"
            f"|  Collector Endpoint: {endpoint}\n"
            f"|  Transport: {transport}\n"
            f"|  Transport Headers: {headers}\n"
            "|  \n"
            f"{configuration_msg if self._default_processor else ''}"
        )
        return details_msg


class SimpleSpanProcessor(_SimpleSpanProcessor):
    def __init__(
        self,
        span_exporter: Optional[SpanExporter] = None,
        endpoint: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        if span_exporter is None:
            parsed_url, endpoint = _normalized_endpoint(endpoint)
            if _maybe_http_endpoint(parsed_url):
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
            elif _maybe_grpc_endpoint(parsed_url):
                span_exporter = GRPCSpanExporter(endpoint=endpoint, headers=headers)
            else:
                warnings.warn("Could not infer collector endpoint protocol, defaulting to HTTP.")
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
        super().__init__(span_exporter)


class BatchSpanProcessor(_BatchSpanProcessor):
    def __init__(
        self,
        span_exporter: Optional[SpanExporter] = None,
        endpoint: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        if span_exporter is None:
            parsed_url, endpoint = _normalized_endpoint(endpoint)
            if _maybe_http_endpoint(parsed_url):
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
            elif _maybe_grpc_endpoint(parsed_url):
                span_exporter = GRPCSpanExporter(endpoint=endpoint, headers=headers)
            else:
                warnings.warn("Could not infer collector endpoint protocol, defaulting to HTTP.")
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
        super().__init__(span_exporter)


class HTTPSpanExporter(_HTTPSpanExporter):
    def __init__(self, *args: Any, **kwargs: Any):
        sig = inspect.signature(_HTTPSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()

        if not bound_args.arguments.get("headers"):
            bound_args.arguments["headers"] = get_env_client_headers()

        if bound_args.arguments.get("endpoint") is None:
            _, endpoint = _normalized_endpoint(None)
            bound_args.arguments["endpoint"] = endpoint
        super().__init__(**bound_args.arguments)


class GRPCSpanExporter(_GRPCSpanExporter):
    def __init__(self, *args: Any, **kwargs: Any):
        sig = inspect.signature(_GRPCSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()

        if not bound_args.arguments.get("headers"):
            bound_args.arguments["headers"] = get_env_client_headers()

        if bound_args.arguments.get("endpoint") is None:
            _, endpoint = _normalized_endpoint(None)
            bound_args.arguments["endpoint"] = endpoint
        super().__init__(**bound_args.arguments)


def _maybe_http_endpoint(parsed_endpoint: ParseResult) -> bool:
    if parsed_endpoint.path == "/v1/traces":
        return True
    return False


def _maybe_grpc_endpoint(parsed_endpoint: ParseResult) -> bool:
    if not parsed_endpoint.path and parsed_endpoint.port == 4317:
        return True
    return False


def _exporter_transport(exporter: SpanExporter) -> str:
    if isinstance(exporter, _HTTPSpanExporter):
        return "HTTP"
    if isinstance(exporter, _GRPCSpanExporter):
        return "gRPC"
    else:
        return exporter.__class__.__name__


def _printable_headers(headers: Union[List[Tuple[str, str]], Dict[str, str]]) -> Dict[str, str]:
    if isinstance(headers, dict):
        return {key.lower(): "****" for key, _ in headers.items()}
    return {key.lower(): "****" for key, _ in headers}


def _construct_http_endpoint(parsed_endpoint: ParseResult) -> ParseResult:
    return parsed_endpoint._replace(path="/v1/traces")


def _construct_grpc_endpoint(parsed_endpoint: ParseResult) -> ParseResult:
    return parsed_endpoint._replace(netloc=f"{parsed_endpoint.hostname}:{_DEFAULT_GRPC_PORT}")


_KNOWN_PROVIDERS = {
    "app.phoenix.arize.com": _construct_http_endpoint,
}


def _normalized_endpoint(endpoint: Optional[str]) -> Tuple[ParseResult, str]:
    if endpoint is None:
        base_endpoint = get_env_collector_endpoint() or "http://localhost:6006"
        parsed = urlparse(base_endpoint)
        if parsed.hostname in _KNOWN_PROVIDERS:
            parsed = _KNOWN_PROVIDERS[parsed.hostname](parsed)
        else:
            parsed = _construct_grpc_endpoint(parsed)
    else:
        parsed = urlparse(endpoint)
    parsed = cast(ParseResult, parsed)
    return parsed, parsed.geturl()
