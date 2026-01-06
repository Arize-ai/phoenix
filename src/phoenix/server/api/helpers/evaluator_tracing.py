from binascii import hexlify
from typing import Tuple
from urllib.parse import urljoin

import opentelemetry.sdk.trace as trace_sdk
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Tracer

from phoenix.config import get_base_url, get_env_client_headers


def get_evaluator_tracer(project_name: str) -> Tuple[Tracer, Resource, SpanExporter]:
    """
    Creates and configures a tracer for evaluator operations with dual export capabilities.

    This function sets up OpenTelemetry tracing for evaluators with two span processors:
    1. OTLP exporter - Sends traces to the Phoenix backend via HTTP
    2. In-memory exporter - Keeps traces in memory for immediate access

    Args:
        project_name: The name of the project to associate with the traces

    Returns:
        A tuple containing:
        - Tracer: The configured tracer instance for creating spans
        - Resource: The resource metadata containing the project name
        - SpanExporter: The in-memory exporter for retrieving stored spans
    """
    # Create resource with project name metadata
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)

    # Set up OTLP processor to export spans to Phoenix backend
    otlp_processor = SimpleSpanProcessor(
        OTLPSpanExporter(
            endpoint=urljoin(f"{get_base_url()}", "v1/traces"),
            headers=get_env_client_headers(),
        )
    )
    tracer_provider.add_span_processor(otlp_processor)

    # Set up in-memory processor to keep spans accessible in memory
    memory_exporter = InMemorySpanExporter()
    memory_processor = SimpleSpanProcessor(memory_exporter)
    tracer_provider.add_span_processor(memory_processor)

    return tracer_provider.get_tracer(__name__), resource, memory_exporter


def str_trace_id(id_: int) -> str:
    """
    Converts a numeric trace ID to its hexadecimal string representation.

    Args:
        id_: The numeric trace ID (128-bit integer)

    Returns:
        A 32-character hexadecimal string representation of the trace ID
    """
    return hexlify(id_.to_bytes(16, "big")).decode()
