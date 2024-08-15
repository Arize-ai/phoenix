import json
from argparse import ArgumentParser
from typing import Optional, Tuple

from .schema import get_openapi_schema

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--compress",
        action="store_true",
        help="Whether to output a compressed version of the OpenAPI schema",
    )
    args = parser.parse_args()

    indent: Optional[int] = None
    separator: Optional[Tuple[str, str]] = None
    if args.compress:
        separator = (",", ":")
    else:
        indent = 2
    print(json.dumps(get_openapi_schema(), indent=indent, separators=separator))
