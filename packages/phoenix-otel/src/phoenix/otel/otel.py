import inspect
import os
import re
import sys
import warnings
from enum import Enum
from importlib.metadata import entry_points
from typing import Any, Dict, List, Literal, Optional, Tuple, Type, Union
from urllib.parse import ParseResult, urlparse

from openinference.instrumentation import TracerProvider as _TracerProvider
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
from opentelemetry.sdk.trace.export import BatchSpanProcessor as _BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SimpleSpanProcessor
from opentelemetry.sdk.trace.export import SpanExporter

from .settings import (
    get_env_client_headers,
    get_env_collector_endpoint,
    get_env_grpc_port,
    get_env_phoenix_auth_header,
    get_env_project_name,
)

PROJECT_NAME = _ResourceAttributes.PROJECT_NAME


class OTLPTransportProtocol(str, Enum):
    HTTP_PROTOBUF = "http/protobuf"
    GRPC = "grpc"
    INFER = "infer"

    @classmethod
    def _missing_(cls, value: object) -> "OTLPTransportProtocol":
        if not isinstance(value, (str, type(None))):
            raise ValueError(f"Invalid protocol: {value}. Must be a string.")
        if value is None:
            return cls.INFER
        elif "http" in value:
            raise ValueError(
                (
                    f"Invalid protocol: {value}. Must be one of {cls._valid_protocols_str()}. "
                    "Did you mean 'http/protobuf'?"
                )
            )
        else:
            raise ValueError(
                (f"Invalid protocol: {value}. Must one of {cls._valid_protocols_str()}.")
            )

    @classmethod
    def _valid_protocols_str(cls) -> str:
        return "[" + ", ".join([f"'{protocol.value}'" for protocol in cls]) + "]"


def register(
    *,
    endpoint: Optional[str] = None,
    project_name: Optional[str] = None,
    batch: bool = False,
    set_global_tracer_provider: bool = True,
    headers: Optional[Dict[str, str]] = None,
    protocol: Optional[Literal["http/protobuf", "grpc"]] = None,
    verbose: bool = True,
    auto_instrument: bool = False,
) -> _TracerProvider:
    """
    Creates an OpenTelemetry TracerProvider for enabling OpenInference tracing.

    For futher configuration, the `phoenix.otel` module provides drop-in replacements for
    OpenTelemetry TracerProvider, SimpleSpanProcessor, BatchSpanProcessor, HTTPSpanExporter, and
    GRPCSpanExporter objects with Phoenix-aware defaults. Documentation on how to configure tracing
    can be found at https://opentelemetry.io/docs/specs/otel/trace/sdk/.

    Args:
        endpoint (str, optional): The collector endpoint to which spans will be exported. If not
            provided, the `PHOENIX_COLLECTOR_ENDPOINT` environment variable will be used. The
            export protocol will be inferred from the endpoint.
        project_name (str, optional): The name of the project to which spans will be associated. If
            not provided, the `PHOENIX_PROJECT_NAME` environment variable will be used.
        batch (bool): If True, spans will be processed using a BatchSpanprocessor. If False, spans
            will be processed one at a time using a SimpleSpanProcessor.
        set_global_tracer_provider (bool): If False, the TracerProvider will not be set as the
            global tracer provider. Defaults to True.
        headers (dict, optional): Optional headers to include in the request to the collector.
            If not provided, the `PHOENIX_CLIENT_HEADERS` environment variable will be used.
        protocol (str, optional): The protocol to use for the collector endpoint. Must be either
            "http/protobuf" or "grpc". If not provided, the protocol will be inferred.
        verbose (bool): If True, configuration details will be printed to stdout.
        auto_instrument (bool): If True, automatically instruments all installed OpenInference
            libraries.
    """

    project_name = project_name or get_env_project_name()
    resource = Resource.create({PROJECT_NAME: project_name})
    tracer_provider = TracerProvider(resource=resource, verbose=False, protocol=protocol)
    span_processor: SpanProcessor
    if batch:
        span_processor = BatchSpanProcessor(endpoint=endpoint, headers=headers, protocol=protocol)
    else:
        span_processor = SimpleSpanProcessor(endpoint=endpoint, headers=headers, protocol=protocol)
    tracer_provider.add_span_processor(span_processor)
    tracer_provider._default_processor = True

    if set_global_tracer_provider:
        trace_api.set_tracer_provider(tracer_provider)
        global_provider_msg = (
            "|  \n"
            "|  `register` has set this TracerProvider as the global OpenTelemetry default.\n"
            "|  To disable this behavior, call `register` with "
            "`set_global_tracer_provider=False`.\n"
        )
    else:
        global_provider_msg = ""

    if auto_instrument:
        _auto_instrument_installed_openinference_libraries(tracer_provider)

    details = tracer_provider._tracing_details()
    if verbose:
        print(f"{details}{global_provider_msg}")
    return tracer_provider


class TracerProvider(_TracerProvider):
    """
    An extension of `opentelemetry.sdk.trace.TracerProvider` with Phoenix-aware defaults.

    Extended keyword arguments are documented in the `Args` section. For further documentation, see
    the OpenTelemetry documentation at https://opentelemetry.io/docs/specs/otel/trace/sdk/.

    Args:
        endpoint (str, optional): The collector endpoint to which spans will be exported. If
            specified, a default SpanProcessor will be created and added to this TracerProvider.
            If not provided, the `PHOENIX_COLLECTOR_ENDPOINT` environment variable will be
            used to infer which collector endpoint to use, defaults to the gRPC endpoint. When
            specifying the endpoint, the transport method (HTTP or gRPC) will be inferred from the
            URL.
        protocol (str, optional): The protocol to use for the collector endpoint. Must be either
            "http/protobuf" or "grpc". If not provided, the protocol will be inferred.
        verbose (bool): If True, configuration details will be printed to stdout.
    """

    def __init__(
        self,
        *args: Any,
        endpoint: Optional[str] = None,
        protocol: Optional[Literal["http/protobuf", "grpc"]] = None,
        verbose: bool = True,
        **kwargs: Any,
    ):
        sig = _get_class_signature(_TracerProvider)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        if bound_args.arguments.get("resource") is None:
            bound_args.arguments["resource"] = Resource.create(
                {PROJECT_NAME: get_env_project_name()}
            )
        super().__init__(*bound_args.args, **bound_args.kwargs)

        validated_protocol = OTLPTransportProtocol(protocol)
        use_http = validated_protocol == OTLPTransportProtocol.HTTP_PROTOBUF
        parsed_url, endpoint = _normalized_endpoint(endpoint, use_http=use_http)
        self._default_processor = False

        if (
            _maybe_http_endpoint(parsed_url)
            or validated_protocol == OTLPTransportProtocol.HTTP_PROTOBUF
        ):
            http_exporter: SpanExporter = HTTPSpanExporter(endpoint=endpoint)
            self.add_span_processor(SimpleSpanProcessor(span_exporter=http_exporter))
            self._default_processor = True
        elif _maybe_grpc_endpoint(parsed_url) or validated_protocol == OTLPTransportProtocol.GRPC:
            grpc_exporter: SpanExporter = GRPCSpanExporter(endpoint=endpoint)
            self.add_span_processor(SimpleSpanProcessor(span_exporter=grpc_exporter))
            self._default_processor = True
        if verbose:
            print(self._tracing_details())

    def add_span_processor(
        self, *args: Any, replace_default_processor: bool = True, **kwargs: Any
    ) -> None:
        """
        Registers a new `SpanProcessor` for this `TracerProvider`.

        If this `TracerProvider` has a default processor, it will be removed.
        """

        if self._default_processor and replace_default_processor:
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
        span_processor: Optional[SpanProcessor] = None

        if self._active_span_processor:
            if processors := self._active_span_processor._span_processors:
                if len(processors) == 1:
                    span_processor = self._active_span_processor._span_processors[0]
                    # Handle both old and new attribute locations for OpenTelemetry compatibility
                    # OpenTelemetry v1.34.0+ moved exporter from span_exporter to
                    # _batch_processor._exporter
                    # https://github.com/open-telemetry/opentelemetry-python/pull/4580

                    exporter = getattr(
                        getattr(span_processor, "_batch_processor", None), "_exporter", None
                    ) or getattr(span_processor, "span_exporter", None)
                    if exporter:
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

        using_simple_processor = span_processor is not None and isinstance(
            span_processor, _SimpleSpanProcessor
        )
        span_processor_warning = "|  \n"
        if os.name == "nt":
            span_processor_warning += (
                "|  WARNING: It is strongly advised to use a BatchSpanProcessor in production "
                "environments.\n"
            )
        else:
            span_processor_warning += (
                "|  ⚠️ WARNING: It is strongly advised to use a BatchSpanProcessor in production "
                "environments.\n"
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
            f"{span_processor_warning if using_simple_processor else ''}"
        )
        return details_msg


class SimpleSpanProcessor(_SimpleSpanProcessor):
    """
    Simple SpanProcessor implementation.

    SimpleSpanProcessor is an implementation of `SpanProcessor` that passes ended spans directly to
    the configured `SpanExporter`.

    Args:
        span_exporter (SpanExporter, optional): The `SpanExporter` to which ended spans will be
            passed.
        endpoint (str, optional): The collector endpoint to which spans will be exported. If not
            provided, the `PHOENIX_COLLECTOR_ENDPOINT` environment variable will be used to
            infer which collector endpoint to use, defaults to the gRPC endpoint. When specifying
            the endpoint, the transport method (HTTP or gRPC) will be inferred from the URL.
        headers (dict, optional): Optional headers to include in the request to the collector.
            If not provided, the `PHOENIX_CLIENT_HEADERS` or `OTEL_EXPORTER_OTLP_HEADERS`
            environment variable will be used.
        protocol (str, optional): The protocol to use for the collector endpoint. Must be either
            "http/protobuf" or "grpc". If not provided, the protocol will be inferred.
    """

    def __init__(
        self,
        span_exporter: Optional[SpanExporter] = None,
        endpoint: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        protocol: Optional[Literal["http/protobuf", "grpc"]] = None,
    ):
        if span_exporter is None:
            validated_protocol = OTLPTransportProtocol(protocol)
            use_http = validated_protocol == OTLPTransportProtocol.HTTP_PROTOBUF
            parsed_url, endpoint = _normalized_endpoint(endpoint, use_http=use_http)
            if (
                _maybe_http_endpoint(parsed_url)
                or validated_protocol == OTLPTransportProtocol.HTTP_PROTOBUF
            ):
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
            elif (
                _maybe_grpc_endpoint(parsed_url) or validated_protocol == OTLPTransportProtocol.GRPC
            ):
                span_exporter = GRPCSpanExporter(endpoint=endpoint, headers=headers)
            else:
                warnings.warn("Could not infer collector endpoint protocol, defaulting to HTTP.")
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
        super().__init__(span_exporter)


class BatchSpanProcessor(_BatchSpanProcessor):
    """
    Batch SpanProcessor implementation.

    `BatchSpanProcessor` is an implementation of `SpanProcessor` that batches ended spans and
    pushes them to the configured `SpanExporter`.

    `BatchSpanProcessor` is configurable with the following environment variables which correspond
    to constructor parameters:

    - :envvar:`OTEL_BSP_SCHEDULE_DELAY`
    - :envvar:`OTEL_BSP_MAX_QUEUE_SIZE`
    - :envvar:`OTEL_BSP_MAX_EXPORT_BATCH_SIZE`
    - :envvar:`OTEL_BSP_EXPORT_TIMEOUT`

    Args:
        span_exporter (SpanExporter, optional): The `SpanExporter` to which ended spans will be
            passed.
        endpoint (str, optional): The collector endpoint to which spans will be exported. If not
            provided, the `PHOENIX_COLLECTOR_ENDPOINT` environment variable will be used to
            infer which collector endpoint to use, defaults to the gRPC endpoint. When specifying
            the endpoint, the transport method (HTTP or gRPC) will be inferred from the URL.
        headers (dict, optional): Optional headers to include in the request to the collector.
            If not provided, the `PHOENIX_CLIENT_HEADERS` or `OTEL_EXPORTER_OTLP_HEADERS`
            environment variable will be used.
        protocol (str, optional): The protocol to use for the collector endpoint. Must be either
            "http/protobuf" or "grpc". If not provided, the protocol will be inferred.
        max_queue_size (int, optional): The maximum queue size.
        schedule_delay_millis (float, optional): The delay between two consecutive exports in
            milliseconds.
        max_export_batch_size (int, optional): The maximum batch size.
        export_timeout_millis (float, optional): The batch timeout in milliseconds.
    """

    def __init__(
        self,
        span_exporter: Optional[SpanExporter] = None,
        endpoint: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        protocol: Optional[Literal["http/protobuf", "grpc"]] = None,
    ):
        if span_exporter is None:
            validated_protocol = OTLPTransportProtocol(protocol)
            use_http = validated_protocol == OTLPTransportProtocol.HTTP_PROTOBUF
            parsed_url, endpoint = _normalized_endpoint(endpoint, use_http=use_http)
            if (
                _maybe_http_endpoint(parsed_url)
                or validated_protocol == OTLPTransportProtocol.HTTP_PROTOBUF
            ):
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
            elif (
                _maybe_grpc_endpoint(parsed_url) or validated_protocol == OTLPTransportProtocol.GRPC
            ):
                span_exporter = GRPCSpanExporter(endpoint=endpoint, headers=headers)
            else:
                warnings.warn("Could not infer collector endpoint protocol, defaulting to HTTP.")
                span_exporter = HTTPSpanExporter(endpoint=endpoint, headers=headers)
        super().__init__(span_exporter)


class HTTPSpanExporter(_HTTPSpanExporter):
    """
    OTLP span exporter using HTTP.

    For more information, see:
    - `opentelemetry.exporter.otlp.proto.http.trace_exporter.OTLPSpanExporter`

    Args:
        endpoint (str, optional): OpenTelemetry Collector receiver endpoint. If not provided, the
            `PHOENIX_COLLECTOR_ENDPOINT` environment variable will be used to infer which
            collector endpoint to use, defaults to the HTTP endpoint.
        headers: Headers to send when exporting. If not provided, the `PHOENIX_CLIENT_HEADERS`
            or `OTEL_EXPORTER_OTLP_HEADERS` environment variables will be used.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        sig = _get_class_signature(_HTTPSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()

        if not bound_args.arguments.get("headers"):
            env_headers = get_env_client_headers()
            auth_header = get_env_phoenix_auth_header()
            inferred_headers = {
                **(env_headers or dict()),
                **(auth_header or dict()),
            }
            bound_args.arguments["headers"] = inferred_headers if inferred_headers else None
        else:
            headers: Dict[str, str] = dict()
            for header_field, value in bound_args.arguments["headers"].items():
                headers[header_field.lower()] = value

            # If the auth header is not in the headers, add it
            if "authorization" not in headers:
                auth_header = get_env_phoenix_auth_header()
                bound_args.arguments["headers"] = {
                    **headers,
                    **(auth_header or dict()),
                }
            else:
                bound_args.arguments["headers"] = headers

        if bound_args.arguments.get("endpoint") is None:
            _, endpoint = _normalized_endpoint(None, use_http=True)
            bound_args.arguments["endpoint"] = endpoint
        super().__init__(*bound_args.args, **bound_args.kwargs)


class GRPCSpanExporter(_GRPCSpanExporter):
    """
    OTLP span exporter using gRPC.

    For more information, see:
    - `opentelemetry.exporter.otlp.proto.grpc.trace_exporter.OTLPSpanExporter`

    Args:
        endpoint (str, optional): OpenTelemetry Collector receiver endpoint. If not provided, the
            `PHOENIX_COLLECTOR_ENDPOINT` environment variable will be used to infer which
            collector endpoint to use, defaults to the gRPC endpoint.
        insecure: Connection type
        credentials: Credentials object for server authentication
        headers: Headers to send when exporting. If not provided, the `PHOENIX_CLIENT_HEADERS`
            or `OTEL_EXPORTER_OTLP_HEADERS` environment variables will be used.
        timeout: Backend request timeout in seconds
        compression: gRPC compression method to use
    """

    def __init__(self, *args: Any, **kwargs: Any):
        sig = _get_class_signature(_GRPCSpanExporter)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()

        if not bound_args.arguments.get("headers"):
            env_headers = get_env_client_headers()
            auth_header = get_env_phoenix_auth_header()
            inferred_headers = {
                **(env_headers or dict()),
                **(auth_header or dict()),
            }
            bound_args.arguments["headers"] = inferred_headers if inferred_headers else None
        else:
            headers: Dict[str, str] = dict()
            for header_field, value in bound_args.arguments["headers"].items():
                headers[header_field.lower()] = value

            # If the auth header is not in the headers, add it
            if "authorization" not in headers:
                auth_header = get_env_phoenix_auth_header()
                bound_args.arguments["headers"] = {
                    **headers,
                    **(auth_header or dict()),
                }
            else:
                bound_args.arguments["headers"] = headers

        if bound_args.arguments.get("endpoint") is None:
            _, endpoint = _normalized_endpoint(None)
            bound_args.arguments["endpoint"] = endpoint
        super().__init__(*bound_args.args, **bound_args.kwargs)


def _maybe_http_endpoint(parsed_endpoint: ParseResult) -> bool:
    if parsed_endpoint.path == "/v1/traces":
        return True
    return False


def _maybe_grpc_endpoint(parsed_endpoint: ParseResult) -> bool:
    if not parsed_endpoint.path and parsed_endpoint.port == get_env_grpc_port():
        return True
    return False


def _exporter_transport(exporter: SpanExporter) -> str:
    if isinstance(exporter, _HTTPSpanExporter):
        return "HTTP + protobuf"
    if isinstance(exporter, _GRPCSpanExporter):
        return "gRPC"
    else:
        return exporter.__class__.__name__


def _printable_headers(headers: Union[List[Tuple[str, str]], Dict[str, str]]) -> Dict[str, str]:
    if isinstance(headers, dict):
        return {key: "****" for key, _ in headers.items()}
    return {key: "****" for key, _ in headers}


def _construct_http_endpoint(parsed_endpoint: ParseResult) -> ParseResult:
    return parsed_endpoint._replace(path="/v1/traces")


def _construct_phoenix_cloud_endpoint(parsed_endpoint: ParseResult) -> ParseResult:
    space_pattern = r"^/s/([a-zA-Z0-9_-]+)"

    match = re.match(space_pattern, parsed_endpoint.path)
    if match:
        space_id = match.group(1)
        new_path = f"/s/{space_id}/v1/traces"
        return parsed_endpoint._replace(path=new_path)
    else:
        return parsed_endpoint._replace(path="/v1/traces")


def _construct_grpc_endpoint(parsed_endpoint: ParseResult) -> ParseResult:
    return parsed_endpoint._replace(netloc=f"{parsed_endpoint.hostname}:{get_env_grpc_port()}")


_KNOWN_PROVIDERS = {
    "app.phoenix.arize.com": _construct_phoenix_cloud_endpoint,
}


def _has_scheme(s: str) -> bool:
    return "//" in s


def _normalized_endpoint(
    endpoint: Optional[str], use_http: bool = False
) -> Tuple[ParseResult, str]:
    if endpoint is None:
        base_endpoint = get_env_collector_endpoint() or "http://localhost:6006"
        parsed = urlparse(base_endpoint)
        if parsed.hostname in _KNOWN_PROVIDERS:
            parsed = _KNOWN_PROVIDERS[parsed.hostname](parsed)
        elif use_http:
            parsed = _construct_http_endpoint(parsed)
        else:
            parsed = _construct_grpc_endpoint(parsed)
    else:
        if not _has_scheme(endpoint):
            # Use // to indicate an "authority" to properly parse the URL
            # https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Syntax
            # However, return the original endpoint to avoid overspecifying the URL scheme
            return urlparse(f"//{endpoint}"), endpoint
        parsed = urlparse(endpoint)
    return parsed, parsed.geturl()


def _get_class_signature(fn: Type[Any]) -> inspect.Signature:
    if sys.version_info >= (3, 9):
        return inspect.signature(fn)
    elif sys.version_info >= (3, 8):
        init_signature = inspect.signature(fn.__init__)
        new_params = list(init_signature.parameters.values())[1:]  # Skip 'self'
        new_sig = init_signature.replace(parameters=new_params)
        return new_sig
    else:
        raise RuntimeError("Unsupported Python version")


def _auto_instrument_installed_openinference_libraries(tracer_provider: TracerProvider) -> None:
    if sys.version_info < (3, 10):
        openinference_entry_points = entry_points().get("openinference_instrumentor", [])
    else:
        openinference_entry_points = entry_points(group="openinference_instrumentor")
    if not openinference_entry_points:
        warnings.warn(
            "No OpenInference instrumentors found. "
            "Maybe you need to update your OpenInference version? "
            "Skipping auto-instrumentation."
        )
        return
    for entry_point in openinference_entry_points:
        instrumentor_cls = entry_point.load()
        instrumentor = instrumentor_cls()
        instrumentor.instrument(tracer_provider=tracer_provider)
