import functools
import warnings
from typing import Any, Callable, Type, TypeVar

GenericClass = TypeVar("GenericClass", bound=Type[Any])
CallableType = TypeVar("CallableType", bound=Callable[..., Any])


def deprecated_class(message: str) -> Callable[[GenericClass], GenericClass]:
    def decorator(original_class: GenericClass) -> GenericClass:
        @functools.wraps(original_class)
        def new_class(*args: Any, **kwargs: Any) -> Any:
            warnings.warn(message, DeprecationWarning, stacklevel=2)
            return original_class(*args, **kwargs)

        return new_class  # type: ignore

    return decorator


def deprecated(message: str) -> Callable[[CallableType], CallableType]:
    def decorator(original_func: CallableType) -> CallableType:
        @functools.wraps(original_func)
        def new_func(*args: Any, **kwargs: Any) -> Any:
            warnings.warn(message, DeprecationWarning, stacklevel=2)
            return original_func(*args, **kwargs)

        return new_func  # type: ignore

    return decorator
