from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class Instrumentor(ABC):
    """
    An abstract class for instrumentors for LLM frameworks
    """

    @abstractmethod
    def instrument(self) -> None:
        """
        Instrument the code with the inference code
        """
        pass

    @staticmethod
    def _raise_import_error(package_display_name: str, package_name: str) -> None:
        raise ImportError(
            f"Could not import necessary dependencies to use {package_display_name}. "
            "Please install them with"
            f"`pip install {package_name}`."
        )
