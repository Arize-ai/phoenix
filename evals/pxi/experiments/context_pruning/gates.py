from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from evals.pxi.experiments.context_pruning.run_matrix import MatrixCell, command_for_cell

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "context-pruning"
GATES_DIR = ARTIFACT_DIR / "gates"


@dataclass(frozen=True)
class GateSpec:
    name: str
    dataset: str
    min_pass_rate: float | None = None
    max_pass_rate: float | None = None
    rationale: str = ""

    def evaluate(self, pass_rate: float | None) -> str:
        if pass_rate is None:
            return "not_run"
        if self.min_pass_rate is not None and pass_rate < self.min_pass_rate:
            return "fail"
        if self.max_pass_rate is not None and pass_rate > self.max_pass_rate:
            return "fail"
        return "pass"


GATE_SPECS = (
    GateSpec(
        name="type_a_zero",
        dataset="context_pruning_gate_type_a_zero",
        min_pass_rate=0.80,
        rationale="History-independent Type A tasks should pass without context.",
    ),
    GateSpec(
        name="type_b_zero",
        dataset="context_pruning_gate_type_b_zero",
        max_pass_rate=0.20,
        rationale="History-dependent Type B tasks should fail without the recalled needle.",
    ),
    GateSpec(
        name="type_b_5k",
        dataset="context_pruning_gate_type_b_5k",
        min_pass_rate=0.80,
        rationale="History-dependent Type B tasks should pass when the 5K prefix is present.",
    ),
)


def gate_commands(
    *,
    policies: Iterable[str] = ("p0",),
    repetitions: int = 1,
    concurrency: int = 1,
    name_prefix: str = "context-pruning-gate",
    report_dir: Path | None = None,
) -> list[list[str]]:
    commands: list[list[str]] = []
    for spec in GATE_SPECS:
        for policy in policies:
            cell = MatrixCell(
                dataset=spec.dataset,
                split="dev",
                policy=policy,
                repetitions=repetitions,
                concurrency=concurrency,
                experiment_name=f"{name_prefix}-{spec.name}-{policy}",
            )
            commands.append(command_for_cell(cell, report_dir=report_dir))
    return commands


def _pass_rate_from_report(payload: dict[str, Any]) -> tuple[int, int, float] | None:
    examples_run = payload.get("examples_run")
    examples_passed = payload.get("examples_passed")
    if not isinstance(examples_run, int) or not isinstance(examples_passed, int):
        return None
    if examples_run <= 0:
        return None
    return examples_passed, examples_run, examples_passed / examples_run


def _pass_rate_from_experiment(payload: dict[str, Any]) -> tuple[int, int, float] | None:
    task_runs = payload.get("task_runs")
    if not isinstance(task_runs, list) or not task_runs:
        return None
    failing_run_ids: set[str] = set()
    for task_run in task_runs:
        if not isinstance(task_run, dict):
            continue
        output = task_run.get("output")
        if task_run.get("error") or (isinstance(output, dict) and output.get("error")):
            failing_run_ids.add(str(task_run.get("id", "")))
    for evaluation_run in payload.get("evaluation_runs") or []:
        result: Any
        if isinstance(evaluation_run, dict):
            run_id = evaluation_run.get("experiment_run_id")
            result = evaluation_run.get("result")
            error = evaluation_run.get("error")
        else:
            run_id = getattr(evaluation_run, "experiment_run_id", None)
            result = getattr(evaluation_run, "result", None)
            error = getattr(evaluation_run, "error", None)
        score = result.get("score") if isinstance(result, dict) else None
        if error is not None or not isinstance(score, (int, float)) or float(score) < 1.0:
            failing_run_ids.add(str(run_id))
    total = len(task_runs)
    passed = total - len(failing_run_ids)
    return passed, total, passed / total


def pass_rate_from_json(path: Path) -> tuple[int, int, float] | None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        return None
    return _pass_rate_from_report(payload) or _pass_rate_from_experiment(payload)


def summarize_gates(report_dir: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for spec in GATE_SPECS:
        report_path = report_dir / f"{spec.dataset}.report.json"
        result = pass_rate_from_json(report_path) if report_path.exists() else None
        if result is None:
            passed = total = None
            pass_rate = None
        else:
            passed, total, pass_rate = result
        rows.append(
            {
                "gate": spec.name,
                "dataset": spec.dataset,
                "passed": passed,
                "total": total,
                "pass_rate": pass_rate,
                "status": spec.evaluate(pass_rate),
                "criterion": _criterion(spec),
                "rationale": spec.rationale,
            }
        )
    return rows


def _criterion(spec: GateSpec) -> str:
    if spec.min_pass_rate is not None:
        return f">= {spec.min_pass_rate:.0%}"
    if spec.max_pass_rate is not None:
        return f"<= {spec.max_pass_rate:.0%}"
    return "record only"


def write_gate_report(rows: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Context Pruning Admission Gates",
        "",
        "| Gate | Dataset | Result | Pass rate | Criterion |",
        "|---|---|---:|---:|---|",
    ]
    for row in rows:
        if row["pass_rate"] is None:
            pass_rate = "not run"
            result = "not_run"
        else:
            pass_rate = f"{row['passed']}/{row['total']} ({row['pass_rate']:.0%})"
            result = str(row["status"])
        lines.append(
            f"| {row['gate']} | `{row['dataset']}` | {result} | {pass_rate} | {row['criterion']} |"
        )
    lines.extend(["", "## Rationale", ""])
    lines.extend(f"- `{row['gate']}`: {row['rationale']}" for row in rows)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build or summarize context-pruning gates.")
    parser.add_argument("--report-dir", type=Path, default=GATES_DIR / "reports")
    parser.add_argument("--output", type=Path, default=GATES_DIR / "REPORT.md")
    parser.add_argument("--commands", action="store_true")
    parser.add_argument("--policies", default="p0")
    args = parser.parse_args(argv)
    if args.commands:
        policies = tuple(policy.strip() for policy in args.policies.split(",") if policy.strip())
        for command in gate_commands(policies=policies, report_dir=args.report_dir):
            print(" ".join(command))
        return 0
    rows = summarize_gates(args.report_dir)
    write_gate_report(rows, args.output)
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
