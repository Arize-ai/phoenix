from os import path
from pathlib import Path
from typing import Union

FilePath = Union[str, Path]


def is_url(filepath: FilePath) -> bool:
    url_prefixes = ["http://", "https://"]
    return any([str(filepath).startswith(prefix) for prefix in url_prefixes])


def parse_file_format(filepath: FilePath) -> str:
    return path.splitext(filepath)[-1]


def parse_filename(filepath: FilePath) -> str:
    return path.basename(filepath)
