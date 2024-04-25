import os

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)


def initialize_opentelemetry_tracer_provider() -> None:
    from opentelemetry import trace as trace_api
    from opentelemetry.sdk import trace as trace_sdk
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    tracer_provider = trace_sdk.TracerProvider()
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
    ):
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter as HttpExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(HttpExporter(http_endpoint)))
    if grpc_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT
    ):
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter as GrpcExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(GrpcExporter(grpc_endpoint)))
    trace_api.set_tracer_provider(tracer_provider)
