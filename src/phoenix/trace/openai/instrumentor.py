from typing import Optional, Union

from openinference.instrumentation.openai import (
    OpenAIInstrumentor as OpenInferenceOpenAIInstrumentor,
)

from phoenix.trace.tracer import OpenInferenceTracer, Tracer, _is_legacy_tracer


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Union[Tracer, OpenInferenceTracer]] = None) -> None:
        """Instruments your OpenAI client to automatically create spans for each API call.

        Args:
            tracer (Optional[Tracer, OpenInferenceTracer], optional): A tracer to record and handle
            spans. If not provided, the default tracer will be used.
        """
        if tracer is None:
            tracer = OpenInferenceTracer()
        elif _is_legacy_tracer(tracer):
            tracer = OpenInferenceTracer._from_legacy_tracer(tracer)
        self.tracer = tracer

    def instrument(self) -> None:
        """
        Instruments your OpenAI client.
        """
        self.tracer._configure_otel_tracer()
        self._instrumentor = OpenInferenceOpenAIInstrumentor()
        self._instrumentor.instrument(skip_dep_check=True)

    def uninstrument(self) -> None:
        """
        Uninstruments your OpenAI client.
        """
        self._instrumentor.uninstrument()
