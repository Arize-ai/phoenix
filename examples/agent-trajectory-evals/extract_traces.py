# mypy: ignore-errors
"""
Trace extraction from Phoenix using the fast-path method.

Pulls traces from Phoenix projects and extracts trajectories using the
"last LLM span messages" approach discovered in Stage 6.

Usage:
    # Extract from all scaled projects:
    python -m extract_traces

    # Extract from specific project:
    python -m extract_traces --project tau-bench-openai-scaled

    # Use results files instead of live Phoenix:
    python -m extract_traces --from-results results/scaled/tau_openai_*.json

The fast-path approach:
1. For each trace, find the last LLM span by end_time
2. Parse llm.input_messages into structured chat messages
3. Extract tool calls, user messages, agent responses
4. Build a lightweight trajectory record aligned with ground truth
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

_EXAMPLE_ROOT = Path(__file__).resolve().parent
_DEFAULT_OUTPUT_DIR = _EXAMPLE_ROOT / "results" / "scaled"

# Phoenix project names for scaled runs
SCALED_PROJECTS = [
    "tau-bench-openai-scaled",
    "tau-bench-langgraph-scaled",
    "traject-bench-langgraph-scaled",
]


@dataclass
class ToolCallRecord:
    """A single tool call extracted from a trajectory."""

    name: str
    arguments: dict
    result: str | None = None
    error: bool = False


@dataclass
class TrajectoryRecord:
    """Extracted trajectory for a single task."""

    task_id: str
    source: str  # "phoenix" or "results"
    tool_calls_made: list[ToolCallRecord] = field(default_factory=list)
    tool_calls_expected: list[dict] = field(default_factory=list)
    conversation: list[dict] = field(default_factory=list)
    final_response: str = ""
    system_prompt: str = ""
    parallel_groups: list[list[str]] = field(default_factory=list)


def extract_tool_calls_from_messages(messages: list[dict]) -> list[ToolCallRecord]:
    """Extract tool calls from a list of chat messages.

    Walks through messages looking for assistant messages with tool_calls
    and the subsequent tool result messages.
    """
    tool_calls: list[ToolCallRecord] = []
    # Build a map of tool_call_id -> result from tool messages
    tool_results: dict[str, str] = {}
    for msg in messages:
        role = msg.get("role", "")
        if role == "tool":
            tc_id = msg.get("tool_call_id", "")
            content = msg.get("content", "")
            if tc_id:
                tool_results[tc_id] = content

    # Now extract tool calls from assistant messages
    for msg in messages:
        role = msg.get("role", "")
        if role == "assistant":
            calls = msg.get("tool_calls", [])
            for call in calls:
                func = call.get("function", {})
                name = func.get("name", "")
                args_str = func.get("arguments", "{}")
                try:
                    args = json.loads(args_str) if isinstance(args_str, str) else args_str
                except (json.JSONDecodeError, TypeError):
                    args = {"_raw": args_str}

                tc_id = call.get("id", "")
                result = tool_results.get(tc_id)
                is_error = False
                if result:
                    try:
                        parsed = json.loads(result)
                        if isinstance(parsed, dict) and "Error" in parsed:
                            is_error = True
                    except (json.JSONDecodeError, TypeError):
                        if result.startswith("ERROR"):
                            is_error = True

                tool_calls.append(
                    ToolCallRecord(
                        name=name,
                        arguments=args,
                        result=result,
                        error=is_error,
                    )
                )

    return tool_calls


def detect_parallel_groups(messages: list[dict]) -> list[list[str]]:
    """Detect parallel tool call groups from messages.

    Multiple tool_calls in a single assistant message = parallel group.
    """
    groups = []
    for msg in messages:
        if msg.get("role") == "assistant":
            calls = msg.get("tool_calls", [])
            if len(calls) > 1:
                names = [c.get("function", {}).get("name", "") for c in calls]
                groups.append(names)
    return groups


def extract_from_phoenix(project_name: str) -> list[TrajectoryRecord]:
    """Extract trajectories from a Phoenix project using the fast-path method.

    For each trace:
    1. Get all spans
    2. Find the last LLM span
    3. Parse llm.input_messages
    4. Build trajectory record
    """
    try:
        import phoenix as px
    except ImportError:
        print("  Phoenix client not available. Use --from-results instead.")
        return []

    client = px.Client()
    trajectories = []

    try:
        spans_df = client.get_spans_dataframe(project_name=project_name)
    except Exception as e:
        print(f"  Could not get spans for {project_name}: {e}")
        return []

    if spans_df is None or spans_df.empty:
        print(f"  No spans found for {project_name}")
        return []

    # Group spans by trace_id (root span context)
    # Filter to LLM spans and find the last one per trace
    llm_spans = spans_df[spans_df["span_kind"] == "LLM"].copy()
    if llm_spans.empty:
        print(f"  No LLM spans found in {project_name}")
        return []

    # Group by trace ID and get the last LLM span
    trace_groups = llm_spans.groupby("context.trace_id")

    for trace_id, group in trace_groups:
        # Get the last LLM span by end_time
        last_span = group.sort_values("end_time").iloc[-1]

        # Parse llm.input_messages
        messages_raw = last_span.get("attributes.llm.input_messages", "[]")
        try:
            messages = json.loads(messages_raw) if isinstance(messages_raw, str) else messages_raw
        except (json.JSONDecodeError, TypeError):
            messages = []

        if not messages:
            continue

        # Extract system prompt
        system_prompt = ""
        for msg in messages:
            if msg.get("role") == "system":
                system_prompt = msg.get("content", "")
                break

        # Extract tool calls
        tool_calls = extract_tool_calls_from_messages(messages)
        parallel_groups = detect_parallel_groups(messages)

        # Get final response (last assistant message without tool_calls)
        final_response = ""
        for msg in reversed(messages):
            if msg.get("role") == "assistant" and not msg.get("tool_calls"):
                final_response = msg.get("content", "")
                break

        # Try to get task_id from session attributes
        task_id = str(trace_id)
        session_id = last_span.get("attributes.session.id", "")
        if session_id:
            task_id = session_id

        trajectories.append(
            TrajectoryRecord(
                task_id=task_id,
                source="phoenix",
                tool_calls_made=tool_calls,
                conversation=messages,
                final_response=final_response,
                system_prompt=system_prompt,
                parallel_groups=parallel_groups,
            )
        )

    return trajectories


def extract_from_results(results_path: str) -> list[TrajectoryRecord]:
    """Extract trajectories from saved results JSON files.

    This is the fallback when Phoenix is not running — works directly
    from the results files saved by run_scaled.py.
    """
    with open(results_path) as f:
        data = json.load(f)

    # Handle both top-level list and wrapped format
    results = data.get("results", data) if isinstance(data, dict) else data

    trajectories = []
    for entry in results:
        if entry.get("status") == "error" and "turns" not in entry:
            continue

        # Tau-bench format
        task_id = entry.get("task_id") or entry.get("task_label", "unknown")

        # Extract tool calls from stored data
        tool_calls = []
        for tc in entry.get("tool_calls_made", []):
            name = tc.get("name", "")
            args = tc.get("args", tc.get("arguments", {}))
            # Handle nested args format from TRAJECT-Bench
            if "parameters" in args and len(args) == 1:
                args = args["parameters"]
            tool_calls.append(ToolCallRecord(name=name, arguments=args))

        # Build expected tool calls
        expected = []
        if "expected_actions" in entry:
            # Tau-bench format
            for a in entry["expected_actions"]:
                expected.append({"name": a["name"], "kwargs": a.get("kwargs", {})})
        elif "tool_calls_expected" in entry:
            # TRAJECT-Bench format
            expected = entry["tool_calls_expected"]

        # Build conversation from turns (tau-bench) or just store query (traject)
        conversation = entry.get("turns", [])
        if not conversation and "query" in entry:
            conversation = [{"role": "user", "content": entry["query"]}]

        # Final response
        final_response = entry.get("final_answer_actual", "")
        if not final_response and conversation:
            for msg in reversed(conversation):
                if msg.get("role") == "assistant":
                    final_response = msg.get("content", "")
                    break

        trajectories.append(
            TrajectoryRecord(
                task_id=task_id,
                source="results",
                tool_calls_made=tool_calls,
                tool_calls_expected=expected,
                conversation=conversation,
                final_response=final_response,
            )
        )

    return trajectories


def save_trajectories(
    trajectories: list[TrajectoryRecord],
    output_path: Path,
) -> None:
    """Save extracted trajectories to JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = [asdict(t) for t in trajectories]
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved {len(trajectories)} trajectories to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract trajectories from Phoenix traces or results files"
    )
    parser.add_argument(
        "--project",
        type=str,
        nargs="*",
        default=None,
        help=f"Phoenix project names to extract from (default: {SCALED_PROJECTS})",
    )
    parser.add_argument(
        "--from-results",
        type=str,
        nargs="*",
        default=None,
        help="Extract from results JSON files instead of Phoenix",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(_DEFAULT_OUTPUT_DIR),
        help=f"Output directory (default: {_DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if args.from_results:
        # Extract from results files
        for path in args.from_results:
            print(f"\nExtracting from {path}...")
            trajectories = extract_from_results(path)
            # Derive output name from input
            stem = Path(path).stem
            out_path = output_dir / f"trajectories_{stem}_{ts}.json"
            save_trajectories(trajectories, out_path)
    else:
        # Extract from Phoenix
        projects = args.project or SCALED_PROJECTS
        for project in projects:
            print(f"\nExtracting from Phoenix project: {project}...")
            trajectories = extract_from_phoenix(project)
            safe_name = project.replace("-", "_")
            out_path = output_dir / f"trajectories_{safe_name}_{ts}.json"
            save_trajectories(trajectories, out_path)


if __name__ == "__main__":
    main()
