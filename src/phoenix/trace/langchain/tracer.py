"""
This module is defunct and will be removed in the future. It's currently
maintaining a dummy class to avoid breaking any import code.
"""

import logging
import sys
from typing import Any, Iterator

from phoenix.trace.schemas import Span

logger = logging.getLogger(__name__)

_DUMMY = "OpenInferenceTracer"
_DEPRECATION_MESSAGE = (
    f"`{__name__}.{_DUMMY}` is a defunct class in the current version of Phoenix, "
    "and will be removed in the future. For a migration guide, see "
    "https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
)


class _DummyObject:
    def __init__(self, *_: Any, **__: Any) -> None:
        logger.warning(_DEPRECATION_MESSAGE)

    def get_spans(self) -> Iterator[Span]:
        logger.warning(_DEPRECATION_MESSAGE)
        logger.warning(
            "`.get_spans()` is a defunct method that does nothing, and will be removed "
            "in the future. For a migration guide, see "
            "https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md"
        )
        return iter(())


class _DefunctModule:
    __all__ = (_DUMMY,)

    def __getattr__(self, name: str) -> Any:
        if name == _DUMMY:
            logger.warning(_DEPRECATION_MESSAGE)
            return _DummyObject
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _DefunctModule()  # type: ignore
