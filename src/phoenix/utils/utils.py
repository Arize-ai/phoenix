#                    Copyright 2023 Arize AI and contributors.
#                     Licensed under the Elastic License 2.0;
#   you may not use this file except in compliance with the Elastic License 2.0.

from os import path
from pathlib import Path
from typing import Union

FilePath = Union[str, Path]


def is_url(filepath: str) -> bool:
    url_prefixes = ["http://", "https://"]
    return any([filepath.startswith(prefix) for prefix in url_prefixes])


def parse_file_format(filepath: FilePath) -> str:
    return path.splitext(filepath)[-1]


def parse_filename(filepath: FilePath) -> str:
    return path.basename(filepath)
