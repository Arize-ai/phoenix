from typing import Any, Generator, Optional
from unittest.mock import MagicMock, Mock, patch
from urllib.parse import urlparse

import pytest
from opentelemetry import trace as trace_api
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor as _BatchSpanProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SimpleSpanProcessor
from opentelemetry.sdk.trace.export import SpanExporter

from phoenix.otel.otel import (
    PROJECT_NAME,
    BatchSpanProcessor,
    GRPCSpanExporter,
    HTTPSpanExporter,
    OTLPTransportProtocol,
    SimpleSpanProcessor,
    TracerProvider,
    _construct_phoenix_cloud_endpoint,
    register,
)


def _get_exporter_from_processor(span_processor: Any) -> Optional[SpanExporter]:
    """
    Helper function to get the exporter from a span processor.
    Handles both old and new OpenTelemetry versions.
    OpenTelemetry v1.34.0+ moved exporter from span_exporter to _batch_processor._exporter
    """
    return getattr(getattr(span_processor, "_batch_processor", None), "_exporter", None) or getattr(
        span_processor, "span_exporter", None
    )


@pytest.fixture(autouse=True)
def reset_tracer_provider() -> Generator[None, None, None]:
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
    def test_register_basic(self) -> None:
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

    def test_register_with_project_name(self) -> None:
        project_name = "test-project"
        tracer_provider = register(project_name=project_name, verbose=False)

        assert tracer_provider.resource.attributes.get(PROJECT_NAME) == project_name

    def test_register_with_batch_processor(self) -> None:
        tracer_provider = register(batch=True, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1
        assert isinstance(processors[0], _BatchSpanProcessor)

        # Verify the exporter is configured
        exporter = _get_exporter_from_processor(processors[0])
        assert isinstance(exporter, GRPCSpanExporter)

    def test_register_with_simple_processor(self) -> None:
        tracer_provider = register(batch=False, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1
        assert isinstance(processors[0], _SimpleSpanProcessor)

    def test_register_without_global_tracer(self) -> None:
        tracer_provider = register(set_global_tracer_provider=False, verbose=False)

        assert trace_api.get_tracer_provider() != tracer_provider
        assert isinstance(tracer_provider, TracerProvider)

    def test_register_with_http_endpoint(self) -> None:
        endpoint = "http://custom-endpoint:4318/v1/traces"
        tracer_provider = register(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, HTTPSpanExporter)
        assert exporter._endpoint == endpoint

    def test_register_with_grpc_endpoint(self) -> None:
        endpoint = "grpc://custom-endpoint:4317"
        tracer_provider = register(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    @patch("phoenix.otel.otel.get_env_client_headers")
    def test_register_with_headers(self, mock_env_headers: Any) -> None:
        mock_env_headers.return_value = None
        headers = {"Authorization": "Bearer token123"}

        tracer_provider = register(headers=headers, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        exporter = processors[0].span_exporter

        # Headers should be set on the exporter
        assert "authorization" in [h[0].lower() for h in exporter._headers]

    def test_register_with_http_protocol(self) -> None:
        tracer_provider = register(protocol="http/protobuf", verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        exporter = processors[0].span_exporter
        assert isinstance(exporter, HTTPSpanExporter)

    def test_register_with_grpc_protocol(self) -> None:
        tracer_provider = register(protocol="grpc", verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    @patch("phoenix.otel.otel._auto_instrument_installed_openinference_libraries")
    def test_register_with_auto_instrument(self, mock_auto_instrument: Any) -> None:
        tracer_provider = register(auto_instrument=True, verbose=False)

        mock_auto_instrument.assert_called_once_with(tracer_provider)

    @patch("builtins.print")
    def test_register_verbose_output(self, mock_print: Any) -> None:
        register(verbose=True)

        mock_print.assert_called()
        output = str(mock_print.call_args)
        assert "OpenTelemetry Tracing Details" in output

    def test_register_with_custom_resource_no_project_name(self) -> None:
        """Test that project name is merged into custom resource when no
        project_name is provided."""
        custom_resource = Resource.create(
            {"service.name": "my-service", "service.version": "1.0.0"}
        )

        with patch("phoenix.otel.otel.get_env_project_name", return_value="env-project"):
            tracer_provider = register(resource=custom_resource, verbose=False)

        # Should have both custom attributes and project name
        assert tracer_provider.resource.attributes.get("service.name") == "my-service"
        assert tracer_provider.resource.attributes.get("service.version") == "1.0.0"
        assert tracer_provider.resource.attributes.get(PROJECT_NAME) == "env-project"

    def test_register_with_custom_resource_and_project_name(self) -> None:
        """Test that explicit project name is merged into custom resource."""
        custom_resource = Resource.create(
            {"service.name": "my-service", "service.version": "1.0.0"}
        )

        tracer_provider = register(
            project_name="explicit-project", resource=custom_resource, verbose=False
        )

        # Should have both custom attributes and explicit project name
        assert tracer_provider.resource.attributes.get("service.name") == "my-service"
        assert tracer_provider.resource.attributes.get("service.version") == "1.0.0"
        assert tracer_provider.resource.attributes.get(PROJECT_NAME) == "explicit-project"

    def test_register_with_custom_resource_overrides_project_name(self) -> None:
        """Test that project name in custom resource gets overridden by explicit project_name."""
        custom_resource = Resource.create(
            {"service.name": "my-service", PROJECT_NAME: "resource-project"}
        )

        tracer_provider = register(
            project_name="explicit-project", resource=custom_resource, verbose=False
        )

        # Explicit project name should override the one in resource
        assert tracer_provider.resource.attributes.get("service.name") == "my-service"
        assert tracer_provider.resource.attributes.get(PROJECT_NAME) == "explicit-project"

    def test_register_passes_through_kwargs_to_tracer_provider(self) -> None:
        """Test that additional kwargs are passed through to TracerProvider."""
        from opentelemetry.sdk.trace.id_generator import IdGenerator
        from opentelemetry.sdk.trace.sampling import ALWAYS_OFF

        # Create a mock id generator
        mock_id_generator = Mock(spec=IdGenerator)

        tracer_provider = register(
            project_name="test-project",
            sampler=ALWAYS_OFF,
            id_generator=mock_id_generator,
            verbose=False,
        )

        # Check that the sampler was passed through
        assert tracer_provider.sampler == ALWAYS_OFF

        # Check that the id_generator was passed through
        assert tracer_provider.id_generator == mock_id_generator

    def test_register_with_custom_id_generator(self) -> None:
        """Test register with a custom ID generator."""
        from opentelemetry.sdk.trace.id_generator import IdGenerator

        class CustomIdGenerator(IdGenerator):
            def generate_span_id(self) -> int:
                return 0x1234567890ABCDEF

            def generate_trace_id(self) -> int:
                return 0x12345678901234567890123456789012

        custom_id_gen = CustomIdGenerator()

        tracer_provider = register(
            project_name="test-project", id_generator=custom_id_gen, verbose=False
        )

        # Verify the custom ID generator was set
        assert tracer_provider.id_generator == custom_id_gen

    def test_register_with_span_limits(self) -> None:
        """Test register with custom span limits."""
        from opentelemetry.sdk.trace import SpanLimits

        custom_limits = SpanLimits(max_attributes=50, max_events=20, max_links=10)

        tracer_provider = register(
            project_name="test-project", span_limits=custom_limits, verbose=False
        )

        # Verify the span limits were set
        assert tracer_provider._span_limits == custom_limits
        assert tracer_provider._span_limits.max_attributes == 50
        assert tracer_provider._span_limits.max_events == 20
        assert tracer_provider._span_limits.max_links == 10

    def test_register_with_multiple_kwargs(self) -> None:
        """Test register with multiple kwargs including resource."""
        from opentelemetry.sdk.trace import SpanLimits
        from opentelemetry.sdk.trace.id_generator import IdGenerator
        from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

        custom_resource = Resource.create(
            {"service.name": "test-service", "deployment.environment": "testing"}
        )

        custom_sampler = TraceIdRatioBased(0.5)
        custom_limits = SpanLimits(max_attributes=100)
        mock_id_generator = Mock(spec=IdGenerator)

        tracer_provider = register(
            project_name="multi-test-project",
            resource=custom_resource,
            sampler=custom_sampler,
            span_limits=custom_limits,
            id_generator=mock_id_generator,
            verbose=False,
        )

        # Verify all kwargs were passed through
        assert tracer_provider.sampler == custom_sampler
        assert tracer_provider._span_limits == custom_limits
        assert tracer_provider.id_generator == mock_id_generator

        # Verify resource was merged with project name
        assert tracer_provider.resource.attributes.get("service.name") == "test-service"
        assert tracer_provider.resource.attributes.get("deployment.environment") == "testing"
        assert tracer_provider.resource.attributes.get(PROJECT_NAME) == "multi-test-project"

    def test_register_tracer_provider_verbose_is_always_false(self) -> None:
        """Test that TracerProvider verbose is always False even when register verbose=True."""
        with patch("phoenix.otel.otel.TracerProvider") as mock_tracer_provider:
            mock_instance = Mock()
            mock_tracer_provider.return_value = mock_instance
            mock_instance._default_processor = True
            mock_instance._tracing_details.return_value = "test details"

            register(verbose=True)

            # Verify TracerProvider was called with verbose=False
            call_args = mock_tracer_provider.call_args
            assert not call_args.kwargs["verbose"]


class TestTracerProvider:
    def test_tracer_provider_creation(self) -> None:
        tracer_provider = TracerProvider(verbose=False)

        assert isinstance(tracer_provider, TracerProvider)
        assert tracer_provider._default_processor

        # Should have a default processor
        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

    def test_tracer_provider_with_resource(self) -> None:
        resource = Resource.create({"custom.attribute": "value"})
        tracer_provider = TracerProvider(resource=resource, verbose=False)

        assert tracer_provider.resource == resource

    def test_tracer_provider_with_http_endpoint(self) -> None:
        endpoint = "http://localhost:4318/v1/traces"
        tracer_provider = TracerProvider(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, HTTPSpanExporter)
        assert exporter._endpoint == endpoint

    def test_tracer_provider_with_grpc_endpoint(self) -> None:
        endpoint = "localhost:4317"
        tracer_provider = TracerProvider(endpoint=endpoint, verbose=False)

        processors = tracer_provider._active_span_processor._span_processors
        assert len(processors) == 1

        exporter = processors[0].span_exporter
        assert isinstance(exporter, GRPCSpanExporter)

    def test_add_span_processor_replaces_default(self) -> None:
        tracer_provider = TracerProvider(verbose=False)
        assert tracer_provider._default_processor

        custom_processor = Mock(spec=_SimpleSpanProcessor)
        tracer_provider.add_span_processor(custom_processor)

        assert not tracer_provider._default_processor
        # The default processor should have been removed
        assert custom_processor in tracer_provider._active_span_processor._span_processors

    def test_add_span_processor_without_replace(self) -> None:
        tracer_provider = TracerProvider(verbose=False)
        assert tracer_provider._default_processor

        initial_count = len(tracer_provider._active_span_processor._span_processors)

        custom_processor = Mock(spec=_SimpleSpanProcessor)
        tracer_provider.add_span_processor(custom_processor, replace_default_processor=False)

        assert tracer_provider._default_processor
        # Both processors should be present
        assert len(tracer_provider._active_span_processor._span_processors) == initial_count + 1

    @patch("builtins.print")
    def test_tracer_provider_verbose(self, mock_print: Any) -> None:
        TracerProvider(verbose=True)

        mock_print.assert_called()
        output = str(mock_print.call_args)
        assert "OpenTelemetry Tracing Details" in output


class TestSpanProcessors:
    def test_simple_span_processor_http(self) -> None:
        endpoint = "http://localhost:4318/v1/traces"
        processor = SimpleSpanProcessor(endpoint=endpoint)

        assert isinstance(processor, _SimpleSpanProcessor)
        assert isinstance(processor.span_exporter, HTTPSpanExporter)
        assert processor.span_exporter._endpoint == endpoint

    def test_simple_span_processor_grpc(self) -> None:
        endpoint = "localhost:4317"
        processor = SimpleSpanProcessor(endpoint=endpoint, protocol="grpc")

        assert isinstance(processor, _SimpleSpanProcessor)
        assert isinstance(processor.span_exporter, GRPCSpanExporter)
        assert processor.span_exporter._endpoint == endpoint

    def test_simple_span_processor_with_exporter(self) -> None:
        mock_exporter = MagicMock()
        processor = SimpleSpanProcessor(span_exporter=mock_exporter)

        assert processor.span_exporter == mock_exporter

    def test_batch_span_processor_http(self) -> None:
        endpoint = "http://localhost:4318/v1/traces"
        processor = BatchSpanProcessor(endpoint=endpoint)

        assert isinstance(processor, _BatchSpanProcessor)
        exporter = _get_exporter_from_processor(processor)
        assert isinstance(exporter, HTTPSpanExporter)
        assert exporter._endpoint == endpoint

    def test_batch_span_processor_grpc(self) -> None:
        endpoint = "localhost:4317"
        processor = BatchSpanProcessor(endpoint=endpoint, protocol="grpc")

        assert isinstance(processor, _BatchSpanProcessor)
        exporter = _get_exporter_from_processor(processor)
        assert isinstance(exporter, GRPCSpanExporter)
        assert exporter._endpoint == endpoint


class TestSpanExporters:
    @patch("phoenix.otel.otel.get_env_client_headers")
    @patch("phoenix.otel.otel.get_env_phoenix_auth_header")
    def test_http_span_exporter_env_headers(
        self, mock_auth_header: Any, mock_client_headers: Any
    ) -> None:
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
    def test_grpc_span_exporter_env_headers(
        self, mock_auth_header: Any, mock_client_headers: Any
    ) -> None:
        mock_client_headers.return_value = {"X-Custom": "value"}
        mock_auth_header.return_value = {"Authorization": "Bearer token"}

        exporter = GRPCSpanExporter()

        mock_client_headers.assert_called_once()
        mock_auth_header.assert_called_once()

        # Check headers were set (gRPC uses list of tuples)
        if exporter._headers:
            headers_dict = {h[0].lower(): h[1] for h in exporter._headers}
            assert headers_dict.get("x-custom") == "value"
            assert headers_dict.get("authorization") == "Bearer token"

    def test_http_span_exporter_with_explicit_headers(self) -> None:
        headers = {"Custom-Header": "custom-value"}
        exporter = HTTPSpanExporter(headers=headers)

        headers_dict = {h.lower(): v for h, v in exporter._headers.items()}
        assert headers_dict.get("custom-header") == "custom-value"

    def test_grpc_span_exporter_with_explicit_headers(self) -> None:
        headers = {"Custom-Header": "custom-value"}
        exporter = GRPCSpanExporter(headers=headers)

        if exporter._headers:
            headers_dict = {h[0].lower(): h[1] for h in exporter._headers}
            assert headers_dict.get("custom-header") == "custom-value"


class TestEndpointNormalization:
    def test_normalized_endpoint_http_explicit(self) -> None:
        from phoenix.otel.otel import _normalized_endpoint

        parsed, endpoint = _normalized_endpoint("http://localhost:6006/v1/traces", use_http=True)

        assert parsed.scheme == "http"
        assert parsed.netloc == "localhost:6006"
        assert parsed.path == "/v1/traces"
        assert endpoint == "http://localhost:6006/v1/traces"

    def test_normalized_endpoint_grpc_explicit(self) -> None:
        from phoenix.otel.otel import _normalized_endpoint

        parsed, endpoint = _normalized_endpoint("localhost:4317", use_http=False)

        assert endpoint == "localhost:4317"

    def test_normalized_endpoint_known_provider(self) -> None:
        from phoenix.otel.otel import _normalized_endpoint

        with patch(
            "phoenix.otel.otel.get_env_collector_endpoint",
            return_value="https://app.phoenix.arize.com",
        ):
            parsed, endpoint = _normalized_endpoint(None)

            assert parsed.scheme == "https"
            assert parsed.netloc == "app.phoenix.arize.com"
            assert parsed.path == "/v1/traces"

    def test_normalized_endpoint_none_defaults(self) -> None:
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


class TestPhoenixCloudEndpoint:
    def test_space_path_basic(self) -> None:
        parsed = urlparse("https://app.phoenix.arize.com/s/testspace")
        result = _construct_phoenix_cloud_endpoint(parsed)

        assert result.path == "/s/testspace/v1/traces"

    def test_space_path_with_trailing_slash(self) -> None:
        parsed = urlparse("https://app.phoenix.arize.com/s/my-space_01/")
        result = _construct_phoenix_cloud_endpoint(parsed)

        assert result.path == "/s/my-space_01/v1/traces"

    def test_space_path_with_additional_components(self) -> None:
        parsed = urlparse("https://app.phoenix.arize.com/s/space123/extra/path")
        result = _construct_phoenix_cloud_endpoint(parsed)

        assert result.path == "/s/space123/v1/traces"

    def test_non_space_path_defaults(self) -> None:
        parsed = urlparse("https://app.phoenix.arize.com/some/other/path")
        result = _construct_phoenix_cloud_endpoint(parsed)

        assert result.path == "/v1/traces"

    def test_empty_space_id_defaults(self) -> None:
        parsed = urlparse("https://app.phoenix.arize.com/s/")
        result = _construct_phoenix_cloud_endpoint(parsed)

        assert result.path == "/v1/traces"


class TestOTLPTransportProtocol:
    def test_valid_protocols(self) -> None:
        assert OTLPTransportProtocol("http/protobuf") == OTLPTransportProtocol.HTTP_PROTOBUF
        assert OTLPTransportProtocol("grpc") == OTLPTransportProtocol.GRPC
        assert OTLPTransportProtocol("infer") == OTLPTransportProtocol.INFER
        assert OTLPTransportProtocol(None) == OTLPTransportProtocol.INFER

    def test_invalid_protocols(self) -> None:
        with pytest.raises(ValueError) as exc_info:
            OTLPTransportProtocol("http")
        assert "Did you mean 'http/protobuf'?" in str(exc_info.value)

        with pytest.raises(ValueError) as exc_info:
            OTLPTransportProtocol("invalid")
        assert "Must one of" in str(exc_info.value)

        with pytest.raises(ValueError) as exc_info:
            OTLPTransportProtocol(123)
        assert "Must be a string" in str(exc_info.value)
