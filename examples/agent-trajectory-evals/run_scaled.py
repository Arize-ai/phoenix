# mypy: ignore-errors
"""
Batch runner for scaled agent trajectory evaluation.

Orchestrates all three implementations (tau-bench-openai, tau-bench-langgraph,
traject-bench-langgraph) sequentially with 20 tasks each.

Usage:
    # Run all implementations:
    python -m run_scaled

    # Run specific implementations:
    python -m run_scaled --implementations tau-openai tau-langgraph

    # Run without Phoenix (no trace export):
    python -m run_scaled --no-phoenix

    # Custom output directory:
    python -m run_scaled --output-dir results/scaled/

Requires:
    - OPENAI_API_KEY environment variable set
    - Phoenix running locally on port 6006 (unless --no-phoenix)
"""

from __future__ import annotations

import argparse
import json
import time
import traceback
from datetime import datetime
from pathlib import Path

_EXAMPLE_ROOT = Path(__file__).resolve().parent
_DEFAULT_OUTPUT_DIR = _EXAMPLE_ROOT / "results" / "scaled"

# Implementation registry
IMPLEMENTATIONS = ["tau-openai", "tau-langgraph", "traject-langgraph"]


def run_tau_openai(enable_phoenix: bool, output_dir: Path) -> dict:
    """Run tau-bench with OpenAI Agents SDK (20 scaled tasks)."""
    import asyncio

    from tau_bench_openai_agents.agent import create_agent, run_conversation
    from tau_bench_openai_agents.tasks_scaled import load_scaled_tasks

    project_name = "tau-bench-openai-scaled"
    tracer_provider = None

    if enable_phoenix:
        from tau_bench_openai_agents.phoenix_setup import setup_instrumentation

        tracer_provider = setup_instrumentation(project_name=project_name)
        print(f"  Phoenix project: {project_name}")

    tasks = load_scaled_tasks()
    agent = create_agent()

    results = []
    passed = 0
    failed = 0

    for task_id, task in tasks:
        print(f"  Running {task_id}...", end=" ", flush=True)
        start = time.time()
        try:
            result = asyncio.run(run_conversation(agent=agent, task_id=task_id, task=task))
            elapsed = time.time() - start
            gt_tools = [a.name for a in task.actions]
            actual_tools = [tc.get("name", "?") for tc in result.tool_calls_made]
            results.append(
                {
                    "task_id": task_id,
                    "status": "ok",
                    "terminated_by": result.terminated_by,
                    "turns": result.turns,
                    "tool_calls_made": result.tool_calls_made,
                    "expected_actions": [
                        {"name": a.name, "kwargs": a.kwargs} for a in task.actions
                    ],
                    "expected_outputs": task.outputs,
                    "elapsed_seconds": elapsed,
                }
            )
            print(f"OK ({elapsed:.1f}s, {len(actual_tools)} tools, expected {len(gt_tools)})")
            passed += 1
        except Exception as e:
            elapsed = time.time() - start
            print(f"ERROR ({elapsed:.1f}s): {e}")
            results.append(
                {
                    "task_id": task_id,
                    "status": "error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "elapsed_seconds": elapsed,
                }
            )
            failed += 1

    if tracer_provider is not None:
        tracer_provider.force_flush()

    return {
        "implementation": "tau-openai",
        "project_name": project_name,
        "total_tasks": len(tasks),
        "passed": passed,
        "failed": failed,
        "results": results,
    }


def run_tau_langgraph(enable_phoenix: bool, output_dir: Path) -> dict:
    """Run tau-bench with LangGraph (20 scaled tasks)."""
    from tau_bench_langgraph.agent import create_agent_graph, run_conversation
    from tau_bench_langgraph.tasks_scaled import load_scaled_tasks

    project_name = "tau-bench-langgraph-scaled"
    tracer_provider = None

    if enable_phoenix:
        from tau_bench_langgraph.phoenix_setup import setup_instrumentation

        tracer_provider = setup_instrumentation(project_name=project_name)
        print(f"  Phoenix project: {project_name}")

    tasks = load_scaled_tasks()
    graph = create_agent_graph()

    results = []
    passed = 0
    failed = 0

    for task_id, task in tasks:
        print(f"  Running {task_id}...", end=" ", flush=True)
        start = time.time()
        try:
            result = run_conversation(graph=graph, task_id=task_id, task=task)
            elapsed = time.time() - start
            gt_tools = [a.name for a in task.actions]
            actual_tools = [tc.get("name", "?") for tc in result.tool_calls_made]
            results.append(
                {
                    "task_id": task_id,
                    "status": "ok",
                    "terminated_by": result.terminated_by,
                    "turns": result.turns,
                    "tool_calls_made": result.tool_calls_made,
                    "expected_actions": [
                        {"name": a.name, "kwargs": a.kwargs} for a in task.actions
                    ],
                    "expected_outputs": task.outputs,
                    "elapsed_seconds": elapsed,
                }
            )
            print(f"OK ({elapsed:.1f}s, {len(actual_tools)} tools, expected {len(gt_tools)})")
            passed += 1
        except Exception as e:
            elapsed = time.time() - start
            print(f"ERROR ({elapsed:.1f}s): {e}")
            results.append(
                {
                    "task_id": task_id,
                    "status": "error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "elapsed_seconds": elapsed,
                }
            )
            failed += 1

    if tracer_provider is not None:
        tracer_provider.force_flush()

    return {
        "implementation": "tau-langgraph",
        "project_name": project_name,
        "total_tasks": len(tasks),
        "passed": passed,
        "failed": failed,
        "results": results,
    }


def run_traject_langgraph(enable_phoenix: bool, output_dir: Path) -> dict:
    """Run TRAJECT-Bench with LangGraph (20 scaled tasks)."""
    from traject_bench_langgraph.agent import run_task
    from traject_bench_langgraph.tasks_scaled import load_scaled_tasks

    project_name = "traject-bench-langgraph-scaled"
    tracer_provider = None

    if enable_phoenix:
        from traject_bench_langgraph.phoenix_setup import setup_instrumentation

        tracer_provider = setup_instrumentation(project_name=project_name)
        print(f"  Phoenix project: {project_name}")

    tasks = load_scaled_tasks()

    results = []
    passed = 0
    failed = 0

    for task in tasks:
        print(f"  Running {task.label} ({task.trajectory_type})...", end=" ", flush=True)
        start = time.time()
        try:
            result = run_task(task)
            elapsed = time.time() - start
            expected_names = [t.get("tool name", "?") for t in task.tools]
            actual_names = [tc["name"] for tc in result.tool_calls_made]
            results.append(
                {
                    "task_label": task.label,
                    "config": task.config,
                    "trajectory_type": task.trajectory_type,
                    "status": "ok" if not result.error else "error",
                    "error": result.error,
                    "query": task.query,
                    "final_answer_expected": task.final_answer,
                    "final_answer_actual": result.final_answer_actual,
                    "tool_calls_made": result.tool_calls_made,
                    "tool_calls_expected": result.tool_calls_expected,
                    "elapsed_seconds": elapsed,
                }
            )
            status = "OK" if not result.error else f"WARN: {result.error}"
            print(
                f"{status} ({elapsed:.1f}s, {len(actual_names)} tools, expected {len(expected_names)})"
            )
            passed += 1 if not result.error else 0
            failed += 0 if not result.error else 1
        except Exception as e:
            elapsed = time.time() - start
            print(f"ERROR ({elapsed:.1f}s): {e}")
            results.append(
                {
                    "task_label": task.label,
                    "config": task.config,
                    "trajectory_type": task.trajectory_type,
                    "status": "error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "elapsed_seconds": elapsed,
                }
            )
            failed += 1

    if tracer_provider is not None:
        tracer_provider.force_flush()

    return {
        "implementation": "traject-langgraph",
        "project_name": project_name,
        "total_tasks": len(tasks),
        "passed": passed,
        "failed": failed,
        "results": results,
    }


# Dispatcher
_RUNNERS = {
    "tau-openai": run_tau_openai,
    "tau-langgraph": run_tau_langgraph,
    "traject-langgraph": run_traject_langgraph,
}


def run_all(
    implementations: list[str],
    enable_phoenix: bool,
    output_dir: Path,
) -> None:
    """Run all specified implementations sequentially."""
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    all_summaries = []

    total_start = time.time()

    for impl in implementations:
        if impl not in _RUNNERS:
            print(f"Unknown implementation: {impl}. Skipping.")
            continue

        print(f"\n{'=' * 70}")
        print(f"  {impl.upper()} — Scaled Run (20 tasks)")
        print(f"{'=' * 70}")

        impl_start = time.time()
        summary = _RUNNERS[impl](enable_phoenix, output_dir)
        impl_elapsed = time.time() - impl_start
        summary["total_elapsed_seconds"] = impl_elapsed

        # Save per-implementation results
        safe_name = impl.replace("-", "_")
        output_path = output_dir / f"{safe_name}_{ts}.json"
        with open(output_path, "w") as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"\n  Results saved to {output_path}")
        print(
            f"  Time: {impl_elapsed:.1f}s | Passed: {summary['passed']} | Failed: {summary['failed']}"
        )

        all_summaries.append(summary)

    total_elapsed = time.time() - total_start

    # Cross-implementation summary
    print(f"\n{'=' * 70}")
    print("  CROSS-IMPLEMENTATION SUMMARY")
    print(f"{'=' * 70}")
    for s in all_summaries:
        print(
            f"  {s['implementation']:25s}  {s['passed']}/{s['total_tasks']} passed  ({s.get('total_elapsed_seconds', 0):.0f}s)"
        )
    print(f"\n  Total wall time: {total_elapsed:.1f}s")

    # Save combined summary
    summary_path = output_dir / f"summary_{ts}.json"
    combined = {
        "timestamp": ts,
        "total_elapsed_seconds": total_elapsed,
        "implementations": all_summaries,
    }
    with open(summary_path, "w") as f:
        json.dump(combined, f, indent=2, default=str)
    print(f"  Combined summary saved to {summary_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run scaled agent trajectory evaluation across all implementations"
    )
    parser.add_argument(
        "--implementations",
        type=str,
        nargs="*",
        default=IMPLEMENTATIONS,
        help=f"Implementations to run (default: {IMPLEMENTATIONS})",
    )
    parser.add_argument(
        "--no-phoenix",
        action="store_true",
        help="Disable Phoenix instrumentation",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(_DEFAULT_OUTPUT_DIR),
        help=f"Output directory for results (default: {_DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    run_all(
        implementations=args.implementations,
        enable_phoenix=not args.no_phoenix,
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
