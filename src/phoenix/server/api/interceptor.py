import math
from abc import ABC, abstractmethod
from typing import Any

import numpy as np


class Interceptor(ABC):
    """an abstract class making use of the descriptor protocol
    see https://docs.python.org/3/howto/descriptor.html"""

    private_name: str

    def __set_name__(self, owner: Any, name: str) -> None:
        self.private_name = "_" + name

    def __get__(self, instance: Any, owner: Any) -> Any:
        return self if instance is None else getattr(instance, self.private_name)

    @abstractmethod
    def __set__(self, instance: Any, value: Any) -> None:
        ...


class NoneIfNan(Interceptor):
    """descriptor that converts NaN and Inf to None because NaN can't be
    serialized to JSON by the graphql object"""

    def __set__(self, instance: Any, value: Any) -> None:
        object.__setattr__(
            instance,
            self.private_name,
            None
            if value is self or isinstance(value, (float, np.floating)) and not math.isfinite(value)
            else value,
        )
