import logging
from typing import Any, Iterable, Optional, Type


def graceful_fallback(fallback_method, exceptions: Optional[Iterable[Type[BaseException]]] = None):
    exceptions = (BaseException,) if exceptions is None else exceptions

    def decorator(func):
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except exceptions as exc:
                logging.error(f"Exception in {func.__name__}: {exc}")
            return fallback_method(*args, **kwargs)

        return wrapper

    return decorator
