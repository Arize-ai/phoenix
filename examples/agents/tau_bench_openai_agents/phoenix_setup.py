# mypy: ignore-errors
"""
Phoenix + OpenInference instrumentation setup.

Initializes OpenTelemetry tracing with OpenInference and connects
to a local Phoenix instance for trace collection.
"""

import os

from openinference.instrumentation.openai_agents import OpenAIAgentsInstrumentor
from openinference.semconv.resource import ResourceAttributes
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

# Phoenix default OTLP endpoint (local). Override with PHOENIX_COLLECTOR_ENDPOINT
# to send traces to Phoenix Cloud (e.g. https://app.phoenix.arize.com/s/<space>).
PHOENIX_OTLP_ENDPOINT = "http://localhost:6006/v1/traces"
PHOENIX_UI_URL_DEFAULT = "http://localhost:6006"
PHOENIX_PROJECT_NAME = "tau-bench-openai"


def _resolve_endpoint(default: str) -> str:
    """Resolve OTLP traces endpoint, preferring PHOENIX_COLLECTOR_ENDPOINT env var.

    Appends `/v1/traces` if the env var points at a base URL.
    """
    env_endpoint = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT")
    if not env_endpoint:
        return default
    env_endpoint = env_endpoint.rstrip("/")
    if env_endpoint.endswith("/v1/traces"):
        return env_endpoint
    return f"{env_endpoint}/v1/traces"


def phoenix_ui_url() -> str:
    """Return the Phoenix UI base URL (without the OTLP `/v1/traces` suffix).

    Uses PHOENIX_COLLECTOR_ENDPOINT if set, otherwise the local default.
    """
    base = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", PHOENIX_UI_URL_DEFAULT).rstrip("/")
    if base.endswith("/v1/traces"):
        base = base[: -len("/v1/traces")]
    return base


def setup_instrumentation(
    endpoint: str | None = None,
    project_name: str = PHOENIX_PROJECT_NAME,
) -> trace_sdk.TracerProvider:
    """Set up OpenInference instrumentation for OpenAI Agents SDK.

    Configures a TracerProvider that exports spans to Phoenix via OTLP.
    Instruments the OpenAI Agents SDK so all LLM calls and tool executions
    produce spans automatically.

    Args:
        endpoint: OTLP HTTP endpoint for Phoenix. Defaults to local Phoenix.
        project_name: Phoenix project name to attach to emitted traces.

    Returns:
        The configured TracerProvider.
    """
    resolved_endpoint = endpoint or _resolve_endpoint(PHOENIX_OTLP_ENDPOINT)
    headers: dict[str, str] = {}
    api_key = os.environ.get("PHOENIX_API_KEY")
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"

    resource = Resource.create({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=resolved_endpoint, headers=headers or None)
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    # Share one provider for both auto-instrumented and manual spans.
    if type(trace_api.get_tracer_provider()).__name__ == "ProxyTracerProvider":
        trace_api.set_tracer_provider(tracer_provider)

    OpenAIAgentsInstrumentor().instrument(tracer_provider=tracer_provider)

    return tracer_provider
