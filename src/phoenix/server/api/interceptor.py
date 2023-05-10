import math
from abc import ABC, abstractmethod
from datetime import timezone
from typing import Any


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
        setattr(
            instance,
            self.private_name,
            None if isinstance(value, float) and not math.isfinite(value) else value,
        )


class EnsureUTC(Interceptor):
    def __set__(self, instance: Any, value: Any) -> None:
        setattr(
            instance,
            self.private_name,
            value.astimezone(timezone.utc),
        )
