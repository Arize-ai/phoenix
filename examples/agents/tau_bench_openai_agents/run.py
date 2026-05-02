# mypy: ignore-errors
"""
Entry point for running tau-bench tasks with the OpenAI Agents SDK agent.

Usage:
    # Run all 10 selected tasks:
    python -m tau_bench_openai_agents.run

    # Run specific tasks by ID:
    python -m tau_bench_openai_agents.run --tasks 0 50

    # Run without Phoenix (no trace export):
    python -m tau_bench_openai_agents.run --no-phoenix

Requires:
    - OPENAI_API_KEY environment variable set
    - Phoenix running locally on port 6006 (unless --no-phoenix)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import datetime
from pathlib import Path

from .agent import ConversationResult, create_agent, run_conversation
from .tasks import SELECTED_TASK_IDS, load_selected_tasks

_EXAMPLE_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_RESULTS_DIR = _EXAMPLE_ROOT / "results"


def print_task_summary(task_id: int, task: object) -> None:
    """Print a brief summary of a task before running it."""
    print(f"\n{'=' * 70}")
    print(f"Task {task_id}")
    print(f"{'=' * 70}")
    instruction = getattr(task, "instruction", "")
    # Truncate long instructions
    if len(instruction) > 200:
        instruction = instruction[:200] + "..."
    print(f"Instruction: {instruction}")
    actions = getattr(task, "actions", [])
    print(f"Expected actions: {len(actions)}")
    action_names = [a.name for a in actions]
    print(f"  Tools: {action_names}")
    outputs = getattr(task, "outputs", [])
    if outputs:
        print(f"  Expected outputs: {outputs}")
    print()


def print_result(result: ConversationResult) -> None:
    """Print the result of a conversation."""
    print(f"\n--- Result for Task {result.task_id} ---")
    print(f"Turns: {len(result.turns)}")
    print(f"Terminated by: {result.terminated_by}")
    print(f"Tool calls made: {len(result.tool_calls_made)}")
    for tc in result.tool_calls_made:
        name = tc.get("name", "unknown")
        print(f"  - {name}")
    print()

    # Print conversation
    print("Conversation:")
    for turn in result.turns:
        role = turn["role"]
        content = turn["content"]
        if len(content) > 300:
            content = content[:300] + "..."
        print(f"  [{role}]: {content}")
    print()


async def run_tasks(
    task_ids: list[str] | None = None,
    enable_phoenix: bool = True,
) -> list[ConversationResult]:
    """Run selected tau-bench tasks and collect results.

    Args:
        task_ids: Specific task labels to run (e.g. ["dev:0", "train:35"]),
                  or None for all selected.
        enable_phoenix: Whether to set up Phoenix instrumentation.

    Returns:
        List of ConversationResult for each task.
    """
    if enable_phoenix:
        from .phoenix_setup import setup_instrumentation

        tracer_provider = setup_instrumentation()
        print(
            "Phoenix instrumentation enabled. Traces will be sent to "
            "http://localhost:6006 (project: tau-bench-openai)"
        )
    else:
        tracer_provider = None
        print("Phoenix instrumentation disabled.")

    # Load tasks
    all_tasks = load_selected_tasks()
    if task_ids is not None:
        all_tasks = [(tid, t) for tid, t in all_tasks if tid in task_ids]

    if not all_tasks:
        print("No tasks to run.")
        return []

    print(f"\nRunning {len(all_tasks)} tasks: {[tid for tid, _ in all_tasks]}")

    # Create agent (reused across tasks — stateless)
    agent = create_agent()

    results: list[ConversationResult] = []

    for task_id, task in all_tasks:
        print_task_summary(task_id, task)

        start_time = time.time()
        try:
            result = await run_conversation(agent=agent, task_id=task_id, task=task)
            elapsed = time.time() - start_time
            print(f"Task {task_id} completed in {elapsed:.1f}s")
            print_result(result)
            results.append(result)
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"Task {task_id} FAILED after {elapsed:.1f}s: {e}")
            import traceback

            traceback.print_exc()

    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"Tasks run: {len(results)}/{len(all_tasks)}")
    for r in results:
        gt_actions = [a.name for a in r.task.actions]
        actual_tools = [tc.get("name", "?") for tc in r.tool_calls_made]
        print(
            f"  Task {r.task_id}: {r.terminated_by}, "
            f"{len(r.turns)} turns, "
            f"{len(r.tool_calls_made)} tool calls"
        )
        print(f"    Expected: {gt_actions}")
        print(f"    Actual:   {actual_tools}")

    if tracer_provider is not None:
        print("\nFlushing traces...")
        tracer_provider.force_flush()
        print("Traces exported to Phoenix. View at http://localhost:6006")

    return results


def save_results(results: list[ConversationResult], output_path: str) -> None:
    """Save results to a JSON file for later analysis."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    data = []
    for r in results:
        data.append(
            {
                "task_id": r.task_id,
                "terminated_by": r.terminated_by,
                "turns": r.turns,
                "tool_calls_made": r.tool_calls_made,
                "expected_actions": [{"name": a.name, "kwargs": a.kwargs} for a in r.task.actions],
                "expected_outputs": r.task.outputs,
            }
        )
    with open(output, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Results saved to {output}")


def get_default_output_path() -> Path:
    """Return a timestamped default output path under examples/results."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _DEFAULT_RESULTS_DIR / f"tau_bench_openai_agents_{ts}.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run tau-bench tasks with OpenAI Agents SDK")
    parser.add_argument(
        "--tasks",
        type=str,
        nargs="*",
        default=None,
        help=f"Task labels to run, e.g. dev:0 train:35 (default: all selected: {SELECTED_TASK_IDS})",
    )
    parser.add_argument(
        "--no-phoenix",
        action="store_true",
        help="Disable Phoenix instrumentation",
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

    results = asyncio.run(
        run_tasks(
            task_ids=args.tasks,
            enable_phoenix=not args.no_phoenix,
        )
    )

    if results:
        output_path = args.output if args.output else str(get_default_output_path())
        save_results(results, output_path)


if __name__ == "__main__":
    main()
