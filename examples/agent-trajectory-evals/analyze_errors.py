# mypy: ignore-errors
"""
LLM-powered error analysis using Claude.

Analyzes agent trajectories for failure modes, categorizes errors,
and synthesizes cross-implementation findings.

Usage:
    # Analyze from results files:
    python -m analyze_errors --results results/scaled/tau_openai_*.json

    # Analyze with comparison data:
    python -m analyze_errors --results results/scaled/*.json --comparison results/scaled/comparison_*.json

Architecture:
    Coordinator agent dispatches per-task analysis, then synthesizes findings.
    Uses the Anthropic Python SDK with Claude for all analysis.

Requires:
    - ANTHROPIC_API_KEY environment variable set
"""

from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

_DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "results" / "scaled" / "analysis"

# Failure mode taxonomy
FAILURE_MODES = [
    "wrong_tool",
    "missing_tool",
    "wrong_params",
    "wrong_order",
    "redundant_call",
    "policy_violation",
    "hallucinated_info",
    "early_termination",
    "unnecessary_escalation",
    "missed_escalation",
    "communication_failure",
    "tool_error_mishandled",
]


@dataclass
class TaskAnalysis:
    """LLM analysis of a single task trajectory."""

    task_id: str
    implementation: str
    outcome: str  # "success", "partial_success", "failure"
    failure_modes: list[str]
    root_cause: str
    severity: str  # "high", "medium", "low"
    detectable_from_trace: bool
    explanation: str
    raw_response: str = ""


@dataclass
class SynthesisReport:
    """Cross-implementation synthesis of error analysis."""

    frequency_analysis: dict  # failure_mode -> count
    cross_framework_findings: str
    cross_benchmark_findings: str
    evaluator_mapping: dict  # failure_mode -> list of evaluator types
    prioritized_recommendations: list[dict]
    surprising_findings: str
    raw_response: str = ""


# Tau-bench policy summary for analysis context
TAU_BENCH_POLICY = """Key policy rules:
1. Must authenticate user via email OR name+zip before any action
2. One user per conversation
3. Single tool call per turn (no parallel calls, no tool+response together)
4. Explicit confirmation before DB-changing actions (cancel, modify, return, exchange)
5. Exchange/modify tools can only be called ONCE per order — must collect all items first
6. No hallucinated information
7. Transfer to human only when request is genuinely out of scope"""


TASK_ANALYST_PROMPT = """You are an expert evaluator analyzing an AI agent's performance on a customer service task.

## Task Context
- Task ID: {task_id}
- Implementation: {implementation}
- Benchmark: {benchmark}

## Task Description
{task_description}

## Ground Truth (Expected Tool Calls)
{ground_truth}

## Agent's Actual Trajectory
{trajectory}

## Deterministic Comparison Results
{comparison}

{policy_section}

## Analysis Instructions

Analyze this trajectory and respond with a JSON object containing:

1. **outcome**: "success" | "partial_success" | "failure"
   - success: all expected tools called with correct params
   - partial_success: some but not all expected tools called correctly
   - failure: wrong tools, major errors, or task not completed

2. **failure_modes**: Array of applicable failure mode codes (empty if success):
   {failure_modes_list}

3. **root_cause**: One sentence explaining WHY the failure happened (empty string if success)

4. **severity**: "high" | "medium" | "low" | "none"
   - high: user would notice, could cause real harm (wrong data modified, incorrect info)
   - medium: suboptimal but functional (extra tool calls, slightly wrong params)
   - low: minor issues (verbose responses, unnecessary confirmations)
   - none: no issues

5. **detectable_from_trace**: true if an automated eval could catch this using only trace data, false if it requires understanding policy nuance or user intent

6. **explanation**: 2-3 sentences describing what happened and why

Respond ONLY with a valid JSON object, no other text."""


SYNTHESIS_PROMPT = """You are an expert evaluator synthesizing findings from agent trajectory error analysis across multiple implementations and benchmarks.

## Per-Task Analysis Results
{task_analyses}

## Implementations Analyzed
{implementations}

## Analysis Instructions

Based on all per-task analyses, provide a comprehensive synthesis. Respond with a JSON object containing:

1. **frequency_analysis**: Object mapping each failure mode to its count across all tasks.
   Only include modes that appeared at least once.

2. **cross_framework_findings**: String (3-5 sentences) comparing how tau-bench tasks fail
   differently on OpenAI Agents SDK vs LangGraph. Focus on systematic differences, not random variation.
   If only one framework is present, note that.

3. **cross_benchmark_findings**: String (3-5 sentences) comparing how tau-bench failures
   (multi-turn, conversational) differ from TRAJECT-Bench failures (single-turn, tool-calling).
   If only one benchmark is present, note that.

4. **evaluator_mapping**: Object mapping each observed failure mode to an array of evaluator
   types that could detect it. Use these evaluator types:
   - "tool_selection" (did agent pick the right tools?)
   - "parameter_accuracy" (did agent pass correct arguments?)
   - "tool_sequencing" (were tools called in right order?)
   - "policy_compliance" (did agent follow policy rules?)
   - "response_quality" (was agent's text response helpful/accurate?)
   - "error_handling" (did agent handle tool errors well?)
   - "redundancy" (did agent make unnecessary tool calls?)

5. **prioritized_recommendations**: Array of objects, each with:
   - "rank": integer (1 = highest priority)
   - "evaluator": which evaluator to implement first
   - "failure_modes_caught": array of failure modes it would catch
   - "frequency": how often these failures appeared (count)
   - "severity_distribution": object with high/medium/low counts
   - "feasibility": "fast_path" (can use last-LLM-span extraction) or "full_path" (needs span tree)
   - "rationale": one sentence explaining why this priority

6. **surprising_findings**: String (2-4 sentences) describing anything unexpected — failure
   modes not in our taxonomy, patterns we didn't anticipate, cases where the agent succeeded
   in unexpected ways.

Respond ONLY with a valid JSON object, no other text."""


def get_anthropic_client():
    """Get Anthropic client, checking for API key."""
    try:
        from anthropic import Anthropic
    except ImportError:
        raise ImportError("anthropic package required. Install with: pip install anthropic")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")

    return Anthropic(api_key=api_key)


def analyze_single_task(
    client: object,
    task_id: str,
    implementation: str,
    benchmark: str,
    task_description: str,
    ground_truth: str,
    trajectory: str,
    comparison: str,
    policy_section: str = "",
) -> TaskAnalysis:
    """Analyze a single task trajectory using Claude."""
    prompt = TASK_ANALYST_PROMPT.format(
        task_id=task_id,
        implementation=implementation,
        benchmark=benchmark,
        task_description=task_description,
        ground_truth=ground_truth,
        trajectory=trajectory,
        comparison=comparison,
        policy_section=f"## Policy Rules\n{TAU_BENCH_POLICY}" if policy_section else "",
        failure_modes_list="\n   ".join(f'- "{m}"' for m in FAILURE_MODES),
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    # Parse JSON response
    try:
        # Handle potential markdown code blocks
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(raw)
    except json.JSONDecodeError:
        return TaskAnalysis(
            task_id=task_id,
            implementation=implementation,
            outcome="unknown",
            failure_modes=[],
            root_cause="Failed to parse LLM response",
            severity="unknown",
            detectable_from_trace=False,
            explanation=f"LLM response was not valid JSON: {raw[:200]}",
            raw_response=raw,
        )

    return TaskAnalysis(
        task_id=task_id,
        implementation=implementation,
        outcome=data.get("outcome", "unknown"),
        failure_modes=data.get("failure_modes", []),
        root_cause=data.get("root_cause", ""),
        severity=data.get("severity", "unknown"),
        detectable_from_trace=data.get("detectable_from_trace", False),
        explanation=data.get("explanation", ""),
        raw_response=raw,
    )


def synthesize_findings(
    client: object,
    task_analyses: list[TaskAnalysis],
    implementations: list[str],
) -> SynthesisReport:
    """Synthesize findings across all task analyses."""
    # Prepare analyses for the prompt (without raw_response to save tokens)
    analyses_data = []
    for a in task_analyses:
        analyses_data.append(
            {
                "task_id": a.task_id,
                "implementation": a.implementation,
                "outcome": a.outcome,
                "failure_modes": a.failure_modes,
                "root_cause": a.root_cause,
                "severity": a.severity,
                "detectable_from_trace": a.detectable_from_trace,
                "explanation": a.explanation,
            }
        )

    prompt = SYNTHESIS_PROMPT.format(
        task_analyses=json.dumps(analyses_data, indent=2),
        implementations=", ".join(implementations),
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    try:
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(raw)
    except json.JSONDecodeError:
        return SynthesisReport(
            frequency_analysis={},
            cross_framework_findings="Failed to parse synthesis response",
            cross_benchmark_findings="",
            evaluator_mapping={},
            prioritized_recommendations=[],
            surprising_findings="",
            raw_response=raw,
        )

    return SynthesisReport(
        frequency_analysis=data.get("frequency_analysis", {}),
        cross_framework_findings=data.get("cross_framework_findings", ""),
        cross_benchmark_findings=data.get("cross_benchmark_findings", ""),
        evaluator_mapping=data.get("evaluator_mapping", {}),
        prioritized_recommendations=data.get("prioritized_recommendations", []),
        surprising_findings=data.get("surprising_findings", ""),
        raw_response=raw,
    )


def format_task_for_analysis(entry: dict, is_traject: bool) -> dict:
    """Format a results entry into analysis-ready strings."""
    if is_traject:
        task_id = entry.get("task_label", "unknown")
        description = entry.get("query", "")
        gt = json.dumps(entry.get("tool_calls_expected", []), indent=2)
        trajectory = (
            f"Tool calls made: {json.dumps(entry.get('tool_calls_made', []), indent=2)}\n"
            f"Final answer: {entry.get('final_answer_actual', '')[:500]}"
        )
    else:
        task_id = entry.get("task_id", "unknown")
        # Build description from conversation
        turns = entry.get("turns", [])
        user_msgs = [t["content"] for t in turns if t.get("role") == "user"]
        description = user_msgs[0] if user_msgs else "No user message found"
        gt = json.dumps(entry.get("expected_actions", []), indent=2)
        trajectory = (
            f"Turns: {len(turns)}\n"
            f"Tool calls made: {json.dumps(entry.get('tool_calls_made', []), indent=2)}\n"
            f"Terminated by: {entry.get('terminated_by', 'unknown')}\n"
            f"Conversation (last 5 turns):\n"
            + "\n".join(f"  [{t['role']}]: {t['content'][:200]}" for t in turns[-5:])
        )

    return {
        "task_id": task_id,
        "description": description,
        "ground_truth": gt,
        "trajectory": trajectory,
    }


def run_analysis(
    results_paths: list[str],
    comparison_path: str | None,
    output_dir: Path,
) -> None:
    """Run full error analysis pipeline."""
    output_dir.mkdir(parents=True, exist_ok=True)
    tasks_dir = output_dir / "tasks"
    tasks_dir.mkdir(exist_ok=True)

    client = get_anthropic_client()

    # Load comparison data if available
    comparison_data: dict[str, dict] = {}
    if comparison_path:
        with open(comparison_path) as f:
            comparisons = json.load(f)
        for comp in comparisons:
            for task_result in comp.get("per_task", []):
                comparison_data[task_result["task_id"]] = task_result

    all_analyses: list[TaskAnalysis] = []
    implementations_seen: set[str] = set()

    for results_path in results_paths:
        print(f"\nAnalyzing {results_path}...")
        with open(results_path) as f:
            data = json.load(f)

        impl = data.get("implementation", Path(results_path).stem)
        implementations_seen.add(impl)
        results = data.get("results", data) if isinstance(data, dict) else data
        is_traject = any("task_label" in r for r in results)
        benchmark = "traject-bench" if is_traject else "tau-bench"

        for i, entry in enumerate(results):
            if entry.get("status") == "error" and "tool_calls_made" not in entry:
                print(f"  Skipping errored task {entry.get('task_id', entry.get('task_label', i))}")
                continue

            formatted = format_task_for_analysis(entry, is_traject)
            task_id = formatted["task_id"]

            # Get comparison data
            comp_str = ""
            if task_id in comparison_data:
                comp = comparison_data[task_id]
                comp_str = (
                    f"Exact match: {comp.get('exact_match', 'N/A')}\n"
                    f"Missing tools: {comp.get('missing_tools', [])}\n"
                    f"Extra tools: {comp.get('extra_tools', [])}\n"
                    f"Param accuracy: {comp.get('param_accuracy', 'N/A')}\n"
                    f"Order correct: {comp.get('order_correct', 'N/A')}"
                )

            print(f"  Analyzing {task_id}...", end=" ", flush=True)
            start = time.time()

            analysis = analyze_single_task(
                client=client,
                task_id=task_id,
                implementation=impl,
                benchmark=benchmark,
                task_description=formatted["description"],
                ground_truth=formatted["ground_truth"],
                trajectory=formatted["trajectory"],
                comparison=comp_str or "No deterministic comparison available",
                policy_section="tau-bench" if not is_traject else "",
            )

            elapsed = time.time() - start
            print(f"{analysis.outcome} ({elapsed:.1f}s)")

            # Save individual analysis
            task_file = tasks_dir / f"{impl}_{task_id.replace(':', '_').replace('/', '_')}.json"
            with open(task_file, "w") as f:
                json.dump(asdict(analysis), f, indent=2)

            all_analyses.append(analysis)

    # Synthesis
    print(f"\n{'=' * 60}")
    print("  SYNTHESIZING FINDINGS")
    print(f"{'=' * 60}")
    print(
        f"  Analyzing {len(all_analyses)} task results across {len(implementations_seen)} implementations..."
    )

    synthesis = synthesize_findings(
        client=client,
        task_analyses=all_analyses,
        implementations=sorted(implementations_seen),
    )

    # Save synthesis
    synthesis_path = output_dir / "synthesis.json"
    with open(synthesis_path, "w") as f:
        json.dump(asdict(synthesis), f, indent=2)
    print(f"  Synthesis saved to {synthesis_path}")

    # Save all analyses
    all_path = output_dir / "all_analyses.json"
    with open(all_path, "w") as f:
        json.dump([asdict(a) for a in all_analyses], f, indent=2)
    print(f"  All analyses saved to {all_path}")

    # Print summary
    print(f"\n{'=' * 60}")
    print("  ERROR ANALYSIS SUMMARY")
    print(f"{'=' * 60}")

    outcomes = {}
    for a in all_analyses:
        outcomes[a.outcome] = outcomes.get(a.outcome, 0) + 1
    print(f"  Outcomes: {outcomes}")

    mode_counts: dict[str, int] = {}
    for a in all_analyses:
        for mode in a.failure_modes:
            mode_counts[mode] = mode_counts.get(mode, 0) + 1
    if mode_counts:
        print("  Failure modes (by frequency):")
        for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
            print(f"    {mode}: {count}")

    if synthesis.prioritized_recommendations:
        print("\n  Top recommendations:")
        for rec in synthesis.prioritized_recommendations[:3]:
            print(
                f"    #{rec.get('rank', '?')}: {rec.get('evaluator', '?')} — {rec.get('rationale', '')}"
            )

    # Generate markdown report
    report_path = output_dir.parent / "error_analysis_report.md"
    generate_report(all_analyses, synthesis, report_path)
    print(f"\n  Report saved to {report_path}")


def generate_report(
    analyses: list[TaskAnalysis],
    synthesis: SynthesisReport,
    output_path: Path,
) -> None:
    """Generate a markdown report from analysis results."""
    lines = ["# Scaled Error Analysis Report", ""]
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"Tasks analyzed: {len(analyses)}")
    lines.append("")

    # Outcomes
    lines.append("## Outcomes")
    lines.append("")
    outcomes: dict[str, int] = {}
    for a in analyses:
        outcomes[a.outcome] = outcomes.get(a.outcome, 0) + 1
    for outcome, count in sorted(outcomes.items()):
        lines.append(f"- **{outcome}**: {count}")
    lines.append("")

    # Failure mode frequency
    lines.append("## Failure Mode Frequency")
    lines.append("")
    lines.append("| Failure Mode | Count |")
    lines.append("|---|---|")
    mode_counts: dict[str, int] = {}
    for a in analyses:
        for mode in a.failure_modes:
            mode_counts[mode] = mode_counts.get(mode, 0) + 1
    for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {mode} | {count} |")
    lines.append("")

    # Cross-framework findings
    lines.append("## Cross-Framework Findings")
    lines.append("")
    lines.append(synthesis.cross_framework_findings)
    lines.append("")

    # Cross-benchmark findings
    lines.append("## Cross-Benchmark Findings")
    lines.append("")
    lines.append(synthesis.cross_benchmark_findings)
    lines.append("")

    # Prioritized recommendations
    lines.append("## Prioritized Recommendations")
    lines.append("")
    for rec in synthesis.prioritized_recommendations:
        rank = rec.get("rank", "?")
        evaluator = rec.get("evaluator", "?")
        modes = ", ".join(rec.get("failure_modes_caught", []))
        feasibility = rec.get("feasibility", "?")
        rationale = rec.get("rationale", "")
        lines.append(f"### #{rank}: {evaluator}")
        lines.append(f"- **Catches**: {modes}")
        lines.append(f"- **Feasibility**: {feasibility}")
        lines.append(f"- **Rationale**: {rationale}")
        lines.append("")

    # Evaluator mapping
    lines.append("## Failure Mode → Evaluator Mapping")
    lines.append("")
    lines.append("| Failure Mode | Evaluators |")
    lines.append("|---|---|")
    for mode, evaluators in synthesis.evaluator_mapping.items():
        evals_str = ", ".join(evaluators) if isinstance(evaluators, list) else str(evaluators)
        lines.append(f"| {mode} | {evals_str} |")
    lines.append("")

    # Surprising findings
    lines.append("## Surprising Findings")
    lines.append("")
    lines.append(synthesis.surprising_findings)
    lines.append("")

    # Per-task details
    lines.append("## Per-Task Analysis Details")
    lines.append("")
    by_impl: dict[str, list[TaskAnalysis]] = {}
    for a in analyses:
        by_impl.setdefault(a.implementation, []).append(a)

    for impl, tasks in sorted(by_impl.items()):
        lines.append(f"### {impl}")
        lines.append("")
        lines.append("| Task | Outcome | Failure Modes | Severity | Root Cause |")
        lines.append("|---|---|---|---|---|")
        for a in tasks:
            modes = ", ".join(a.failure_modes) if a.failure_modes else "-"
            cause = a.root_cause[:80] if a.root_cause else "-"
            lines.append(f"| {a.task_id} | {a.outcome} | {modes} | {a.severity} | {cause} |")
        lines.append("")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM-powered error analysis of agent trajectories")
    parser.add_argument(
        "--results",
        type=str,
        nargs="+",
        required=True,
        help="Results JSON files to analyze",
    )
    parser.add_argument(
        "--comparison",
        type=str,
        default=None,
        help="Comparison JSON file from compare_trajectories.py",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(_DEFAULT_OUTPUT_DIR),
        help=f"Output directory (default: {_DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    run_analysis(
        results_paths=args.results,
        comparison_path=args.comparison,
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
