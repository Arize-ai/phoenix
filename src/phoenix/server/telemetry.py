import os
from typing import TYPE_CHECKING

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider
from logging import getLogger

logger = getLogger(__name__)


def normalize_http_collector_endpoint(endpoint: str) -> str:
    normalized_endpoint = endpoint
    if not normalized_endpoint.startswith("http://") and not normalized_endpoint.startswith(
        "https://"
    ):
        logger.warning(
            "HTTP collector endpoint should include the protocol (http:// or https://)."
            "Assuming http."
        )
        # assume http if no protocol is provided
        normalized_endpoint = f"http://{endpoint}"
    if normalized_endpoint.endswith("/v1/traces"):
        logger.warning(
            "HTTP collector endpoint should not include the /v1/traces path. Removing it."
        )
        # remove the /v1/traces path
        normalized_endpoint = normalized_endpoint[: -len("/v1/traces")]
    # remove trailing slashes
    normalized_endpoint = normalized_endpoint.rstrip("/")
    return normalized_endpoint


def initialize_opentelemetry_tracer_provider() -> "TracerProvider":
    logger.info("Initializing OpenTelemetry tracer provider")
    from opentelemetry.sdk import trace as trace_sdk
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.semconv.resource import ResourceAttributes

    tracer_provider = trace_sdk.TracerProvider(
        resource=Resource(attributes={ResourceAttributes.SERVICE_NAME: "arize-phoenix-server"})
    )
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
        http_endpoint = normalize_http_collector_endpoint(http_endpoint) + "/v1/traces"
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter as HttpExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(HttpExporter(http_endpoint)))
    if grpc_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT
    ):
        logger.info(f"Using gRPC collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter as GrpcExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(GrpcExporter(grpc_endpoint)))
    logger.info("🔭 OpenTelemetry tracer provider initialized")
    return tracer_provider
