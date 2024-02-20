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
    "`phoenix.trace.tracer.Tracer` is defunct in the current version of Phoenix, "
    "and will be removed in the future. For a migration guide, see "
    "https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
)

_USE_ENV_MSG = """
Setting the Phoenix endpoint via HttpExporter() is no longer supported.
Please use environment variables instead:
  - os.environ["PHOENIX_HOST"] = "127.0.0.1"
  - os.environ["PHOENIX_PORT"] = "54321"
  - os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://127.0.0.1:54321
For a migration guide, see https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md
"""

_ON_APPEND_DEPRECATION_MSG = (
    "OpenInference has been updated for full OpenTelemetry compliance. The ability to set "
    "`on_append` callbacks are removed. For a migration guide, see "
    "https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
)


def _show_deprecation_warnings(obj: object, *args: Any, **kwargs: Any) -> None:
    if args or kwargs:
        logger.warning(
            f"{obj.__class__.__name__}() no longer takes any arguments. "
            "The arguments provided has been ignored. For a migration guide, "
            "see https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
        )
        if any(callable(arg) for arg in args) or "callback" in kwargs:
            logger.warning(
                "The `callback` argument is defunct and no longer has any effect. "
                "If you need access to spans for processing, some options include "
                "exporting spans from Phoenix or adding a SpanProcessor to the "
                "OpenTelemetry TracerProvider. For a migration guide, "
                "see https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
            )
        if any(isinstance(arg, HttpExporter) for arg in args):
            logger.warning(_USE_ENV_MSG)


class Tracer:
    _exporter: Any

    def __init__(self, exporter: Any = None, on_append: Any = None) -> None:
        logger.warning(_DEFUNCT_MSG)
        if exporter is not None:
            logger.warning(_USE_ENV_MSG)
        if on_append is not None:
            logger.warning(_ON_APPEND_DEPRECATION_MSG)

    def create_span(self, *_: Any, **__: Any) -> Any:
        logger.warning(_DEFUNCT_MSG)

    def get_spans(self) -> Iterator[Any]:
        logger.warning(_DEFUNCT_MSG)
        logger.warning(
            ".get_spans() is a defunct method that does nothing. "
            "It will be removed in the future. For a migration guide, "
            "see https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
        )
        return iter(())


class _DefunctModule:
    __all__ = ("Tracer", "SpanExporter")

    def __getattr__(self, name: str) -> Any:
        if name == "Tracer":
            logger.warning(_DEFUNCT_MSG)
            return Tracer
        if name == "SpanExporter":
            logger.warning("`SpanExporter` is defunct and will be removed in the future.")
            return SpanExporter
        if name == "_show_deprecation_warnings":
            return _show_deprecation_warnings
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _DefunctModule()  # type: ignore
