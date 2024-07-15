import json
from argparse import ArgumentParser
from enum import Enum
from typing import Optional, Tuple

from .schema import get_openapi_schema


class Format(Enum):
    READABLE = "readable"
    COMPRESSED = "compressed"


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--format",
        type=Format,
        choices=[Format.READABLE, Format.COMPRESSED],
        required=True,
        help='The format of the OpenAPI schema ("readable" or "compressed").',
    )
    args = parser.parse_args()

    indent: Optional[int] = None
    separator: Optional[Tuple[str, str]] = None
    format = args.format
    if format is Format.READABLE:
        indent = 2
    else:
        separator = (",", ":")
    print(json.dumps(get_openapi_schema(), indent=indent, separators=separator))
