# mypy: ignore-errors
"""
Entry point for running TRAJECT-Bench tasks with LangGraph.

Usage:
    # Run all 9 selected tasks:
    python -m traject_bench_langgraph.run

    # Run specific tasks by label:
    python -m traject_bench_langgraph.run --tasks parallel_ecommerce_simple:0 sequential_travel:1

    # Run without Phoenix (no trace export):
    python -m traject_bench_langgraph.run --no-phoenix

Requires:
    - OPENAI_API_KEY environment variable set
    - Phoenix running locally on port 6006 (unless --no-phoenix)
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from .agent import TaskResult, run_task
from .tasks import SELECTED_TASK_IDS, TrajectTask, load_selected_tasks

_EXAMPLE_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_RESULTS_DIR = _EXAMPLE_ROOT / "results"


def print_task_summary(task: TrajectTask) -> None:
    """Print a brief summary of a task before running it."""
    print(f"\n{'=' * 70}")
    print(f"Task {task.label} ({task.trajectory_type})")
    print(f"{'=' * 70}")
    query = task.query
    if len(query) > 200:
        query = query[:200] + "..."
    print(f"Query: {query}")
    print(f"Tools: {len(task.tools)}")
    for t in task.tools:
        name = t.get("tool name", "unknown")
        status = t.get("execution_status", "n/a")
        print(f"  - {name} [{status}]")
    print()


def print_result(result: TaskResult) -> None:
    """Print the result of a task run."""
    print(f"\n--- Result for {result.task_label} ---")

    if result.error:
        print(f"ERROR: {result.error}")
        return

    print(f"Tool calls made: {len(result.tool_calls_made)}")
    for tc in result.tool_calls_made:
        print(f"  - {tc['name']}({tc.get('args', {})})")

    print(f"\nExpected tools: {len(result.tool_calls_expected)}")
    for tc in result.tool_calls_expected:
        print(f"  - {tc['original_name']}")

    # Tool name match check
    expected_names = {tc["func_name"] for tc in result.tool_calls_expected}
    actual_names = {tc["name"] for tc in result.tool_calls_made}
    matched = expected_names & actual_names
    missing = expected_names - actual_names
    extra = actual_names - expected_names

    print(f"\nTool match: {len(matched)}/{len(expected_names)} expected tools called")
    if missing:
        print(f"  Missing: {missing}")
    if extra:
        print(f"  Extra: {extra}")

    # Final answer preview
    answer = result.final_answer_actual
    if len(answer) > 300:
        answer = answer[:300] + "..."
    print(f"\nFinal answer: {answer}")
    print()


def run_tasks(
    task_ids: list[str] | None = None,
    enable_phoenix: bool = True,
    model: str = "gpt-4o",
) -> list[TaskResult]:
    """Run selected TRAJECT-Bench tasks and collect results.

    Args:
        task_ids: Specific task labels to run (e.g. ["parallel_ecommerce_simple:0"]),
                  or None for all selected.
        enable_phoenix: Whether to set up Phoenix instrumentation.
        model: OpenAI model name. Defaults to gpt-4o.

    Returns:
        List of TaskResult for each task.
    """
    if enable_phoenix:
        from .phoenix_setup import setup_instrumentation

        tracer_provider = setup_instrumentation()
        print(
            "Phoenix instrumentation enabled. Traces will be sent to "
            "http://localhost:6006 (project: traject-bench-langgraph)"
        )
    else:
        tracer_provider = None
        print("Phoenix instrumentation disabled.")

    # Load tasks
    all_tasks = load_selected_tasks()
    if task_ids is not None:
        all_tasks = [t for t in all_tasks if t.label in task_ids]

    if not all_tasks:
        print("No tasks to run.")
        return []

    print(f"\nRunning {len(all_tasks)} tasks: {[t.label for t in all_tasks]}")

    results: list[TaskResult] = []

    for task in all_tasks:
        print_task_summary(task)

        start_time = time.time()
        try:
            result = run_task(task, model=model)
            elapsed = time.time() - start_time
            print(f"Task {task.label} completed in {elapsed:.1f}s")
            print_result(result)
            results.append(result)
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"Task {task.label} FAILED after {elapsed:.1f}s: {e}")
            import traceback

            traceback.print_exc()

    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"Tasks run: {len(results)}/{len(all_tasks)}")
    for r in results:
        expected_names = [tc["original_name"] for tc in r.tool_calls_expected]
        actual_names = [tc["name"] for tc in r.tool_calls_made]
        status = "OK" if not r.error else f"ERROR: {r.error}"
        print(
            f"  {r.task_label} ({r.trajectory_type}): {status}, {len(r.tool_calls_made)} tool calls"
        )
        print(f"    Expected: {expected_names}")
        print(f"    Actual:   {actual_names}")

    if tracer_provider is not None:
        print("\nFlushing traces...")
        tracer_provider.force_flush()
        print("Traces exported to Phoenix. View at http://localhost:6006")

    return results


def save_results(results: list[TaskResult], output_path: str) -> None:
    """Save results to a JSON file for later analysis."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    data = []
    for r in results:
        data.append(
            {
                "task_label": r.task_label,
                "config": r.config,
                "trajectory_type": r.trajectory_type,
                "query": r.query,
                "final_answer_expected": r.final_answer_expected,
                "final_answer_actual": r.final_answer_actual,
                "tool_calls_made": r.tool_calls_made,
                "tool_calls_expected": r.tool_calls_expected,
                "error": r.error,
            }
        )
    with open(output, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Results saved to {output}")


def get_default_output_path() -> Path:
    """Return a timestamped default output path under examples/results."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _DEFAULT_RESULTS_DIR / f"traject_bench_langgraph_{ts}.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run TRAJECT-Bench tasks with LangGraph agent")
    parser.add_argument(
        "--tasks",
        type=str,
        nargs="*",
        default=None,
        help=(
            f"Task labels to run, e.g. parallel_ecommerce_simple:0 sequential_travel:1 "
            f"(default: all selected: {SELECTED_TASK_IDS})"
        ),
    )
    parser.add_argument(
        "--no-phoenix",
        action="store_true",
        help="Disable Phoenix instrumentation",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-4o",
        help="OpenAI model to use (default: gpt-4o)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help=(
            "Path to save results JSON. If omitted, results are written to examples/agents/results/"
        ),
    )
    args = parser.parse_args()

    results = run_tasks(
        task_ids=args.tasks,
        enable_phoenix=not args.no_phoenix,
        model=args.model,
    )

    if results:
        output_path = args.output if args.output else str(get_default_output_path())
        save_results(results, output_path)


if __name__ == "__main__":
    main()
