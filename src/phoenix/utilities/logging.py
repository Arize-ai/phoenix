# A collection of printing and logging utilities

from typing import Any

from tqdm.auto import tqdm


def printif(condition: bool, *args: Any, **kwargs: Any) -> None:
    if condition:
        tqdm.write(*args, **kwargs)


def log_a_list(list_of_str: list[str], join_word: str) -> str:
    if list_of_str is None or len(list_of_str) == 0:
        return ""
    if len(list_of_str) == 1:
        return list_of_str[0]
    return f"{', '.join(map(str, list_of_str[:-1]))} {join_word} {list_of_str[-1]}"
