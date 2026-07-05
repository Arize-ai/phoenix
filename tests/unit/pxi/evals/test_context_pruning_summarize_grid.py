from __future__ import annotations

import json
from pathlib import Path

from evals.pxi.experiments.context_pruning.summarize_grid import (
    summarize_report_dir,
    write_markdown,
)


def _write_report(
    report_dir: Path,
    *,
    dataset: str,
    experiment_name: str,
    passed: int,
    total: int,
) -> None:
    (report_dir / f"{dataset}.report.json").write_text(
        json.dumps(
            {
                "dataset_name": dataset,
                "experiment_name": experiment_name,
                "examples_passed": passed,
                "examples_run": total,
                "evaluator_summary": [
                    {
                        "name": "tool_call_args_match",
                        "passing": passed,
                        "total": total,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )


def test_summarize_report_dir_extracts_cells(tmp_path: Path) -> None:
    p0_dir = tmp_path / "context-pruning-main-context_pruning_type_a_5k-p0"
    p2_dir = tmp_path / "context-pruning-main-context_pruning_type_b_150k-p2"
    p0_dir.mkdir()
    p2_dir.mkdir()
    _write_report(
        p0_dir,
        dataset="context_pruning_type_a_5k",
        experiment_name="context-pruning-main-context_pruning_type_a_5k-p0",
        passed=39,
        total=40,
    )
    _write_report(
        p2_dir,
        dataset="context_pruning_type_b_150k",
        experiment_name="context-pruning-main-context_pruning_type_b_150k-p2",
        passed=34,
        total=36,
    )

    summary = summarize_report_dir(tmp_path)

    assert summary["cell_count"] == 2
    assert summary["cells"][0]["task_type"] == "type_a"
    assert summary["cells"][0]["depth"] == "5k"
    assert summary["cells"][0]["policy"] == "p0"
    assert summary["cells"][0]["pass_rate"] == 39 / 40
    assert summary["cells"][1]["task_type"] == "type_b"
    assert summary["cells"][1]["depth"] == "150k"
    assert summary["cells"][1]["policy"] == "p2"


def test_summarize_report_dir_prefers_nested_reports_for_duplicate_cells(
    tmp_path: Path,
) -> None:
    nested_dir = tmp_path / "context-pruning-main-context_pruning_type_a_5k-p0"
    nested_dir.mkdir()
    _write_report(
        tmp_path,
        dataset="context_pruning_type_a_5k",
        experiment_name="context-pruning-main-context_pruning_type_a_5k-p0",
        passed=1,
        total=40,
    )
    _write_report(
        nested_dir,
        dataset="context_pruning_type_a_5k",
        experiment_name="context-pruning-main-context_pruning_type_a_5k-p0",
        passed=39,
        total=40,
    )

    summary = summarize_report_dir(tmp_path)

    assert summary["cell_count"] == 1
    assert summary["cells"][0]["examples_passed"] == 39


def test_write_markdown_renders_summary(tmp_path: Path) -> None:
    summary = {
        "cell_count": 1,
        "cells": [
            {
                "dataset": "context_pruning_type_a_5k",
                "task_type": "type_a",
                "depth": "5k",
                "policy": "p0",
                "examples_passed": 39,
                "examples_run": 40,
                "pass_rate": 39 / 40,
                "evaluators": [{"name": "correct_tools_called", "passing": 39, "total": 40}],
            }
        ],
    }

    output = tmp_path / "REPORT.md"
    write_markdown(summary, output)

    text = output.read_text(encoding="utf-8")
    assert "Cells summarized: `1`" in text
    assert "| type_a | 5k | p0 | 39/40 | 98% |" in text
    assert "| correct_tools_called | 39 | 40 | 98% |" in text
