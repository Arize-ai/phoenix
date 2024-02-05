"""
This module is defunct and will be removed in the future. It's currently
maintaining a dummy class to avoid breaking any import code.
"""
import logging
import sys
from typing import Any, Iterator, Protocol

from phoenix.trace.exporter import HttpExporter

logger = logging.getLogger(__name__)


class SpanExporter(Protocol):
    def export(self, _: Any) -> None:
        ...


_DEFUNCT_MSG = (
    "DEFUNCT: `Tracer` is a defunct class in the current version of Phoenix. "
    "It no longer has any purpose or functionality and will be removed in the future."
)
_USE_ENV_MSG = (
    "Setting endpoint through the HttpExporter is no longer supported. "
    'Use environment variables instead, e.g. os.environ["PHOENIX_PORT"] = "54321"'
)


class Tracer:
    _exporter: Any

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        for arg in args:
            if isinstance(arg, HttpExporter):
                logger.warning(_USE_ENV_MSG)
        if "exporter" in kwargs:
            logger.warning(_USE_ENV_MSG)
        logger.warning(_DEFUNCT_MSG)

    def create_span(self, *_: Any, **__: Any) -> Any:
        logger.warning(_DEFUNCT_MSG)

    def get_spans(self) -> Iterator[Any]:
        logger.warning(_DEFUNCT_MSG)
        logger.warning(
            ".get_spans() is a defunct method that does nothing. It will be removed in the future."
        )
        return iter(())


class _DefunctModule:
    __all__ = ("Tracer", "SpanExporter")

    def __getattr__(self, name: str) -> Any:
        if name == "Tracer":
            logger.warning(_DEFUNCT_MSG)
            return Tracer
        if name == "SpanExporter":
            return SpanExporter
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _DefunctModule()  # type: ignore
