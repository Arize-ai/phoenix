# A collection of printing and logging utilities

from typing import Any

from tqdm.auto import tqdm


def printif(condition: bool, *args: Any, **kwargs: Any) -> None:
    if condition:
        tqdm.write(*args, **kwargs)
