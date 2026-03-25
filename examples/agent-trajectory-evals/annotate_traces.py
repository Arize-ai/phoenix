# mypy: ignore-errors
"""
Deep trajectory analysis and Phoenix trace annotation.

Reads all scaled run results, performs detailed failure mode analysis,
and writes structured annotations back to Phoenix traces.

Annotation scores written:
- task_completion: 1.0 (success), 0.5 (partial), 0.0 (failure)
- tool_selection_correct: 1.0 if all expected mutation tools called, 0.0 otherwise
- unnecessary_escalation: 1.0 if escalated when shouldn't have
- parameter_accuracy: 0.0-1.0 fraction of correct params
- trajectory_efficiency: ratio of minimum required calls to actual calls
- tool_error_handling: 1.0 (good), 0.0 (mishandled errors)
- policy_compliance: 1.0 (compliant), 0.0 (violated)
- compounding_errors: 1.0 if one error caused cascading failures

Each annotation includes an explanation comment.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import phoenix as px

# Prerequisite tools that are always correct to call (tau-bench)
PREREQUISITE_TOOLS = {
    "find_user_id_by_email",
    "find_user_id_by_name_zip",
    "get_user_details",
    "get_order_details",
    "get_product_details",
    "list_all_product_types",
    "think",
    "calculate",
}

# Mutation tools (the ones ground truth tracks)
MUTATION_TOOLS = {
    "cancel_pending_order",
    "modify_pending_order_address",
    "modify_pending_order_items",
    "modify_pending_order_payment",
    "return_delivered_order_items",
    "exchange_delivered_order_items",
    "transfer_to_human_agents",
}


@dataclass
class DetailedAnalysis:
    """Deep analysis of a single task trajectory."""

    task_id: str
    implementation: str
    project_name: str

    # Classification
    is_catastrophic: bool = False  # Agent completely failed the task
    is_suboptimal: bool = False  # Agent succeeded but inefficiently
    is_clean_success: bool = False  # Agent succeeded efficiently

    # Scores (0.0 - 1.0)
    task_completion: float = 0.0
    tool_selection_correct: float = 0.0
    unnecessary_escalation: float = 0.0
    parameter_accuracy: float = 0.0
    trajectory_efficiency: float = 0.0
    tool_error_handling: float = 1.0
    policy_compliance: float = 1.0
    compounding_errors: float = 0.0

    # Failure modes detected
    failure_modes: list[str] = field(default_factory=list)

    # Detailed explanations for each annotation
    explanations: dict = field(default_factory=dict)

    # Trace/session IDs for annotation
    trace_ids: list[str] = field(default_factory=list)
    session_id: str = ""


def analyze_taubench_task(entry: dict, impl: str) -> DetailedAnalysis:
    """Deep analysis of a single tau-bench task."""
    task_id = entry.get("task_id", "unknown")
    analysis = DetailedAnalysis(
        task_id=task_id,
        implementation=impl,
        project_name=f"tau-bench-{impl.split('-')[1] if '-' in impl else impl}-scaled",
    )

    # Filter to actual tool calls (not ToolCallOutputItem)
    all_calls = entry.get("tool_calls_made", [])
    actual_calls = [tc for tc in all_calls if tc.get("name")]
    actual_names = [tc["name"] for tc in actual_calls]
    actual_set = set(actual_names)

    expected_actions = entry.get("expected_actions", [])
    expected_names = [a["name"] for a in expected_actions]
    expected_set = set(expected_names)

    terminated_by = entry.get("terminated_by", "")
    turns = entry.get("turns", [])

    # --- TOOL SELECTION ---
    # For tau-bench, ground truth only has mutation tools.
    # Prerequisite tools (auth, lookup) are always correct.
    # So we compare mutation tools only.
    actual_mutations = [n for n in actual_names if n in MUTATION_TOOLS]
    actual_mutation_set = set(actual_mutations)
    expected_mutation_set = set(expected_names)  # GT is already mutation-only

    missing_mutations = expected_mutation_set - actual_mutation_set
    extra_mutations = actual_mutation_set - expected_mutation_set

    if not expected_mutation_set:
        # Zero-action task (e.g., dev:17)
        if actual_mutation_set:
            analysis.tool_selection_correct = 0.0
            analysis.failure_modes.append("wrong_tool_on_zero_action_task")
            analysis.explanations["tool_selection_correct"] = (
                f"Zero-action task but agent called mutation tools: {actual_mutation_set}. "
                f"Agent should have only used lookup tools and responded without mutations."
            )
        else:
            analysis.tool_selection_correct = 1.0
            analysis.explanations["tool_selection_correct"] = (
                "Zero-action task. Agent correctly avoided mutation tools."
            )
    elif not missing_mutations:
        analysis.tool_selection_correct = 1.0
        extra_str = f" Extra mutations called: {extra_mutations}." if extra_mutations else ""
        analysis.explanations["tool_selection_correct"] = (
            f"All {len(expected_mutation_set)} expected mutation tools were called.{extra_str}"
        )
    else:
        analysis.tool_selection_correct = 1.0 - (
            len(missing_mutations) / len(expected_mutation_set)
        )
        analysis.failure_modes.append("missing_mutation_tools")
        analysis.explanations["tool_selection_correct"] = (
            f"Missing {len(missing_mutations)}/{len(expected_mutation_set)} required mutations: "
            f"{missing_mutations}. Called: {actual_mutation_set or 'none'}."
        )

    # --- UNNECESSARY ESCALATION ---
    escalated = "transfer_to_human_agents" in actual_set
    should_escalate = "transfer_to_human_agents" in expected_set

    if escalated and not should_escalate:
        analysis.unnecessary_escalation = 1.0
        analysis.failure_modes.append("unnecessary_escalation")
        # Find what the agent said before escalating
        escalation_context = ""
        for i, tc in enumerate(actual_calls):
            if tc.get("name") == "transfer_to_human_agents":
                args = tc.get("arguments", tc.get("args", ""))
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        pass
                summary = args.get("summary", str(args)) if isinstance(args, dict) else str(args)
                escalation_context = summary[:200]
                break
        analysis.explanations["unnecessary_escalation"] = (
            f"Agent escalated to human when task was solvable. "
            f"Expected tools: {expected_names}. "
            f"Escalation reason: '{escalation_context}'"
        )
    else:
        analysis.unnecessary_escalation = 0.0
        if escalated and should_escalate:
            analysis.explanations["unnecessary_escalation"] = (
                "Correct escalation — task required human handoff."
            )
        else:
            analysis.explanations["unnecessary_escalation"] = "No escalation occurred."

    # --- PARAMETER ACCURACY ---
    param_correct = 0
    param_total = 0
    param_details = []
    for exp in expected_actions:
        exp_name = exp["name"]
        exp_kwargs = exp.get("kwargs", {})
        if not exp_kwargs:
            continue
        param_total += 1
        # Find matching actual call
        matched = False
        for tc in actual_calls:
            if tc.get("name") == exp_name:
                raw_args = tc.get("arguments", tc.get("args", "{}"))
                if isinstance(raw_args, str):
                    try:
                        actual_args = json.loads(raw_args)
                    except Exception:
                        actual_args = {}
                else:
                    actual_args = raw_args or {}

                # Compare params
                all_match = True
                mismatches = []
                for k, v in exp_kwargs.items():
                    actual_v = actual_args.get(k)
                    if str(actual_v) != str(v):
                        all_match = False
                        mismatches.append(f"{k}: expected={v}, got={actual_v}")
                if all_match:
                    param_correct += 1
                else:
                    param_details.append(f"{exp_name}: {'; '.join(mismatches)}")
                matched = True
                break
        if not matched:
            param_details.append(f"{exp_name}: tool not called")

    if param_total > 0:
        analysis.parameter_accuracy = param_correct / param_total
        if param_details:
            analysis.failure_modes.append("wrong_params")
            analysis.explanations["parameter_accuracy"] = (
                f"{param_correct}/{param_total} tools called with correct params. "
                f"Issues: {'; '.join(param_details[:3])}"
            )
        else:
            analysis.explanations["parameter_accuracy"] = (
                f"All {param_total} tool calls had correct parameters."
            )
    else:
        analysis.parameter_accuracy = 1.0
        analysis.explanations["parameter_accuracy"] = "No parameterized mutation tools expected."

    # --- TRAJECTORY EFFICIENCY ---
    # Minimum tools = prerequisites (auth + lookups) + expected mutations
    # A good agent needs: 1 auth + 1 get_user_details + N get_order_details + expected mutations
    min_prerequisite = 2  # auth + user details
    # Count unique orders referenced in expected actions
    order_ids = set()
    for exp in expected_actions:
        oid = exp.get("kwargs", {}).get("order_id", "")
        if oid:
            order_ids.add(oid)
    min_prerequisite += max(len(order_ids), 1)  # at least 1 order lookup
    min_total = min_prerequisite + len(expected_actions)
    actual_total = len(actual_calls)

    if actual_total > 0:
        analysis.trajectory_efficiency = min(1.0, min_total / actual_total)
    else:
        analysis.trajectory_efficiency = 0.0

    if analysis.trajectory_efficiency < 0.5:
        analysis.failure_modes.append("highly_inefficient_trajectory")
    elif analysis.trajectory_efficiency < 0.8:
        analysis.failure_modes.append("moderately_inefficient")

    analysis.explanations["trajectory_efficiency"] = (
        f"Minimum estimated calls: {min_total} (auth+lookups+mutations). "
        f"Actual calls: {actual_total}. "
        f"Efficiency: {analysis.trajectory_efficiency:.1%}. "
        f"Breakdown: {len([n for n in actual_names if n in PREREQUISITE_TOOLS])} prerequisite, "
        f"{len([n for n in actual_names if n in MUTATION_TOOLS])} mutation, "
        f"{len([n for n in actual_names if n not in PREREQUISITE_TOOLS and n not in MUTATION_TOOLS])} other."
    )

    # --- TOOL ERROR HANDLING ---
    # Check if agent mishandled get_order_details failures
    # Pattern: agent calls get_order_details, gets error, then escalates instead of retrying
    gave_up_after_error = False
    for i, tc in enumerate(actual_calls):
        if tc.get("name") == "get_order_details":
            # Check if next call is also get_order_details or escalation
            if i + 1 < len(actual_calls):
                next_call = actual_calls[i + 1]
                if next_call.get("name") == "transfer_to_human_agents":
                    gave_up_after_error = True
                elif next_call.get("name") == "think":
                    # Agent paused to think — check if it then escalated
                    if (
                        i + 2 < len(actual_calls)
                        and actual_calls[i + 2].get("name") == "transfer_to_human_agents"
                    ):
                        gave_up_after_error = True

    if gave_up_after_error and not should_escalate:
        analysis.tool_error_handling = 0.0
        analysis.failure_modes.append("tool_error_mishandled")
        analysis.explanations["tool_error_handling"] = (
            "Agent encountered a tool error (likely get_order_details) and escalated to human "
            "instead of retrying or working around the issue. The task was solvable."
        )
    else:
        analysis.tool_error_handling = 1.0
        analysis.explanations["tool_error_handling"] = "No tool error mishandling detected."

    # --- POLICY COMPLIANCE ---
    # Check: did agent call mutation tool before authentication?
    auth_tools = {"find_user_id_by_email", "find_user_id_by_name_zip"}
    auth_index = None
    for i, tc in enumerate(actual_calls):
        if tc.get("name") in auth_tools:
            auth_index = i
            break

    first_mutation_index = None
    for i, tc in enumerate(actual_calls):
        if tc.get("name") in MUTATION_TOOLS:
            first_mutation_index = i
            break

    if first_mutation_index is not None and (
        auth_index is None or first_mutation_index < auth_index
    ):
        analysis.policy_compliance = 0.0
        analysis.failure_modes.append("mutation_before_auth")
        analysis.explanations["policy_compliance"] = (
            "Agent called a mutation tool before authenticating the user. "
            "Policy requires user verification via email or name+zip first."
        )
    else:
        # Check: did agent call exchange/modify more than once per order?
        oneshot_tools = {"exchange_delivered_order_items", "modify_pending_order_items"}
        oneshot_counts = {}
        for tc in actual_calls:
            name = tc.get("name", "")
            if name in oneshot_tools:
                raw_args = tc.get("arguments", tc.get("args", "{}"))
                if isinstance(raw_args, str):
                    try:
                        args = json.loads(raw_args)
                    except Exception:
                        args = {}
                else:
                    args = raw_args or {}
                order_id = args.get("order_id", "unknown")
                key = f"{name}:{order_id}"
                oneshot_counts[key] = oneshot_counts.get(key, 0) + 1

        violations = {k: v for k, v in oneshot_counts.items() if v > 1}
        if violations:
            analysis.policy_compliance = 0.5
            analysis.failure_modes.append("oneshot_tool_called_multiple_times")
            analysis.explanations["policy_compliance"] = (
                f"Exchange/modify tools should only be called once per order. "
                f"Violations: {violations}"
            )
        else:
            analysis.policy_compliance = 1.0
            analysis.explanations["policy_compliance"] = "No policy violations detected."

    # --- COMPOUNDING ERRORS ---
    # Pattern: early error causes cascade of failures
    # E.g., auth failure -> can't get user details -> can't get orders -> escalation
    if (
        analysis.unnecessary_escalation > 0
        and analysis.tool_error_handling < 1.0
        and len(missing_mutations) > 0
    ):
        analysis.compounding_errors = 1.0
        analysis.failure_modes.append("compounding_errors")
        analysis.explanations["compounding_errors"] = (
            f"Error cascade detected: tool error led to unnecessary escalation, "
            f"which prevented {len(missing_mutations)} mutation tool(s) from being called. "
            f"Initial error compounded into complete task failure."
        )
    elif (
        analysis.unnecessary_escalation > 0
        and len(missing_mutations) == len(expected_mutation_set)
        and len(expected_mutation_set) > 0
    ):
        analysis.compounding_errors = 1.0
        analysis.failure_modes.append("compounding_errors")
        analysis.explanations["compounding_errors"] = (
            f"Premature escalation caused complete task failure. "
            f"All {len(expected_mutation_set)} expected mutations were skipped."
        )
    else:
        analysis.compounding_errors = 0.0
        analysis.explanations["compounding_errors"] = "No compounding error cascade detected."

    # --- OVERALL TASK COMPLETION ---
    if not expected_mutation_set:
        # Zero-action: success if no mutations made
        if not actual_mutation_set:
            analysis.task_completion = 1.0
        else:
            analysis.task_completion = 0.0
    elif not missing_mutations and not analysis.unnecessary_escalation:
        analysis.task_completion = 1.0
    elif missing_mutations and len(missing_mutations) < len(expected_mutation_set):
        analysis.task_completion = 0.5
    else:
        analysis.task_completion = 0.0

    # Classify
    if analysis.task_completion == 0.0:
        analysis.is_catastrophic = True
    elif analysis.task_completion == 1.0 and analysis.trajectory_efficiency >= 0.7:
        analysis.is_clean_success = True
    else:
        analysis.is_suboptimal = True

    analysis.explanations["task_completion"] = (
        f"{'CATASTROPHIC FAILURE' if analysis.is_catastrophic else 'SUBOPTIMAL' if analysis.is_suboptimal else 'CLEAN SUCCESS'}. "
        f"Expected mutations: {expected_names or '(none)'}. "
        f"Actual mutations: {[n for n in actual_names if n in MUTATION_TOOLS] or '(none)'}. "
        f"Terminated by: {terminated_by}. Turns: {len(turns)}."
    )

    return analysis


def analyze_traject_task(entry: dict) -> DetailedAnalysis:
    """Deep analysis of a single TRAJECT-Bench task."""
    task_id = entry.get("task_label", "unknown")
    traj_type = entry.get("trajectory_type", "parallel")

    analysis = DetailedAnalysis(
        task_id=task_id,
        implementation="traject-langgraph",
        project_name="traject-bench-langgraph-scaled",
    )

    actual_calls = entry.get("tool_calls_made", [])
    actual_names = [tc["name"] for tc in actual_calls]
    actual_set = set(actual_names)

    expected_calls = entry.get("tool_calls_expected", [])
    expected_names = [tc.get("func_name", tc.get("original_name", "")) for tc in expected_calls]
    expected_set = set(expected_names)

    missing = expected_set - actual_set

    # --- TOOL SELECTION ---
    if not missing:
        analysis.tool_selection_correct = 1.0
        analysis.explanations["tool_selection_correct"] = (
            f"All {len(expected_set)} expected tools called correctly."
        )
    else:
        analysis.tool_selection_correct = (
            1.0 - (len(missing) / len(expected_set)) if expected_set else 1.0
        )
        analysis.failure_modes.append("missing_tool")
        analysis.explanations["tool_selection_correct"] = (
            f"Missing {len(missing)}/{len(expected_set)} tools: {missing}."
        )

    # --- PARAMETER ACCURACY ---
    param_correct = 0
    param_total = 0
    param_issues = []
    for exp_tc in expected_calls:
        exp_name = exp_tc.get("func_name", exp_tc.get("original_name", ""))
        req_params = exp_tc.get("required_parameters", {})
        if isinstance(req_params, list):
            req_params = {p["name"]: p["value"] for p in req_params if "name" in p}
        if not req_params:
            continue
        param_total += 1

        for act_tc in actual_calls:
            if act_tc.get("name") == exp_name:
                act_args = act_tc.get("args", {})
                if isinstance(act_args, str):
                    try:
                        act_args = json.loads(act_args)
                    except (json.JSONDecodeError, TypeError):
                        act_args = {}
                if not isinstance(act_args, dict):
                    act_args = {}
                if "parameters" in act_args and len(act_args) == 1:
                    inner = act_args["parameters"]
                    act_args = inner if isinstance(inner, dict) else {}

                all_match = True
                for k, v in req_params.items():
                    if str(act_args.get(k, "")) != str(v):
                        all_match = False
                        param_issues.append(
                            f"{exp_name}.{k}: expected={v}, got={act_args.get(k, 'missing')}"
                        )
                if all_match:
                    param_correct += 1
                break

    if param_total > 0:
        analysis.parameter_accuracy = param_correct / param_total
        if param_issues:
            analysis.failure_modes.append("wrong_params")
    else:
        analysis.parameter_accuracy = 1.0

    analysis.explanations["parameter_accuracy"] = (
        f"{param_correct}/{param_total} tools with correct required params. "
        + (f"Issues: {'; '.join(param_issues[:3])}" if param_issues else "All params correct.")
    )

    # --- TRAJECTORY EFFICIENCY ---
    if actual_names:
        analysis.trajectory_efficiency = min(1.0, len(expected_names) / len(actual_names))
    else:
        analysis.trajectory_efficiency = 0.0

    analysis.explanations["trajectory_efficiency"] = (
        f"Expected {len(expected_names)} calls, made {len(actual_names)}. "
        f"Efficiency: {analysis.trajectory_efficiency:.1%}."
    )

    # --- TOOL ERROR HANDLING ---
    # Check if any tools returned errors and agent handled them
    error_response_count = 0
    for tc in actual_calls:
        args = tc.get("args", {})
        if "parameters" in args and args["parameters"] is None:
            error_response_count += 1
            analysis.failure_modes.append("null_params_sent")

    if error_response_count > 0:
        analysis.tool_error_handling = max(0.0, 1.0 - (error_response_count / len(actual_calls)))
        analysis.explanations["tool_error_handling"] = (
            f"{error_response_count} tool calls sent with null/empty parameters. "
            f"Agent may not have properly handled upstream errors or parameter dependencies."
        )
    else:
        analysis.explanations["tool_error_handling"] = "No error handling issues detected."

    # --- ORDERING (sequential only) ---
    if traj_type == "sequential":
        # Check if tools were called in correct order
        actual_order = [n for n in actual_names if n in expected_set]
        expected_order = [n for n in expected_names if n in actual_set]
        if actual_order and expected_order:
            # Check relative order preservation
            in_order = True
            for i in range(len(expected_order) - 1):
                try:
                    idx_a = actual_order.index(expected_order[i])
                    idx_b = actual_order.index(expected_order[i + 1])
                    if idx_a >= idx_b:
                        in_order = False
                        break
                except ValueError:
                    pass
            if not in_order:
                analysis.failure_modes.append("wrong_order")
                analysis.explanations["policy_compliance"] = (
                    f"Sequential task but tools called out of order. "
                    f"Expected order: {expected_order}. Actual order: {actual_order}."
                )
                analysis.policy_compliance = 0.5

    if "policy_compliance" not in analysis.explanations:
        analysis.policy_compliance = 1.0
        analysis.explanations["policy_compliance"] = "No ordering or policy issues."

    # --- TASK COMPLETION ---
    if not missing and analysis.parameter_accuracy >= 0.8:
        analysis.task_completion = 1.0
        analysis.is_clean_success = True
    elif not missing:
        analysis.task_completion = 0.75
        analysis.is_suboptimal = True
    elif len(missing) <= 1:
        analysis.task_completion = 0.5
        analysis.is_suboptimal = True
    else:
        analysis.task_completion = 0.0
        analysis.is_catastrophic = True

    analysis.explanations["task_completion"] = (
        f"{'CLEAN SUCCESS' if analysis.is_clean_success else 'SUBOPTIMAL' if analysis.is_suboptimal else 'CATASTROPHIC'}. "
        f"Type: {traj_type}. Missing tools: {missing or 'none'}. "
        f"Param accuracy: {analysis.parameter_accuracy:.0%}."
    )

    # No escalation concept in TRAJECT
    analysis.unnecessary_escalation = 0.0
    analysis.explanations["unnecessary_escalation"] = "N/A for TRAJECT-Bench."
    analysis.compounding_errors = 0.0
    analysis.explanations["compounding_errors"] = "N/A for TRAJECT-Bench."

    return analysis


def find_trace_ids_for_session(spans_df, session_id: str) -> list[str]:
    """Find all trace IDs for a given session."""
    session_spans = spans_df[spans_df["attributes.session.id"] == session_id]
    return list(session_spans["context.trace_id"].unique())


def find_trace_id_for_traject_task(spans_df, task_index: int) -> str | None:
    """Find the trace ID for a TRAJECT-Bench task by index."""
    # TRAJECT tasks are sequential, one trace per task
    traces = spans_df["context.trace_id"].unique()
    # Sort by start_time of root span
    trace_starts = []
    for tid in traces:
        trace_spans = spans_df[spans_df["context.trace_id"] == tid]
        root = trace_spans[trace_spans["parent_id"].isna()]
        if len(root) > 0:
            trace_starts.append((tid, root["start_time"].min()))
    trace_starts.sort(key=lambda x: x[1])
    if task_index < len(trace_starts):
        return trace_starts[task_index][0]
    return None


def write_annotations(client, analysis: DetailedAnalysis, spans_df) -> int:
    """Write all annotations as span evaluations to Phoenix.

    Uses SpanEvaluations (the working API in this Phoenix version) to annotate
    the root spans of each trace associated with this task.
    """
    import pandas as pd

    from phoenix.trace.span_evaluations import SpanEvaluations

    scores_map = {
        "task_completion": analysis.task_completion,
        "tool_selection_correct": analysis.tool_selection_correct,
        "unnecessary_escalation": analysis.unnecessary_escalation,
        "parameter_accuracy": analysis.parameter_accuracy,
        "trajectory_efficiency": analysis.trajectory_efficiency,
        "tool_error_handling": analysis.tool_error_handling,
        "policy_compliance": analysis.policy_compliance,
        "compounding_errors": analysis.compounding_errors,
    }

    labels_map = {
        "task_completion": (
            "catastrophic_failure"
            if analysis.is_catastrophic
            else "suboptimal"
            if analysis.is_suboptimal
            else "clean_success"
        ),
        "tool_selection_correct": "correct"
        if analysis.tool_selection_correct >= 0.8
        else "incorrect",
        "unnecessary_escalation": "escalated"
        if analysis.unnecessary_escalation > 0
        else "no_escalation",
        "parameter_accuracy": "correct" if analysis.parameter_accuracy >= 0.8 else "incorrect",
        "trajectory_efficiency": (
            "efficient"
            if analysis.trajectory_efficiency >= 0.7
            else "inefficient"
            if analysis.trajectory_efficiency >= 0.4
            else "very_inefficient"
        ),
        "tool_error_handling": "handled" if analysis.tool_error_handling >= 0.8 else "mishandled",
        "policy_compliance": "compliant" if analysis.policy_compliance >= 0.8 else "violated",
        "compounding_errors": "cascade" if analysis.compounding_errors > 0 else "no_cascade",
    }

    annotation_count = 0

    # Find root span IDs for each trace (root = no parent)
    root_span_ids = []
    for trace_id in analysis.trace_ids:
        trace_spans = spans_df[spans_df["context.trace_id"] == trace_id]
        roots = trace_spans[trace_spans["parent_id"].isna()]
        if len(roots) > 0:
            root_span_ids.append(roots.index[0])

    if not root_span_ids:
        return 0

    # Write one SpanEvaluations per score type
    for eval_name, score in scores_map.items():
        label = labels_map.get(eval_name, "")
        explanation = analysis.explanations.get(eval_name, "")

        eval_df = pd.DataFrame(
            {
                "context.span_id": root_span_ids,
                "label": [label] * len(root_span_ids),
                "score": [score] * len(root_span_ids),
                "explanation": [explanation] * len(root_span_ids),
            }
        )
        eval_df = eval_df.set_index("context.span_id")

        try:
            evals = SpanEvaluations(eval_name=eval_name, dataframe=eval_df)
            client.log_evaluations(evals)
            annotation_count += len(root_span_ids)
        except Exception as e:
            print(f"    Warning: Failed to write {eval_name}: {e}")

    return annotation_count


def main():
    print("=" * 70)
    print("  DEEP TRAJECTORY ANALYSIS & PHOENIX ANNOTATION")
    print("=" * 70)

    client = px.Client()
    results_dir = Path("results/scaled")
    all_analyses: list[DetailedAnalysis] = []
    total_annotations = 0

    # Load spans DataFrames for trace ID lookup
    print("\nLoading Phoenix spans data...")
    spans_data = {}
    for proj in [
        "tau-bench-openai-scaled",
        "tau-bench-langgraph-scaled",
        "traject-bench-langgraph-scaled",
    ]:
        df = client.get_spans_dataframe(project_name=proj)
        if df is not None and not df.empty:
            spans_data[proj] = df
            print(f"  {proj}: {len(df)} spans, {df['context.trace_id'].nunique()} traces")
        else:
            print(f"  {proj}: no data!")

    # ========================================================================
    # TAU-BENCH: OpenAI Agents SDK
    # ========================================================================
    print(f"\n{'=' * 70}")
    print("  TAU-BENCH + OPENAI AGENTS SDK")
    print(f"{'=' * 70}")

    with open(results_dir / "tau_openai_20260324_220933.json") as f:
        tau_openai_data = json.load(f)

    proj = "tau-bench-openai-scaled"
    spans_df = spans_data.get(proj)

    for entry in tau_openai_data["results"]:
        analysis = analyze_taubench_task(entry, "tau-openai")
        analysis.project_name = proj

        # Find trace IDs via session
        task_id = entry.get("task_id", "unknown")
        if spans_df is not None:
            # Session format: tau-bench-task-{split}:{idx}-{uuid}
            # Match by prefix: "tau-bench-task-{task_id}-"
            prefix = f"tau-bench-task-{task_id}-"
            sessions = [
                s
                for s in spans_df["attributes.session.id"].unique()
                if s is not None and s.startswith(prefix)
            ]
            if sessions:
                analysis.session_id = sessions[0]
                analysis.trace_ids = find_trace_ids_for_session(spans_df, sessions[0])

        # Print
        status = (
            "🔴 CATASTROPHIC"
            if analysis.is_catastrophic
            else "🟡 SUBOPTIMAL"
            if analysis.is_suboptimal
            else "🟢 SUCCESS"
        )
        print(f"\n  {task_id}: {status}")
        print(
            f"    Completion: {analysis.task_completion:.0%} | Efficiency: {analysis.trajectory_efficiency:.0%}"
        )
        if analysis.failure_modes:
            print(f"    Failure modes: {', '.join(analysis.failure_modes)}")
        if analysis.trace_ids:
            print(
                f"    Writing {len(analysis.trace_ids)} trace annotations × 8 scores...",
                end=" ",
                flush=True,
            )
            n = write_annotations(client, analysis, spans_df)
            total_annotations += n
            print(f"done ({n})")
        else:
            print(f"    ⚠ No traces found for session matching '{task_id}'")

        all_analyses.append(analysis)

    # ========================================================================
    # TAU-BENCH: LangGraph
    # ========================================================================
    print(f"\n{'=' * 70}")
    print("  TAU-BENCH + LANGGRAPH")
    print(f"{'=' * 70}")

    with open(results_dir / "tau_langgraph_20260324_222012.json") as f:
        tau_lg_data = json.load(f)

    proj = "tau-bench-langgraph-scaled"
    spans_df = spans_data.get(proj)

    for entry in tau_lg_data["results"]:
        analysis = analyze_taubench_task(entry, "tau-langgraph")
        analysis.project_name = proj

        task_id = entry.get("task_id", "unknown")
        if spans_df is not None:
            prefix = f"tau-bench-task-{task_id}-"
            sessions = [
                s
                for s in spans_df["attributes.session.id"].unique()
                if s is not None and s.startswith(prefix)
            ]
            if sessions:
                analysis.session_id = sessions[0]
                analysis.trace_ids = find_trace_ids_for_session(spans_df, sessions[0])

        status = (
            "🔴 CATASTROPHIC"
            if analysis.is_catastrophic
            else "🟡 SUBOPTIMAL"
            if analysis.is_suboptimal
            else "🟢 SUCCESS"
        )
        print(f"\n  {task_id}: {status}")
        print(
            f"    Completion: {analysis.task_completion:.0%} | Efficiency: {analysis.trajectory_efficiency:.0%}"
        )
        if analysis.failure_modes:
            print(f"    Failure modes: {', '.join(analysis.failure_modes)}")
        if analysis.trace_ids:
            print(
                f"    Writing {len(analysis.trace_ids)} trace annotations × 8 scores...",
                end=" ",
                flush=True,
            )
            n = write_annotations(client, analysis, spans_df)
            total_annotations += n
            print(f"done ({n})")
        else:
            print(f"    ⚠ No traces found for session matching '{task_id}'")

        all_analyses.append(analysis)

    # ========================================================================
    # TRAJECT-BENCH: LangGraph
    # ========================================================================
    print(f"\n{'=' * 70}")
    print("  TRAJECT-BENCH + LANGGRAPH")
    print(f"{'=' * 70}")

    with open(results_dir / "traject_langgraph_20260324_222733.json") as f:
        traject_data = json.load(f)

    proj = "traject-bench-langgraph-scaled"
    spans_df = spans_data.get(proj)

    for i, entry in enumerate(traject_data["results"]):
        analysis = analyze_traject_task(entry)
        analysis.project_name = proj

        if spans_df is not None:
            trace_id = find_trace_id_for_traject_task(spans_df, i)
            if trace_id:
                analysis.trace_ids = [trace_id]

        status = (
            "🔴 CATASTROPHIC"
            if analysis.is_catastrophic
            else "🟡 SUBOPTIMAL"
            if analysis.is_suboptimal
            else "🟢 SUCCESS"
        )
        print(f"\n  {analysis.task_id}: {status}")
        print(
            f"    Completion: {analysis.task_completion:.0%} | Efficiency: {analysis.trajectory_efficiency:.0%}"
        )
        if analysis.failure_modes:
            print(f"    Failure modes: {', '.join(analysis.failure_modes)}")
        if analysis.trace_ids:
            print(
                f"    Writing {len(analysis.trace_ids)} trace annotations × 8 scores...",
                end=" ",
                flush=True,
            )
            n = write_annotations(client, analysis, spans_df)
            total_annotations += n
            print(f"done ({n})")
        else:
            print(f"    ⚠ No trace found for task index {i}")

        all_analyses.append(analysis)

    # ========================================================================
    # SUMMARY REPORT
    # ========================================================================
    print(f"\n{'=' * 70}")
    print("  ANNOTATION SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Total analyses: {len(all_analyses)}")
    print(f"  Total annotations written to Phoenix: {total_annotations}")

    catastrophic = [a for a in all_analyses if a.is_catastrophic]
    suboptimal = [a for a in all_analyses if a.is_suboptimal]
    clean = [a for a in all_analyses if a.is_clean_success]

    print(
        f"\n  🔴 Catastrophic failures: {len(catastrophic)}/{len(all_analyses)} ({len(catastrophic) / len(all_analyses):.0%})"
    )
    print(
        f"  🟡 Suboptimal successes: {len(suboptimal)}/{len(all_analyses)} ({len(suboptimal) / len(all_analyses):.0%})"
    )
    print(
        f"  🟢 Clean successes: {len(clean)}/{len(all_analyses)} ({len(clean) / len(all_analyses):.0%})"
    )

    # Failure mode frequency
    mode_counts = {}
    for a in all_analyses:
        for m in a.failure_modes:
            mode_counts[m] = mode_counts.get(m, 0) + 1

    print("\n  Failure mode frequency:")
    for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
        print(f"    {mode}: {count}")

    # Save full analysis
    output = []
    for a in all_analyses:
        output.append(
            {
                "task_id": a.task_id,
                "implementation": a.implementation,
                "is_catastrophic": a.is_catastrophic,
                "is_suboptimal": a.is_suboptimal,
                "is_clean_success": a.is_clean_success,
                "task_completion": a.task_completion,
                "tool_selection_correct": a.tool_selection_correct,
                "unnecessary_escalation": a.unnecessary_escalation,
                "parameter_accuracy": a.parameter_accuracy,
                "trajectory_efficiency": a.trajectory_efficiency,
                "tool_error_handling": a.tool_error_handling,
                "policy_compliance": a.policy_compliance,
                "compounding_errors": a.compounding_errors,
                "failure_modes": a.failure_modes,
                "explanations": a.explanations,
                "trace_ids": a.trace_ids,
                "session_id": a.session_id,
            }
        )

    out_path = results_dir / "detailed_analysis.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n  Detailed analysis saved to {out_path}")


if __name__ == "__main__":
    main()
