# mypy: ignore-errors
"""
Deterministic trajectory comparison: extracted vs ground truth.

Compares tool selection, parameter accuracy, ordering, and other
mechanical metrics without requiring an LLM judge.

Usage:
    # Compare from results files:
    python -m compare_trajectories --results results/scaled/tau_openai_*.json

    # Compare from extracted trajectory files:
    python -m compare_trajectories --trajectories results/scaled/trajectories_*.json

Metrics computed:
- Tool selection: set match (precision, recall, F1)
- Tool count: over-calling vs under-calling
- Parameter accuracy: per-tool kwarg matching
- Ordering: sequential order correctness (for tau-bench)
- Parallel detection: were parallel tools called in one turn? (for TRAJECT-Bench)
- Terminal state: how the conversation ended
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

_DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "results" / "scaled"


@dataclass
class ToolMatchResult:
    """Per-task tool matching results."""

    task_id: str
    # Tool selection
    expected_tools: list[str]
    actual_tools: list[str]
    matched_tools: list[str]
    missing_tools: list[str]
    extra_tools: list[str]
    precision: float  # |matched| / |actual|
    recall: float  # |matched| / |expected|
    f1: float
    exact_match: bool  # sets are identical
    # Counts
    expected_count: int
    actual_count: int
    count_diff: int  # actual - expected (positive = over-calling)
    # Parameter accuracy (for matched tools)
    param_matches: list[dict]  # per-tool param comparison
    param_accuracy: float  # fraction of matched tools with correct params
    # Ordering (tau-bench specific)
    order_correct: bool | None = None  # None if not applicable
    # Parallel detection (TRAJECT-Bench specific)
    parallel_expected: bool = False
    parallel_detected: bool = False
    # Terminal state
    terminated_by: str = ""
    # Overall
    status: str = ""  # "ok" or "error"
    error: str | None = None


@dataclass
class ComparisonSummary:
    """Aggregate comparison metrics across all tasks."""

    implementation: str
    total_tasks: int
    tasks_with_results: int
    exact_match_count: int
    exact_match_rate: float
    mean_precision: float
    mean_recall: float
    mean_f1: float
    mean_param_accuracy: float
    over_calling_count: int  # tasks where actual > expected
    under_calling_count: int  # tasks where actual < expected
    order_correct_count: int
    order_total: int
    per_task: list[ToolMatchResult] = field(default_factory=list)


def normalize_tool_name(name: str) -> str:
    """Normalize tool names for comparison.

    Handles TRAJECT-Bench's "Parent: API/name" -> "parent_api_name" format
    and tau-bench's snake_case names.
    """
    # Already snake_case (tau-bench)
    if "_" in name and ":" not in name:
        return name.lower()
    # TRAJECT-Bench: "Wayfair: reviews/list" -> "wayfair_reviews_list"
    normalized = name.lower()
    normalized = normalized.replace(": ", "_").replace("/", "_").replace(" ", "_").replace("-", "_")
    # Remove duplicate underscores
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def compare_params(expected_kwargs: dict, actual_args: dict) -> dict:
    """Compare expected vs actual parameters for a single tool call.

    Returns a dict with match details.
    """
    # Flatten expected kwargs (tau-bench uses flat dict)
    expected = {str(k): str(v) for k, v in expected_kwargs.items()}
    actual = {str(k): str(v) for k, v in actual_args.items()}

    matched = {}
    mismatched = {}
    missing = {}
    extra = {}

    for k, v in expected.items():
        if k in actual:
            if actual[k] == v:
                matched[k] = v
            else:
                mismatched[k] = {"expected": v, "actual": actual[k]}
        else:
            missing[k] = v

    for k, v in actual.items():
        if k not in expected:
            extra[k] = v

    total = len(expected)
    correct = len(matched)

    return {
        "matched": matched,
        "mismatched": mismatched,
        "missing": missing,
        "extra": extra,
        "accuracy": correct / total if total > 0 else 1.0,
    }


def compare_task_taubench(entry: dict) -> ToolMatchResult:
    """Compare a single tau-bench task result against ground truth."""
    task_id = entry.get("task_id", "unknown")

    if entry.get("status") == "error" and "tool_calls_made" not in entry:
        return ToolMatchResult(
            task_id=task_id,
            expected_tools=[],
            actual_tools=[],
            matched_tools=[],
            missing_tools=[],
            extra_tools=[],
            precision=0.0,
            recall=0.0,
            f1=0.0,
            exact_match=False,
            expected_count=0,
            actual_count=0,
            count_diff=0,
            param_matches=[],
            param_accuracy=0.0,
            status="error",
            error=entry.get("error", "unknown error"),
        )

    expected_actions = entry.get("expected_actions", [])
    tool_calls_made = entry.get("tool_calls_made", [])

    expected_names = [a["name"] for a in expected_actions]
    actual_names = [tc.get("name", "") for tc in tool_calls_made]

    expected_set = set(expected_names)
    actual_set = set(actual_names)

    matched = expected_set & actual_set
    missing = expected_set - actual_set
    extra = actual_set - expected_set

    precision = len(matched) / len(actual_set) if actual_set else 1.0
    recall = len(matched) / len(expected_set) if expected_set else 1.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    # Parameter comparison for matched tools
    param_matches = []
    param_correct = 0
    for exp_action in expected_actions:
        exp_name = exp_action["name"]
        exp_kwargs = exp_action.get("kwargs", {})
        # Find matching actual call
        for tc in tool_calls_made:
            if tc.get("name") == exp_name:
                actual_args = tc.get("args", tc.get("arguments", {}))
                result = compare_params(exp_kwargs, actual_args)
                result["tool_name"] = exp_name
                param_matches.append(result)
                if result["accuracy"] == 1.0:
                    param_correct += 1
                break

    param_accuracy = param_correct / len(expected_actions) if expected_actions else 1.0

    # Order check: are expected tools called in the right relative order?
    order_correct = None
    if len(expected_names) > 1 and len(actual_names) > 1:
        # Check if the relative order of expected tools is preserved in actual
        actual_positions = {}
        for i, name in enumerate(actual_names):
            if name not in actual_positions:
                actual_positions[name] = i

        ordered = True
        prev_pos = -1
        for name in expected_names:
            pos = actual_positions.get(name, -1)
            if pos == -1:
                continue  # Skip missing tools for order check
            if pos < prev_pos:
                ordered = False
                break
            prev_pos = pos
        order_correct = ordered

    return ToolMatchResult(
        task_id=task_id,
        expected_tools=expected_names,
        actual_tools=actual_names,
        matched_tools=sorted(matched),
        missing_tools=sorted(missing),
        extra_tools=sorted(extra),
        precision=precision,
        recall=recall,
        f1=f1,
        exact_match=expected_set == actual_set,
        expected_count=len(expected_names),
        actual_count=len(actual_names),
        count_diff=len(actual_names) - len(expected_names),
        param_matches=param_matches,
        param_accuracy=param_accuracy,
        order_correct=order_correct,
        terminated_by=entry.get("terminated_by", ""),
        status="ok",
    )


def compare_task_traject(entry: dict) -> ToolMatchResult:
    """Compare a single TRAJECT-Bench task result against ground truth."""
    task_id = entry.get("task_label", "unknown")

    if entry.get("status") == "error" and "tool_calls_made" not in entry:
        return ToolMatchResult(
            task_id=task_id,
            expected_tools=[],
            actual_tools=[],
            matched_tools=[],
            missing_tools=[],
            extra_tools=[],
            precision=0.0,
            recall=0.0,
            f1=0.0,
            exact_match=False,
            expected_count=0,
            actual_count=0,
            count_diff=0,
            param_matches=[],
            param_accuracy=0.0,
            status="error",
            error=entry.get("error", "unknown error"),
        )

    tool_calls_made = entry.get("tool_calls_made", [])
    tool_calls_expected = entry.get("tool_calls_expected", [])
    traj_type = entry.get("trajectory_type", "parallel")

    # Normalize names for comparison
    expected_names = [
        tc.get("func_name", tc.get("original_name", "")) for tc in tool_calls_expected
    ]
    actual_names = [tc.get("name", "") for tc in tool_calls_made]

    # Also normalize to handle name format differences
    expected_normalized = [normalize_tool_name(n) for n in expected_names]
    actual_normalized = [normalize_tool_name(n) for n in actual_names]

    expected_set = set(expected_normalized)
    actual_set = set(actual_normalized)

    matched = expected_set & actual_set
    missing = expected_set - actual_set
    extra = actual_set - expected_set

    precision = len(matched) / len(actual_set) if actual_set else 1.0
    recall = len(matched) / len(expected_set) if expected_set else 1.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    # Parameter comparison
    param_matches = []
    param_correct = 0
    for exp_tc in tool_calls_expected:
        exp_name = normalize_tool_name(exp_tc.get("func_name", exp_tc.get("original_name", "")))
        exp_params = exp_tc.get("required_parameters", {})
        if isinstance(exp_params, list):
            exp_params = {p["name"]: p["value"] for p in exp_params if "name" in p and "value" in p}
        # Find matching actual call
        for act_tc in tool_calls_made:
            act_name = normalize_tool_name(act_tc.get("name", ""))
            if act_name == exp_name:
                act_args = act_tc.get("args", {})
                if "parameters" in act_args and len(act_args) == 1:
                    act_args = act_args["parameters"]
                result = compare_params(exp_params, act_args)
                result["tool_name"] = exp_name
                param_matches.append(result)
                if result["accuracy"] == 1.0:
                    param_correct += 1
                break

    param_accuracy = param_correct / len(tool_calls_expected) if tool_calls_expected else 1.0

    # Parallel detection
    parallel_expected = traj_type == "parallel"
    # Check if tools were called in a single turn (parallel) - for results files,
    # we can't detect this without conversation data, so default to False
    parallel_detected = False

    # Order check for sequential tasks
    order_correct = None
    if traj_type == "sequential" and len(expected_normalized) > 1:
        actual_positions = {}
        for i, name in enumerate(actual_normalized):
            if name not in actual_positions:
                actual_positions[name] = i
        ordered = True
        prev_pos = -1
        for name in expected_normalized:
            pos = actual_positions.get(name, -1)
            if pos == -1:
                continue
            if pos < prev_pos:
                ordered = False
                break
            prev_pos = pos
        order_correct = ordered

    return ToolMatchResult(
        task_id=task_id,
        expected_tools=expected_names,
        actual_tools=actual_names,
        matched_tools=sorted(matched),
        missing_tools=sorted(missing),
        extra_tools=sorted(extra),
        precision=precision,
        recall=recall,
        f1=f1,
        exact_match=expected_set == actual_set,
        expected_count=len(expected_names),
        actual_count=len(actual_names),
        count_diff=len(actual_names) - len(expected_names),
        param_matches=param_matches,
        param_accuracy=param_accuracy,
        order_correct=order_correct,
        parallel_expected=parallel_expected,
        parallel_detected=parallel_detected,
        status=entry.get("status", "ok"),
        error=entry.get("error"),
    )


def compare_results_file(results_path: str) -> ComparisonSummary:
    """Compare all tasks in a results file."""
    with open(results_path) as f:
        data = json.load(f)

    impl = data.get("implementation", Path(results_path).stem)
    results = data.get("results", data) if isinstance(data, dict) else data

    # Detect benchmark type
    is_traject = any("task_label" in r for r in results)

    per_task = []
    for entry in results:
        if is_traject:
            result = compare_task_traject(entry)
        else:
            result = compare_task_taubench(entry)
        per_task.append(result)

    # Aggregate metrics
    valid = [t for t in per_task if t.status != "error"]
    n = len(valid)

    exact_match_count = sum(1 for t in valid if t.exact_match)
    mean_precision = sum(t.precision for t in valid) / n if n else 0.0
    mean_recall = sum(t.recall for t in valid) / n if n else 0.0
    mean_f1 = sum(t.f1 for t in valid) / n if n else 0.0
    mean_param_accuracy = sum(t.param_accuracy for t in valid) / n if n else 0.0
    over_calling = sum(1 for t in valid if t.count_diff > 0)
    under_calling = sum(1 for t in valid if t.count_diff < 0)

    order_tasks = [t for t in valid if t.order_correct is not None]
    order_correct_count = sum(1 for t in order_tasks if t.order_correct)

    return ComparisonSummary(
        implementation=impl,
        total_tasks=len(per_task),
        tasks_with_results=n,
        exact_match_count=exact_match_count,
        exact_match_rate=exact_match_count / n if n else 0.0,
        mean_precision=mean_precision,
        mean_recall=mean_recall,
        mean_f1=mean_f1,
        mean_param_accuracy=mean_param_accuracy,
        over_calling_count=over_calling,
        under_calling_count=under_calling,
        order_correct_count=order_correct_count,
        order_total=len(order_tasks),
        per_task=per_task,
    )


def print_summary(summary: ComparisonSummary) -> None:
    """Print a human-readable comparison summary."""
    print(f"\n{'=' * 60}")
    print(f"  {summary.implementation}")
    print(f"{'=' * 60}")
    print(f"  Tasks: {summary.tasks_with_results}/{summary.total_tasks} completed")
    print(
        f"  Exact match: {summary.exact_match_count}/{summary.tasks_with_results} ({summary.exact_match_rate:.1%})"
    )
    print(f"  Precision: {summary.mean_precision:.3f}")
    print(f"  Recall:    {summary.mean_recall:.3f}")
    print(f"  F1:        {summary.mean_f1:.3f}")
    print(f"  Param accuracy: {summary.mean_param_accuracy:.3f}")
    print(
        f"  Over-calling: {summary.over_calling_count} tasks | Under-calling: {summary.under_calling_count} tasks"
    )
    if summary.order_total > 0:
        print(f"  Order correct: {summary.order_correct_count}/{summary.order_total}")

    # Per-task details for failures
    failures = [t for t in summary.per_task if not t.exact_match and t.status != "error"]
    if failures:
        print(f"\n  Mismatches ({len(failures)} tasks):")
        for t in failures:
            print(f"    {t.task_id}: expected={t.expected_tools} actual={t.actual_tools}")
            if t.missing_tools:
                print(f"      missing: {t.missing_tools}")
            if t.extra_tools:
                print(f"      extra: {t.extra_tools}")

    errors = [t for t in summary.per_task if t.status == "error"]
    if errors:
        print(f"\n  Errors ({len(errors)} tasks):")
        for t in errors:
            print(f"    {t.task_id}: {t.error}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare agent trajectories against ground truth")
    parser.add_argument(
        "--results",
        type=str,
        nargs="+",
        required=True,
        help="Results JSON files to compare",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(_DEFAULT_OUTPUT_DIR),
        help=f"Output directory (default: {_DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    all_summaries = []
    for path in args.results:
        print(f"\nComparing {path}...")
        summary = compare_results_file(path)
        print_summary(summary)
        all_summaries.append(summary)

    # Save combined comparison
    output_path = output_dir / f"comparison_{ts}.json"
    data = [asdict(s) for s in all_summaries]
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"\nComparison saved to {output_path}")


if __name__ == "__main__":
    main()
