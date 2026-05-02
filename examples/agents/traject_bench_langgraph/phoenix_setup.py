# mypy: ignore-errors
"""
Phoenix + OpenInference instrumentation setup for LangChain/LangGraph.

Initializes OpenTelemetry tracing with OpenInference and connects
to a local Phoenix instance for trace collection. Uses the LangChain
instrumentor which auto-instruments both LangChain and LangGraph.
"""

from openinference.instrumentation.langchain import LangChainInstrumentor
from openinference.semconv.resource import ResourceAttributes
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

# Phoenix default OTLP endpoint
PHOENIX_OTLP_ENDPOINT = "http://localhost:6006/v1/traces"
PHOENIX_PROJECT_NAME = "traject-bench-langgraph"


def setup_instrumentation(
    endpoint: str = PHOENIX_OTLP_ENDPOINT,
    project_name: str = PHOENIX_PROJECT_NAME,
) -> trace_sdk.TracerProvider:
    """Set up OpenInference instrumentation for LangChain/LangGraph.

    Configures a TracerProvider that exports spans to Phoenix via OTLP.
    Instruments LangChain so all LLM calls, tool executions, and LangGraph
    node transitions produce spans automatically.

    Args:
        endpoint: OTLP HTTP endpoint for Phoenix. Defaults to local Phoenix.
        project_name: Phoenix project name to attach to emitted traces.

    Returns:
        The configured TracerProvider.
    """
    resource = Resource.create({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=endpoint)
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    # Share one provider for both auto-instrumented and manual spans.
    if type(trace_api.get_tracer_provider()).__name__ == "ProxyTracerProvider":
        trace_api.set_tracer_provider(tracer_provider)

    LangChainInstrumentor().instrument(tracer_provider=tracer_provider)

    return tracer_provider
