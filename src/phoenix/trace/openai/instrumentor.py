import logging
from importlib.metadata import PackageNotFoundError
from importlib.util import find_spec
from typing import Any

from openinference.instrumentation.openai import OpenAIInstrumentor as Instrumentor
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.config import get_env_project_name
from phoenix.trace.exporter import _OpenInferenceExporter

logger = logging.getLogger(__name__)


class OpenAIInstrumentor(Instrumentor):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        if find_spec("openai") is None:
            raise PackageNotFoundError("Missing `openai`. Install with `pip install openai`.")
        super().__init__()

    def instrument(self) -> None:
        tracer_provider = trace_sdk.TracerProvider(
            resource=Resource({ResourceAttributes.PROJECT_NAME: get_env_project_name()}),
            span_limits=trace_sdk.SpanLimits(max_attributes=10_000),
        )
        tracer_provider.add_span_processor(SimpleSpanProcessor(_OpenInferenceExporter()))
        super().instrument(skip_dep_check=True, tracer_provider=tracer_provider)
