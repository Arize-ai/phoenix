from __future__ import annotations

import sys

from ._registry import SCENARIOS, Scenario
from .generate_all import main as all_main

COMMANDS: dict[str, tuple[str, Scenario]] = {
    **SCENARIOS,
    "all": ("run every scenario into its own project", all_main),
}


def _print_help() -> None:
    print("Generate synthetic OpenInference traces for Phoenix.")
    print()
    print("usage: python -m scripts.generate_spans <scenario> [options]")
    print()
    print("scenarios:")
    for command, (description, _) in COMMANDS.items():
        print(f"  {command:<15} {description}")
    print()
    print("Run '<scenario> --help' for scenario-specific parameters.")


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] in {"-h", "--help"}:
        _print_help()
        return 0
    command = args.pop(0)
    if command not in COMMANDS:
        choices = ", ".join(COMMANDS)
        print(f"unknown scenario {command!r}; choose one of: {choices}", file=sys.stderr)
        return 2
    try:
        return COMMANDS[command][1](args)
    except ConnectionError as error:
        # An unreachable endpoint is a setup mistake, not a bug worth a traceback.
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
