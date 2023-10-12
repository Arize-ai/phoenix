import logging
from typing import Any, Callable, Iterable, Optional, Type

from typing_extensions import TypeVar, cast

G = TypeVar("G", bound=Callable[..., Any])
F = TypeVar("F", bound=Callable[..., Any])


def graceful_fallback(
    fallback_method: Callable[..., Any], exceptions: Optional[Iterable[Type[BaseException]]] = None
) -> Callable[[F], F]:
    exceptions = (BaseException,) if exceptions is None else tuple(exceptions)

    def decorator(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except exceptions as exc:
                logging.error(f"Exception in {func.__name__}: {exc}")
            return fallback_method(*args, **kwargs)

        return cast(F, wrapper)

    return decorator
