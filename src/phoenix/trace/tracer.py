"""
This module is defunct and will be removed in the future. It's currently
maintaining a dummy class to avoid breaking any import code.
"""
import logging
import sys
from typing import Any, Iterator, Protocol

logger = logging.getLogger(__name__)


class SpanExporter(Protocol):
    def export(self, _: Any) -> None:
        ...


_DEPRECATION_MESSAGE = (
    "DEFUNCT: `Tracer` is a defunct class in the current version of Phoenix. "
    "It no longer has any purpose or functionality and will be removed in the future."
)


class Tracer:
    _exporter: Any

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        logger.warning(_DEPRECATION_MESSAGE)

    def create_span(self, *_: Any, **__: Any) -> Any:
        logger.warning(_DEPRECATION_MESSAGE)

    def get_spans(self) -> Iterator[Any]:
        logger.warning(_DEPRECATION_MESSAGE)
        logger.warning(
            ".get_spans() is a defunct method that does nothing. It will be removed in the future."
        )
        return iter(())


class _DefunctModule:
    __all__ = ("Tracer", "SpanExporter")

    def __getattr__(self, name: str) -> Any:
        if name == "Tracer":
            logger.warning(_DEPRECATION_MESSAGE)
            return Tracer
        if name == "SpanExporter":
            return SpanExporter
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _DefunctModule()  # type: ignore
