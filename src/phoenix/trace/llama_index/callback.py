import logging
from typing import (
    Any,
    Callable,
    List,
    Optional,
)

from openinference.instrumentation.llama_index._callback import (
    OpenInferenceTraceCallbackHandler as _OpenInferenceTraceCallbackHandler,
)
from openinference.instrumentation.llama_index.version import (
    __version__,
)
from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.trace.exporter import _OpenInferenceExporter
from phoenix.trace.schemas import Span
from phoenix.trace.tracer import _USE_ENV_MSG

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
        exporter: Any = None,
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
        if exporter is not None:
            logger.warning(_USE_ENV_MSG)
        self._exporter = _OpenInferenceExporter().otel_exporter
        tracer_provider = trace_sdk.TracerProvider(resource=Resource(attributes={}))
        span_processor = SimpleSpanProcessor(span_exporter=self._exporter)
        tracer_provider.add_span_processor(span_processor)
        trace_api.set_tracer_provider(tracer_provider=tracer_provider)
        super().__init__(tracer=trace_api.get_tracer(__name__, __version__, tracer_provider))
