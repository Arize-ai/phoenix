from openinference.instrumentation import TracerProvider as OITracerProvider
from openinference.instrumentation.pydantic_ai import OpenInferenceSpanProcessor
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from phoenix.server.telemetry import normalize_http_collector_endpoint


def get_tracer_provider(
    *,
    collector_endpoint: str | None,
    collector_api_key: str | None,
    project_name: str,
) -> OITracerProvider | None:
    if not collector_endpoint:
        return None
    resource = (
        Resource.create({ResourceAttributes.PROJECT_NAME: project_name}) if project_name else None
    )
    provider = OITracerProvider(resource=resource)
    provider.add_span_processor(OpenInferenceSpanProcessor())
    headers: dict[str, str] = {}
    if collector_api_key:
        headers["Authorization"] = f"Bearer {collector_api_key}"
    exporter = OTLPSpanExporter(
        endpoint=normalize_http_collector_endpoint(collector_endpoint) + "/v1/traces",
        headers=headers,
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    return provider
