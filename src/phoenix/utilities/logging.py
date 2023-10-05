# A collection of printing and logging utilities

from typing import Any


def printif(condition: bool, *args: Any, **kwargs: Any) -> None:
    if condition:
        print(*args, **kwargs)
