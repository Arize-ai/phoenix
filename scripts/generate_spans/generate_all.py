"""Run every scenario in one command, to bring a local Phoenix up to a realistic state.

Each scenario keeps its own default project name, so the result is a workspace with a project
per data shape rather than one project containing everything. Scenario-specific parameters are
not exposed here — run a scenario directly when you need to tune it.
"""

from __future__ import annotations

import argparse

try:
    from ._registry import SCENARIOS
    from ._shared import DEFAULT_ENDPOINT
except ImportError:  # Support direct execution from this directory.
    from _registry import SCENARIOS  # type: ignore[no-redef]
    from _shared import DEFAULT_ENDPOINT  # type: ignore[no-redef]


def _scenario_list(value: str) -> list[str]:
    names = [name.strip() for name in value.split(",") if name.strip()]
    unknown = [name for name in names if name not in SCENARIOS]
    if unknown:
        raise argparse.ArgumentTypeError(
            f"unknown scenario(s): {', '.join(unknown)}; choose from: {', '.join(SCENARIOS)}"
        )
    return names


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run every scenario with its defaults, each into its own project."
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Phoenix base URL or OTLP trace endpoint (default: {DEFAULT_ENDPOINT}).",
    )
    # Not add_common_arguments: a single --project-name would collapse every shape into one
    # project, so it is accepted as a namespace prefix instead (`demo` -> `demo-rag`). The
    # flag still has to exist, because `make seed` passes it whenever PHOENIX_PROJECT is set.
    parser.add_argument(
        "--project-name",
        help="Prefix for every scenario's project (default: each scenario's own name).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Seed forwarded to every scenario (default: 42).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and validate every scenario without exporting.",
    )
    parser.add_argument(
        "--only",
        type=_scenario_list,
        help="Comma-separated subset to run (default: all).",
    )
    parser.add_argument(
        "--exclude",
        type=_scenario_list,
        default=[],
        help="Comma-separated scenarios to skip.",
    )
    parser.add_argument(
        "--keep-going",
        action="store_true",
        help="Continue after a scenario fails, and report the failures at the end.",
    )
    return parser


def generate(args: argparse.Namespace) -> dict[str, int]:
    """Run the selected scenarios and return each one's exit code."""
    selected = [name for name in (args.only or SCENARIOS) if name not in set(args.exclude or ())]
    forwarded = ["--endpoint", args.endpoint, "--seed", str(args.seed)]
    if args.dry_run:
        forwarded.append("--dry-run")

    results: dict[str, int] = {}
    for name in selected:
        print(f"=== {name} ===")
        scenario_args = list(forwarded)
        if args.project_name:
            scenario_args += ["--project-name", f"{args.project_name}-{name}"]
        try:
            results[name] = SCENARIOS[name][1](scenario_args)
        except Exception as error:  # noqa: BLE001 - one bad scenario should not hide the rest
            print(f"error={type(error).__name__}: {error}")
            results[name] = 1
        if results[name] and not args.keep_going:
            break
        print()
    return results


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    results = generate(args)
    failed = [name for name, code in results.items() if code]
    print("=== summary ===")
    print(f"scenarios_run={len(results)}")
    print(f"scenarios_failed={len(failed)}")
    if failed:
        print(f"failed={','.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
