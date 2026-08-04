from __future__ import annotations

import sys
from collections.abc import Callable

from .generate_axis_label_spans import main as axis_labels_main
from .generate_mixed_workload import main as mixed_main
from .generate_spans_deeply_nested import main as nested_main
from .generate_spans_for_cost_calculations import main as costs_main
from .generate_spans_for_large_session import main as large_session_main
from .generate_spans_for_time_series import main as time_series_main
from .generate_spans_with_event_attributes import main as events_main
from .generate_token_detail_spans import main as token_details_main

COMMANDS: dict[str, tuple[str, Callable[[list[str] | None], int]]] = {
    "axis-labels": ("long model names for chart labels", axis_labels_main),
    "mixed": ("bounded mixed-kind workload", mixed_main),
    "nested": ("one deeply nested trace", nested_main),
    "time-series": ("business-shaped historical traffic", time_series_main),
    "token-details": ("cache and multimodal token fixtures", token_details_main),
    "costs": ("cost-manifest model coverage", costs_main),
    "large-session": ("many turns in one session", large_session_main),
    "events": ("structured span events and exceptions", events_main),
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
    return COMMANDS[command][1](args)


if __name__ == "__main__":
    raise SystemExit(main())
