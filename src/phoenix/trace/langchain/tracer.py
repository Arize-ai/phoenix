"""
This module is deprecated and will be removed in the future. It's currently
maintaining a dummy class to avoid breaking any import code.
"""
import logging
import sys
from typing import Any, Iterator

from phoenix.trace.schemas import Span

logger = logging.getLogger(__name__)

_DEPRECATION_MESSAGE = (
    "DEPRECATED: `OpenInferenceTracer` is a dummy class in the current version of Phoenix. "
    "It no longer has any purpose or functionality and will be removed in the future."
)


class OpenInferenceTracer:
    def __init__(self, *_: Any, **__: Any) -> None:
        logger.warning(_DEPRECATION_MESSAGE)

    def get_spans(self) -> Iterator[Span]:
        logger.warning(_DEPRECATION_MESSAGE)
        logger.warning(
            ".get_spans() is a dummy function that does nothing. It will be removed in the future."
        )
        return iter(())


class Deprecation:
    def __getattr__(self, name: str) -> Any:
        if name == "OpenInferenceTracer":
            logger.warning(_DEPRECATION_MESSAGE)
            return OpenInferenceTracer
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = Deprecation()  # type: ignore
