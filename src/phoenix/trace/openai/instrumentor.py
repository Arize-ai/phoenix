import logging
from importlib.metadata import PackageNotFoundError
from importlib.util import find_spec
from typing import Any

from openinference.instrumentation.openai import OpenAIInstrumentor as Instrumentor
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.trace.exporter import _OpenInferenceExporter
from phoenix.trace.tracer import _show_deprecation_warnings

logger = logging.getLogger(__name__)


class OpenAIInstrumentor(Instrumentor):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        _show_deprecation_warnings(self, *args, **kwargs)
        if find_spec("openai") is None:
            raise PackageNotFoundError("Missing `openai`. Install with `pip install openai`.")
        super().__init__()

    def instrument(self) -> None:
        tracer_provider = trace_sdk.TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(_OpenInferenceExporter()))
        super().instrument(skip_dep_check=True, tracer_provider=tracer_provider)
