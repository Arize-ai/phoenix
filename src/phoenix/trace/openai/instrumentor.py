from typing import Optional

from openinference.instrumentation.openai import (
    OpenAIInstrumentor as OpenInferenceOpenAIInstrumentor,
)
from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.trace.exporter import _OpenInferenceExporter
from phoenix.trace.tracer import Tracer


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Tracer] = None) -> None:
        """
        Instruments your OpenAI client to automatically create spans for each
        API call.

        Args:
            tracer (Optional[Tracer]): A tracer to record and handle spans. This
            argument is now defunct and will be removed in a future version of
            Phoenix.
        """
        self._exporter = _OpenInferenceExporter().otel_exporter
        self._tracer_provider = trace_sdk.TracerProvider(resource=Resource(attributes={}))

    def instrument(self) -> None:
        """
        Instruments your OpenAI client.
        """
        span_processor = SimpleSpanProcessor(span_exporter=self._exporter)
        self._tracer_provider.add_span_processor(span_processor)
        trace_api.set_tracer_provider(tracer_provider=self._tracer_provider)
        self._instrumentor = OpenInferenceOpenAIInstrumentor()
        self._instrumentor.instrument(skip_dep_check=True)

    def uninstrument(self) -> None:
        """
        Uninstruments your OpenAI client.
        """
        self._instrumentor.uninstrument()
