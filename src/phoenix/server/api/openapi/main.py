import json
from argparse import ArgumentParser
from contextlib import ExitStack
from sys import stdout
from typing import Optional, Tuple

from .schema import get_openapi_schema

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--compress",
        action="store_true",
        help="Whether to output a compressed version of the OpenAPI schema",
    )
    parser.add_argument(
        "filename",
        type=str,
        help="The name of the file to save in the current working directory.",
    )
    args = parser.parse_args()

    indent: Optional[int] = None
    separator: Optional[Tuple[str, str]] = None
    if args.compress:
        separator = (",", ":")
    else:
        indent = 2
    with ExitStack() as stack:
        if filename := args.filename:
            f = stack.enter_context(open(filename, "w"))
        else:
            f = stdout
        json.dump(get_openapi_schema(), f, indent=indent, separators=separator)
