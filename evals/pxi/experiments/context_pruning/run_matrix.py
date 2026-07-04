from __future__ import annotations

import argparse
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from evals.pxi.experiments.context_pruning.corpus_builder import DEPTHS, depth_slug

DEFAULT_POLICIES = ("p0", "p1", "p2", "p3", "p4", "p1c", "p6")
FULL_SWEEP_POLICIES = ("p0", "p1", "p2")
SECONDARY_POLICIES = ("p1c", "p3", "p4", "p5", "p6")
SECONDARY_DEPTHS = (50_000, 150_000)
_EXPERIMENT_NAME_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_.-]+")


@dataclass(frozen=True)
class MatrixCell:
    dataset: str
    split: str
    policy: str
    repetitions: int
    concurrency: int
    experiment_name: str


def policy_experiment_slug(policy: str) -> str:
    slug = _EXPERIMENT_NAME_UNSAFE_CHARS.sub("-", policy).strip("-")
    return slug or "policy"


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
            experiment_name=f"{name_prefix}-{dataset}-{policy_experiment_slug(policy)}",
        )
        for policy in policies
    ]


def build_preregistered_quality_cells(
    *,
    task_types: tuple[str, ...] = ("type_a", "type_b"),
    repetitions: int = 5,
    concurrency: int = 1,
    name_prefix: str = "context-pruning-main",
    include_secondary: bool = True,
) -> list[MatrixCell]:
    cells: list[MatrixCell] = []
    for task_type in task_types:
        if task_type not in {"type_a", "type_b"}:
            raise ValueError(f"unknown task type {task_type!r}")
        for depth in DEPTHS:
            dataset = f"context_pruning_{task_type}_{depth_slug(depth)}"
            cells.extend(
                build_cells(
                    dataset=dataset,
                    split="dev",
                    policies=FULL_SWEEP_POLICIES,
                    repetitions=repetitions,
                    concurrency=concurrency,
                    name_prefix=name_prefix,
                )
            )
            if include_secondary and depth in SECONDARY_DEPTHS:
                cells.extend(
                    build_cells(
                        dataset=dataset,
                        split="dev",
                        policies=SECONDARY_POLICIES,
                        repetitions=repetitions,
                        concurrency=concurrency,
                        name_prefix=name_prefix,
                    )
                )
    return cells


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
        command.extend(["--report-dir", str(report_dir / cell.experiment_name)])
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
    separator = ";" if ";" in value else ","
    return tuple(item.strip() for item in value.split(separator) if item.strip())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a context-pruning PXI experiment matrix.")
    parser.add_argument("--dataset", default="context_pruning_pilot")
    parser.add_argument(
        "--preregistered-quality-grid",
        action="store_true",
        help="Run the preregistered Type A/B quality grid over depth-sliced datasets.",
    )
    parser.add_argument(
        "--task-types",
        default="type_a,type_b",
        help="Comma-separated task types for --preregistered-quality-grid.",
    )
    parser.add_argument(
        "--no-secondary",
        action="store_true",
        help="Omit secondary P1c/P3/P4/P5/P6 cells from --preregistered-quality-grid.",
    )
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
    if args.preregistered_quality_grid:
        cells = build_preregistered_quality_cells(
            task_types=_split_csv(args.task_types),
            repetitions=args.repetitions,
            concurrency=args.concurrency,
            name_prefix=args.name_prefix,
            include_secondary=not args.no_secondary,
        )
    else:
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
