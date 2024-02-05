import logging
from importlib.metadata import PackageNotFoundError
from importlib.util import find_spec
from typing import Any
from urllib.parse import urljoin

from openinference.instrumentation.langchain import LangChainInstrumentor as OTELInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.config import get_env_collector_endpoint, get_env_host, get_env_port
from phoenix.trace.exporter import HttpExporter

logger = logging.getLogger(__name__)


__all__ = ("LangChainInstrumentor",)

_USE_ENV_MSG = (
    "Setting endpoint through the HttpExporter is no longer supported. "
    'Use environment variables instead, e.g. os.environ["PHOENIX_PORT"] = "54321"'
)


class LangChainInstrumentor:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        if args or kwargs:
            logger.warning(
                "LangChainInstrumentor no longer takes any arguments. "
                "The arguments provided is ignored."
            )
            for arg in args:
                if isinstance(arg, HttpExporter):
                    logger.warning(_USE_ENV_MSG)
            if "exporter" in kwargs:
                logger.warning(_USE_ENV_MSG)
        if find_spec("langchain_core") is None:
            raise PackageNotFoundError(
                "Missing `langchain-core`. Install with `pip install langchain-core`."
            )

    def instrument(self) -> None:
        host = get_env_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
        tracer_provider = trace_sdk.TracerProvider(resource=Resource(attributes={}))
        span_exporter = OTLPSpanExporter(endpoint=urljoin(base_url, "v1/traces"))
        tracer_provider.add_span_processor(SimpleSpanProcessor(span_exporter=span_exporter))
        OTELInstrumentor().instrument(skip_dep_check=True, tracer_provider=tracer_provider)
