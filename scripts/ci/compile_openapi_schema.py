import json
from argparse import ArgumentParser

from phoenix.server.api.openapi.schema import get_openapi_schema

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        required=True,
        help="Path to the output file (e.g., openapi.json)",
    )
    args = parser.parse_args()
    with open(args.output, "w") as f:
        json.dump(get_openapi_schema(), f, indent=2)
