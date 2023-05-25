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


class ValueMediatorForGql(Interceptor):
    """Converts values for compatibility with GraphQL, such as converting
    NaN and Inf to None (as NaN can't be serialized to JSON) and converting
    numpy.number to Python primitives."""

    def __set__(self, instance: Any, value: Any) -> None:
        if value is self:
            value = None
        elif isinstance(value, (float, np.number)):
            if not math.isfinite(value):
                value = None
            elif isinstance(value, np.inexact):
                value = float(value)
            elif isinstance(value, np.integer):
                value = int(value)
        object.__setattr__(instance, self.private_name, value)
