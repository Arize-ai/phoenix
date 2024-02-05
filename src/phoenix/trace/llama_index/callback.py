import logging
from typing import (
    Callable,
    List,
    Optional,
    Union,
)

from openinference.instrumentation.llama_index import (
    OpenInferenceTraceCallbackHandler as _OpenInferenceTraceCallbackHandler,
)
from openinference.instrumentation.llama_index import (
    __version__,
)
from opentelemetry import trace as trace_api

from phoenix.trace.exporter import HttpExporter, NoOpExporter, _OpenInferenceExporter
from phoenix.trace.schemas import Span
from phoenix.trace.tracer import Tracer

logger = logging.getLogger(__name__)


class OpenInferenceTraceCallbackHandler(_OpenInferenceTraceCallbackHandler):
    """Callback handler for storing LLM application trace data in OpenInference format.
    OpenInference is an open standard for capturing and storing AI model
    inferences. It enables production LLMapp servers to seamlessly integrate
    with LLM observability solutions such as Arize and Phoenix.

    For more information on the specification, see
    https://github.com/Arize-ai/openinference
    """

    def __init__(
        self,
        callback: Optional[Callable[[List[Span]], None]] = None,
        exporter: Optional[Union[_OpenInferenceExporter, HttpExporter, NoOpExporter]] = None,
    ) -> None:
        if callback is not None:
            logger.warning(
                "OpenInference has been updated for full OpenTelemetry compliance. "
                "The legacy `callback` argument has been deprecated and no longer has any effect. "
                "If you need access to spans for processing, some options include exporting spans "
                "from an OpenTelemetry collector or adding a SpanProcessor to the OpenTelemetry "
                "TracerProvider. More examples can be found in the Phoenix docs: "
                "https://docs.arize.com/phoenix/deployment/instrumentation"
            )
        compat_tracer = Tracer(exporter=exporter)
        compat_tracer._configure_otel_tracer()  # temporary until we make a PR to llama_index
        super().__init__(
            tracer=trace_api.get_tracer(__name__, __version__, compat_tracer._tracer_provider)
        )
