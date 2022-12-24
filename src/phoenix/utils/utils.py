import os
from os import path
from typing import Union

FilePath = Union[str, os.PathLike[str]]


def is_url(filepath: FilePath) -> bool:
    url_prefixes = ["http://", "https://"]
    return any([str(filepath).startswith(prefix) for prefix in url_prefixes])


def parse_file_format(filepath: FilePath) -> str:
    return path.splitext(filepath)[-1]


def parse_filename(filepath: FilePath) -> str:
    return path.basename(filepath)
