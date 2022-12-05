from os import path
from typing import Any, Sequence, TypeGuard, TypeVar

T = TypeVar("T", bound=type[Any])


def is_list_of(lst: Sequence[object], tp: T) -> TypeGuard[list[T]]:
    return isinstance(lst, list) and all(isinstance(x, tp) for x in lst)


def is_url(filepath: str) -> bool:
    url_prefixes = ["http://", "https://"]
    return any([filepath.startswith(prefix) for prefix in url_prefixes])


def parse_file_format(filepath: str) -> str:
    return path.splitext(filepath)[-1]


def parse_filename(filepath: str) -> str:
    return path.basename(filepath)
