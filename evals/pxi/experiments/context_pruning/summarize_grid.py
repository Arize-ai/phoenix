from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

DATASET_RE = re.compile(r"^context_pruning_(type_[ab])_(\d+k)$")
EXPERIMENT_POLICY_RE = re.compile(r"-(p[0-9][A-Za-z0-9]*(?:-[A-Za-z0-9_.-]+)?)$")


def _policy_from_report(report: dict[str, Any]) -> str:
    experiment_name = str(report.get("experiment_name") or "")
    if match := EXPERIMENT_POLICY_RE.search(experiment_name):
        return match.group(1)
    return "unknown"


def _cell_from_report(path: Path) -> dict[str, Any]:
    report = json.loads(path.read_text(encoding="utf-8"))
    dataset = str(report["dataset_name"])
    match = DATASET_RE.match(dataset)
    if match is None:
        raise ValueError(f"{path} is not a context-pruning depth-sliced report")
    task_type, depth = match.groups()
    examples_run = int(report.get("examples_run", 0) or 0)
    examples_passed = int(report.get("examples_passed", 0) or 0)
    return {
        "dataset": dataset,
        "task_type": task_type,
        "depth": depth,
        "policy": _policy_from_report(report),
        "examples_run": examples_run,
        "examples_passed": examples_passed,
        "pass_rate": examples_passed / examples_run if examples_run else None,
        "evaluators": list(report.get("evaluator_summary") or []),
    }


def summarize_report_dir(report_dir: Path) -> dict[str, Any]:
    cells = [
        _cell_from_report(path)
        for path in sorted(report_dir.rglob("context_pruning_type_*.report.json"))
    ]
    return {"cells": cells, "cell_count": len(cells)}


def _format_rate(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.0%}"


def write_markdown(summary: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Context Pruning Main Grid Summary",
        "",
        f"Cells summarized: `{summary['cell_count']}`",
        "",
        "| Task | Depth | Policy | Examples | Pass rate |",
        "|---|---:|---|---:|---:|",
    ]
    for cell in summary["cells"]:
        lines.append(
            f"| {cell['task_type']} | {cell['depth']} | {cell['policy']} | "
            f"{cell['examples_passed']}/{cell['examples_run']} | {_format_rate(cell['pass_rate'])} |"
        )
    lines.extend(["", "## Evaluators", ""])
    for cell in summary["cells"]:
        lines.extend(
            [
                f"### {cell['dataset']} / {cell['policy']}",
                "",
                "| Evaluator | Passed | Total | Pass rate |",
                "|---|---:|---:|---:|",
            ]
        )
        for evaluator in cell["evaluators"]:
            total = int(evaluator.get("total", 0) or 0)
            passing = int(evaluator.get("passing", 0) or 0)
            rate = passing / total if total else None
            lines.append(
                f"| {evaluator.get('name', 'unknown')} | {passing} | {total} | "
                f"{_format_rate(rate)} |"
            )
        lines.append("")
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarize context-pruning main grid reports.")
    parser.add_argument("report_dir", type=Path)
    parser.add_argument("--json-output", type=Path)
    parser.add_argument("--markdown-output", type=Path)
    args = parser.parse_args(argv)
    summary = summarize_report_dir(args.report_dir)
    if args.json_output is not None:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    if args.markdown_output is not None:
        write_markdown(summary, args.markdown_output)
    if args.json_output is None and args.markdown_output is None:
        print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
