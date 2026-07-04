from __future__ import annotations

import argparse
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

DEFAULT_POLICIES = ("p0", "p1", "p2", "p3", "p4", "p1c", "p6")


@dataclass(frozen=True)
class MatrixCell:
    dataset: str
    split: str
    policy: str
    repetitions: int
    concurrency: int
    experiment_name: str


def build_cells(
    *,
    dataset: str,
    split: str,
    policies: tuple[str, ...],
    repetitions: int,
    concurrency: int,
    name_prefix: str,
) -> list[MatrixCell]:
    return [
        MatrixCell(
            dataset=dataset,
            split=split,
            policy=policy,
            repetitions=repetitions,
            concurrency=concurrency,
            experiment_name=f"{name_prefix}-{dataset}-{policy}",
        )
        for policy in policies
    ]


def command_for_cell(cell: MatrixCell, *, report_dir: Path | None = None) -> list[str]:
    command = [
        "uv",
        "run",
        "python",
        "-m",
        "evals.pxi.harness.run_experiment",
        "--dataset",
        cell.dataset,
        "--splits",
        cell.split,
        "--concurrency",
        str(cell.concurrency),
        "--repetitions",
        str(cell.repetitions),
        "--experiment-name",
        cell.experiment_name,
    ]
    if cell.policy != "p0":
        command.extend(["--policy", cell.policy])
    if report_dir is not None:
        command.extend(["--report-dir", str(report_dir)])
    return command


def run_cells(
    cells: list[MatrixCell],
    *,
    base_url: str,
    provider: str,
    model: str,
    report_dir: Path | None = None,
    dry_run: bool = False,
) -> int:
    env = os.environ.copy()
    env["PHOENIX_COLLECTOR_ENDPOINT"] = base_url
    env["PHOENIX_AGENTS_ASSISTANT_PROVIDER"] = provider
    env["PHOENIX_AGENTS_ASSISTANT_MODEL"] = model
    for cell in cells:
        command = command_for_cell(cell, report_dir=report_dir)
        print(" ".join(command))
        if dry_run:
            continue
        completed = subprocess.run(command, env=env, check=False)
        if completed.returncode != 0:
            return completed.returncode
    return 0


def _split_csv(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(",") if item.strip())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a context-pruning PXI experiment matrix.")
    parser.add_argument("--dataset", default="context_pruning_pilot")
    parser.add_argument("--split", default="dev")
    parser.add_argument("--policies", default=",".join(DEFAULT_POLICIES))
    parser.add_argument("--repetitions", type=int, default=5)
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--name-prefix", default="context-pruning")
    parser.add_argument("--base-url", default="http://localhost:6006")
    parser.add_argument("--provider", default="ANTHROPIC")
    parser.add_argument("--model", default="claude-opus-4-6")
    parser.add_argument("--report-dir", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if args.repetitions < 1:
        raise SystemExit("--repetitions must be >= 1")
    if args.concurrency < 1:
        raise SystemExit("--concurrency must be >= 1")
    policies = _split_csv(args.policies)
    cells = build_cells(
        dataset=args.dataset,
        split=args.split,
        policies=policies,
        repetitions=args.repetitions,
        concurrency=args.concurrency,
        name_prefix=args.name_prefix,
    )
    return run_cells(
        cells,
        base_url=args.base_url,
        provider=args.provider,
        model=args.model,
        report_dir=args.report_dir,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    raise SystemExit(main())
