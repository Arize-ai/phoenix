import math
from abc import ABC, abstractmethod
from typing import Any

import numpy as np


class Interceptor(ABC):
    """an abstract class making use of the descriptor protocol
    see https://docs.python.org/3/howto/descriptor.html"""

    _name: str

    def __set_name__(self, _: Any, name: str) -> None:
        self._name = "_" + name

    def __get__(self, obj: Any, _: Any = None) -> Any:
        return self if obj is None else getattr(obj, self._name)

    @abstractmethod
    def __set__(self, obj: Any, value: Any) -> None: ...


class GqlValueMediator(Interceptor):
    """Converts values for compatibility with GraphQL, such as converting
    NaN and Inf to None (as NaN can't be serialized to JSON) and converting
    numpy scalars to Python primitives."""

    def __set__(self, obj: Any, value: Any) -> None:
        if value is self:
            value = None
        elif isinstance(value, (float, np.number)):
            if not math.isfinite(value):
                value = None
            elif isinstance(value, np.inexact):
                value = float(value)
            elif isinstance(value, np.integer):
                value = int(value)
        elif isinstance(value, np.bool_):
            value = bool(value)
        object.__setattr__(obj, self._name, value)
