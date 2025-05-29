from unittest.mock import MagicMock, Mock, patch

import pytest
from opentelemetry import trace as trace_api
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor as _BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SimpleSpanProcessor

from phoenix.otel.otel import (
    PROJECT_NAME,
    BatchSpanProcessor,
    GRPCSpanExporter,
    HTTPSpanExporter,
    OTLPTransportProtocol,
    SimpleSpanProcessor,
    TracerProvider,
    register,
)


@pytest.fixture(autouse=True)
def reset_tracer_provider():
    """Reset OpenTelemetry tracer provider for test isolation."""
    original_provider = trace_api.get_tracer_provider()
    trace_api._TRACER_PROVIDER = None

    # Mock get_env_grpc_port to return consistent value
    with patch.dict("os.environ", {}, clear=True):
        with patch("phoenix.otel.otel.get_env_grpc_port", return_value=4317):
            yield

    current_provider = trace_api.get_tracer_provider()
    if hasattr(current_provider, "shutdown"):
        try:
            current_provider.shutdown()
        except Exception:
            pass

    trace_api._TRACER_PROVIDER = original_provider


class TestRegister:
    def test_register_basic(self):
        tracer_provider = register(verbose=False)

        assert isinstance(tracer_provider, TracerProvider)
        assert trace_api.get_tracer_provider() == tracer_provider
        assert tracer_provider._default_processor

        # Verify a processor was added
        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1
        assert isinstance(processors[0], _SimpleSpanProcessor)

        # Verify the exporter is configured
        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    def test_register_with_project_name(self):
        project_name = "test-project"
        tracer_provider = register(project_name=project_name, verbose=False)

        assert tracer_provider.resource.attributes.get(PROJECT_NAME) == project_name

    def test_register_with_batch_processor(self):
        tracer_provider = register(batch=True, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1
        assert isinstance(processors[0], _BatchSpanProcessor)

        # Verify the exporter is configured
        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    def test_register_with_simple_processor(self):
        tracer_provider = register(batch=False, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1
        assert isinstance(processors[0], _SimpleSpanProcessor)

    def test_register_without_global_tracer(self):
        tracer_provider = register(set_global_tracer_provider=False, verbose=False)

        assert trace_api.get_tracer_provider() != tracer_provider
        assert isinstance(tracer_provider, TracerProvider)

    def test_register_with_http_endpoint(self):
        endpoint = "http://custom-endpoint:4318/v1/traces"
        tracer_provider = register(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, HTTPSpanExporter)
        assert exporter._endpoint == endpoint

    def test_register_with_grpc_endpoint(self):
        endpoint = "grpc://custom-endpoint:4317"
        tracer_provider = register(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    @patch("phoenix.otel.otel.get_env_client_headers")
    def test_register_with_headers(self, mock_env_headers):
        mock_env_headers.return_value = None
        headers = {"Authorization": "Bearer token123"}

        tracer_provider = register(headers=headers, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        exporter = processors[0].span_exporter

        # Headers should be set on the exporter
        assert "authorization" in [h[0].lower() for h in exporter._headers]

    def test_register_with_http_protocol(self):
        tracer_provider = register(protocol="http/protobuf", verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        exporter = processors[0].span_exporter
        assert isinstance(exporter, HTTPSpanExporter)

    def test_register_with_grpc_protocol(self):
        tracer_provider = register(protocol="grpc", verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    @patch("phoenix.otel.otel._auto_instrument_installed_openinference_libraries")
    def test_register_with_auto_instrument(self, mock_auto_instrument):
        tracer_provider = register(auto_instrument=True, verbose=False)

        mock_auto_instrument.assert_called_once_with(tracer_provider)

    @patch("builtins.print")
    def test_register_verbose_output(self, mock_print):
        register(verbose=True)

        mock_print.assert_called()
        output = str(mock_print.call_args)
        assert "OpenTelemetry Tracing Details" in output


class TestTracerProvider:
    def test_tracer_provider_creation(self):
        tracer_provider = TracerProvider(verbose=False)

        assert isinstance(tracer_provider, TracerProvider)
        assert tracer_provider._default_processor

        # Should have a default processor
        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

    def test_tracer_provider_with_resource(self):
        resource = Resource.create({"custom.attribute": "value"})
        tracer_provider = TracerProvider(resource=resource, verbose=False)

        assert tracer_provider.resource == resource

    def test_tracer_provider_with_http_endpoint(self):
        endpoint = "http://localhost:4318/v1/traces"
        tracer_provider = TracerProvider(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, HTTPSpanExporter)
        assert exporter._endpoint == endpoint

    def test_tracer_provider_with_grpc_endpoint(self):
        endpoint = "localhost:4317"
        tracer_provider = TracerProvider(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    def test_add_span_processor_replaces_default(self):
        tracer_provider = TracerProvider(verbose=False)
        assert tracer_provider._default_processor

        custom_processor = Mock(spec=_SimpleSpanProcessor)
        tracer_provider.add_span_processor(custom_processor)

        assert not tracer_provider._default_processor
        # The default processor should have been removed
        assert custom_processor in tracer_provider._active_span_processor._span_processors

    def test_add_span_processor_without_replace(self):
        tracer_provider = TracerProvider(verbose=False)
        assert tracer_provider._default_processor

        initial_count = len(tracer_provider._active_span_processor._span_processors)

        custom_processor = Mock(spec=_SimpleSpanProcessor)
        tracer_provider.add_span_processor(custom_processor, replace_default_processor=False)

        assert tracer_provider._default_processor
        # Both processors should be present
        assert len(tracer_provider._active_span_processor._span_processors) == initial_count + 1

    @patch("builtins.print")
    def test_tracer_provider_verbose(self, mock_print):
        TracerProvider(verbose=True)

        mock_print.assert_called()
        output = str(mock_print.call_args)
        assert "OpenTelemetry Tracing Details" in output


class TestSpanProcessors:
    def test_simple_span_processor_http(self):
        endpoint = "http://localhost:4318/v1/traces"
        processor = SimpleSpanProcessor(endpoint=endpoint)

        assert isinstance(processor, _SimpleSpanProcessor)
        assert isinstance(processor.span_exporter, HTTPSpanExporter)
        assert processor.span_exporter._endpoint == endpoint

    def test_simple_span_processor_grpc(self):
        endpoint = "localhost:4317"
        processor = SimpleSpanProcessor(endpoint=endpoint, protocol="grpc")

        assert isinstance(processor, _SimpleSpanProcessor)
        assert isinstance(processor.span_exporter, GRPCSpanExporter)
        assert processor.span_exporter._endpoint == endpoint

    def test_simple_span_processor_with_exporter(self):
        mock_exporter = MagicMock()
        processor = SimpleSpanProcessor(span_exporter=mock_exporter)

        assert processor.span_exporter == mock_exporter

    def test_batch_span_processor_http(self):
        endpoint = "http://localhost:4318/v1/traces"
        processor = BatchSpanProcessor(endpoint=endpoint)

        assert isinstance(processor, _BatchSpanProcessor)
        assert isinstance(processor.span_exporter, HTTPSpanExporter)
        assert processor.span_exporter._endpoint == endpoint

    def test_batch_span_processor_grpc(self):
        endpoint = "localhost:4317"
        processor = BatchSpanProcessor(endpoint=endpoint, protocol="grpc")

        assert isinstance(processor, _BatchSpanProcessor)
        assert isinstance(processor.span_exporter, GRPCSpanExporter)
        assert processor.span_exporter._endpoint == endpoint


class TestSpanExporters:
    @patch("phoenix.otel.otel.get_env_client_headers")
    @patch("phoenix.otel.otel.get_env_phoenix_auth_header")
    def test_http_span_exporter_env_headers(self, mock_auth_header, mock_client_headers):
        mock_client_headers.return_value = {"X-Custom": "value"}
        mock_auth_header.return_value = {"Authorization": "Bearer token"}

        exporter = HTTPSpanExporter()

        mock_client_headers.assert_called_once()
        mock_auth_header.assert_called_once()

        # Check headers were set
        headers_dict = {h.lower(): v for h, v in exporter._headers.items()}
        assert headers_dict.get("x-custom") == "value"
        assert headers_dict.get("authorization") == "Bearer token"

    @patch("phoenix.otel.otel.get_env_client_headers")
    @patch("phoenix.otel.otel.get_env_phoenix_auth_header")
    def test_grpc_span_exporter_env_headers(self, mock_auth_header, mock_client_headers):
        mock_client_headers.return_value = {"X-Custom": "value"}
        mock_auth_header.return_value = {"Authorization": "Bearer token"}

        exporter = GRPCSpanExporter()

        mock_client_headers.assert_called_once()
        mock_auth_header.assert_called_once()

        # Check headers were set (gRPC uses list of tuples)
        headers_dict = {h[0].lower(): h[1] for h in exporter._headers}
        assert headers_dict.get("x-custom") == "value"
        assert headers_dict.get("authorization") == "Bearer token"

    def test_http_span_exporter_with_explicit_headers(self):
        headers = {"Custom-Header": "custom-value"}
        exporter = HTTPSpanExporter(headers=headers)

        headers_dict = {h.lower(): v for h, v in exporter._headers.items()}
        assert headers_dict.get("custom-header") == "custom-value"

    def test_grpc_span_exporter_with_explicit_headers(self):
        headers = {"Custom-Header": "custom-value"}
        exporter = GRPCSpanExporter(headers=headers)

        headers_dict = {h[0].lower(): h[1] for h in exporter._headers}
        assert headers_dict.get("custom-header") == "custom-value"


class TestEndpointNormalization:
    def test_normalized_endpoint_http_explicit(self):
        from phoenix.otel.otel import _normalized_endpoint

        parsed, endpoint = _normalized_endpoint("http://localhost:6006/v1/traces", use_http=True)

        assert parsed.scheme == "http"
        assert parsed.netloc == "localhost:6006"
        assert parsed.path == "/v1/traces"
        assert endpoint == "http://localhost:6006/v1/traces"

    def test_normalized_endpoint_grpc_explicit(self):
        from phoenix.otel.otel import _normalized_endpoint

        parsed, endpoint = _normalized_endpoint("localhost:4317", use_http=False)

        assert endpoint == "localhost:4317"

    def test_normalized_endpoint_known_provider(self):
        from phoenix.otel.otel import _normalized_endpoint

        with patch(
            "phoenix.otel.otel.get_env_collector_endpoint",
            return_value="https://app.phoenix.arize.com",
        ):
            parsed, endpoint = _normalized_endpoint(None)

            assert parsed.scheme == "https"
            assert parsed.netloc == "app.phoenix.arize.com"
            assert parsed.path == "/v1/traces"

    def test_normalized_endpoint_none_defaults(self):
        from phoenix.otel.otel import _normalized_endpoint

        with patch("phoenix.otel.otel.get_env_collector_endpoint", return_value=None):
            with patch("phoenix.otel.otel.get_env_grpc_port", return_value=4317):
                parsed, endpoint = _normalized_endpoint(None, use_http=True)
                assert parsed.scheme == "http"
                assert parsed.netloc == "localhost:6006"
                assert parsed.path == "/v1/traces"

                parsed, endpoint = _normalized_endpoint(None, use_http=False)
                assert parsed.scheme == "http"
                assert parsed.netloc == "localhost:4317"


class TestOTLPTransportProtocol:
    def test_valid_protocols(self):
        assert OTLPTransportProtocol("http/protobuf") == OTLPTransportProtocol.HTTP_PROTOBUF
        assert OTLPTransportProtocol("grpc") == OTLPTransportProtocol.GRPC
        assert OTLPTransportProtocol("infer") == OTLPTransportProtocol.INFER
        assert OTLPTransportProtocol(None) == OTLPTransportProtocol.INFER

    def test_invalid_protocols(self):
        with pytest.raises(ValueError) as exc_info:
            OTLPTransportProtocol("http")
        assert "Did you mean 'http/protobuf'?" in str(exc_info.value)

        with pytest.raises(ValueError) as exc_info:
            OTLPTransportProtocol("invalid")
        assert "Must one of" in str(exc_info.value)

        with pytest.raises(ValueError) as exc_info:
            OTLPTransportProtocol(123)
        assert "Must be a string" in str(exc_info.value)
