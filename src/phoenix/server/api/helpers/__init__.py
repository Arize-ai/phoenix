from collections.abc import Iterable
from typing import Optional, TypeVar

T = TypeVar("T")


def ensure_list(obj: Optional[Iterable[T]]) -> list[T]:
    if isinstance(obj, list):
        return obj
    if isinstance(obj, Iterable):
        return list(obj)
    return []
