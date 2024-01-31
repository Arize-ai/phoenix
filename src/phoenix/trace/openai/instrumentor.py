from typing import Optional, Union

from openinference.instrumentation.openai import (
    OpenAIInstrumentor as OpenInferenceOpenAIInstrumentor,
)

from ..tracer import OtelTracer, Tracer, is_legacy_tracer


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Union[Tracer, OtelTracer]] = None) -> None:
        """Instruments your OpenAI client to automatically create spans for each API call.

        Args:
            tracer (Optional[Tracer], optional): A tracer to record and handle spans. If not
            provided, the default tracer will be used.
        """
        if tracer is None:
            tracer = OtelTracer()
        elif is_legacy_tracer(tracer):
            tracer = OtelTracer.from_legacy_tracer(tracer)
        else:
            tracer = tracer
        self.tracer = tracer

    def instrument(self) -> None:
        """
        Instruments your OpenAI client.
        """
        self.tracer.configure_tracer()
        self._instrumentor = OpenInferenceOpenAIInstrumentor()
        self._instrumentor.instrument(skip_dep_check=True)

    def uninstrument(self) -> None:
        """
        Uninstruments your OpenAI client.
        """
        self._instrumentor.uninstrument()
