import os
from typing import TYPE_CHECKING, Literal, Optional

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_METRICS_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_METRICS_COLLECTOR_HTTP_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)

if TYPE_CHECKING:
    from opentelemetry.metrics import MeterProvider
    from opentelemetry.trace import TracerProvider

from logging import getLogger

logger = getLogger(__name__)


def normalize_http_collector_endpoint(
    endpoint: str,
    suffix: Optional[Literal["v1/traces", "v1/metrics"]] = None,
) -> str:
    endpoint = endpoint.rstrip("/")  # remove trailing slashes
    if not (endpoint.startswith("http://") or endpoint.startswith("https://")):
        logger.warning(
            "HTTP collector endpoint should include the "
            "protocol http:// or https://. Assuming http."
        )
        # assume http if no protocol is provided
        endpoint = f"http://{endpoint}"
    for tail in ("/v1/traces", "/v1/metrics"):
        if endpoint.endswith(tail):
            logger.warning(
                f"HTTP collector endpoint should not include the {tail} path. Removing it."
            )
            endpoint = endpoint[: -len(tail)]
            break
    return f"{endpoint}/{suffix}" if suffix else endpoint


def initialize_opentelemetry_tracer_provider() -> Optional["TracerProvider"]:
    http_endpoint = os.getenv(ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT)
    grpc_endpoint = os.getenv(ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT)
    if not (http_endpoint or grpc_endpoint):
        return None
    logger.info("Initializing OpenTelemetry tracer provider")
    from opentelemetry.sdk import trace as trace_sdk
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.semconv.resource import ResourceAttributes

    tracer_provider = trace_sdk.TracerProvider(
        resource=Resource(attributes={ResourceAttributes.SERVICE_NAME: "arize-phoenix-server"})
    )
    if http_endpoint:
        logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
        http_endpoint = normalize_http_collector_endpoint(http_endpoint, "v1/traces")
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter as HttpExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(HttpExporter(http_endpoint)))
    if grpc_endpoint:
        logger.info(f"Using gRPC collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter as GrpcExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(GrpcExporter(grpc_endpoint)))
    logger.info("🔭 OpenTelemetry tracer provider initialized")
    return tracer_provider


def initialize_opentelemetry_meter_provider() -> Optional["MeterProvider"]:
    http_endpoint = os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_METRICS_COLLECTOR_HTTP_ENDPOINT
    )
    grpc_endpoint = os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_METRICS_COLLECTOR_GRPC_ENDPOINT
    )
    if not (http_endpoint or grpc_endpoint):
        return None
    logger.info("Initializing OpenTelemetry meter provider")
    from opentelemetry.sdk import metrics as metrics_sdk
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.semconv.resource import ResourceAttributes

    metric_readers = []
    if http_endpoint:
        logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
        http_endpoint = normalize_http_collector_endpoint(http_endpoint, "v1/metrics")
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
            OTLPMetricExporter as HttpExporter,
        )

        metric_readers.append(PeriodicExportingMetricReader(HttpExporter(http_endpoint)))
    if grpc_endpoint:
        logger.info(f"Using gRPC collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
            OTLPMetricExporter as GrpcExporter,
        )

        metric_readers.append(PeriodicExportingMetricReader(GrpcExporter(grpc_endpoint)))
    meter_provider = metrics_sdk.MeterProvider(
        metric_readers=metric_readers,
        resource=Resource(attributes={ResourceAttributes.SERVICE_NAME: "arize-phoenix-server"}),
    )
    logger.info("🔭 OpenTelemetry meter provider initialized")
    return meter_provider
