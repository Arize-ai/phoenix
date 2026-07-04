from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from evals.pxi.experiments.context_pruning.cost_model import summarize_outputs


def _task_outputs(experiment: dict[str, Any]) -> list[dict[str, Any]]:
    outputs: list[dict[str, Any]] = []
    for task_run in experiment.get("task_runs", []):
        if not isinstance(task_run, dict):
            continue
        output = task_run.get("output")
        if isinstance(output, dict):
            outputs.append(output)
    return outputs


def analyze(path: Path) -> dict[str, Any]:
    experiment = json.loads(path.read_text())
    outputs = _task_outputs(experiment)
    return summarize_outputs(outputs)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarize context-pruning PXI experiment JSON.")
    parser.add_argument("experiment_json", type=Path)
    args = parser.parse_args(argv)
    print(json.dumps(analyze(args.experiment_json), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
