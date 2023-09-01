from typing import Sequence

from typing_extensions import TypeVar

T = TypeVar("T", bound=type)


def is_list_of(lst: Sequence[object], tp: T) -> bool:
    return isinstance(lst, list) and all(isinstance(x, tp) for x in lst)
