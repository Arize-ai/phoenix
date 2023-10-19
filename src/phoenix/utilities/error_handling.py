import logging
import traceback
from typing import Any, Callable, Iterable, Optional, Type, TypeVar, cast

F = TypeVar("F", bound=Callable[..., Any])


def graceful_fallback(
    fallback_method: Callable[..., Any], exceptions: Optional[Iterable[Type[BaseException]]] = None
) -> Callable[[F], F]:
    """
    Decorator that reroutes failing functions to a specified fallback method.

    While it is generally not advisable to catch all exceptions, this decorator can be used to
    gracefully degrade a function in situations when raising an error might be too disruptive.
    Exceptions supprssed by this decorator will be logged to the root logger, and all inputs
    to the wrapped function will be passed to the fallback method.


    Args:

    fallback_method (Callable[..., Any]): The fallback method to be called when the wrapped
    function fails.

    exceptions: An optional iterable of exceptions that should be suppressed by this decorator. If
    unset, all exceptions will be suppressed.
    """

    exceptions = (BaseException,) if exceptions is None else tuple(exceptions)

    def decorator(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except exceptions as exc:
                msg = (
                    f"Exception occurred in function '{func.__name__}':\n"
                    f"-Args: {args}\n"
                    f"-Kwargs: {kwargs}\n"
                    f"-Exception type: {type(exc).__name__}\n"
                    f"-Exception message: {str(exc)}\n"
                    f"{'*' * 50}\n"
                    f"{traceback.format_exc()}\n"
                    f"{'*' * 50}\n"
                    f"Rerouting to fallback method '{fallback_method.__name__}'"
                )
                logging.error(msg)
            return fallback_method(*args, **kwargs)

        return cast(F, wrapper)

    return decorator
