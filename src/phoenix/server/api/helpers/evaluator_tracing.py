"""Utilities for tracing evaluator execution with OpenTelemetry."""

from binascii import hexlify
from typing import Tuple
from urllib.parse import urljoin

import opentelemetry.sdk.trace as trace_sdk
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Tracer

from phoenix.config import get_base_url
from phoenix.server.api.context import get_env_client_headers


def get_evaluator_tracer(project_name: str) -> Tuple[Tracer, Resource]:
    """
    Create an OpenTelemetry tracer for evaluator execution.

    Mirrors the pattern from experiments/functions.py:_get_tracer()
    Exports traces to Phoenix's v1/traces endpoint.

    Args:
        project_name: Name of the project (typically the evaluator name)

    Returns:
        Tuple of (Tracer, Resource) for creating spans
    """
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    span_processor = SimpleSpanProcessor(
        OTLPSpanExporter(
            endpoint=urljoin(f"{get_base_url()}", "v1/traces"),
            headers=get_env_client_headers(),
        )
    )
    tracer_provider.add_span_processor(span_processor)
    return tracer_provider.get_tracer(__name__), resource


def str_trace_id(id_: int) -> str:
    """Convert OpenTelemetry trace ID to hex string."""
    return hexlify(id_.to_bytes(16, "big")).decode()
