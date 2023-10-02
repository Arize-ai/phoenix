import importlib
from types import ModuleType
from typing import TYPE_CHECKING, Any, Callable, Optional

from ..tracer import Tracer

if TYPE_CHECKING:
    from openai.openai_object import OpenAIObject


class OpenAIInstrumentor:
    def __init__(self, tracer: Optional[Tracer] = None) -> None:
        self._tracer = tracer or Tracer()
        self._openai = _import_package("openai")

    def instrument(self) -> None:
        self._openai.ChatCompletion.create = _wrap_chat_completion_create(
            self._openai.ChatCompletion.create, self._tracer
        )


def _wrap_chat_completion_create(
    create: Callable[..., "OpenAIObject"], tracer: Tracer
) -> Callable[..., "OpenAIObject"]:
    def wrapped(*args: Any, **kwargs: Any) -> "OpenAIObject":
        print("hello world")
        return create(*args, **kwargs)

    return wrapped


def _import_package(package_name: str, pypi_name: Optional[str] = None) -> ModuleType:
    """
    Dynamically imports a package.

    Args:
        package_name (str): Name of the package to import.

        pypi_name (Optional[str], optional): Name of the package on PyPI, if different from the
        package name.

    Returns:
        ModuleType: The imported package.
    """
    try:
        return importlib.import_module(package_name)
    except ImportError:
        raise ImportError(
            f"The {package_name} package is not installed. "
            f"Install with `pip install {pypi_name or package_name}`."
        )
