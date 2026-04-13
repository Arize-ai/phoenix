#!/usr/bin/env python3
"""Run full evaluation using the LLM judge and judgy for corrected metrics.

This script runs the finalized judge on all traces and uses judgy to compute
the corrected success rate with confidence intervals.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from judgy import estimate_success_rate  # type: ignore[import-not-found]
from phoenix.client import Client
from phoenix.client.types.spans import SpanQuery
from phoenix.evals import (
    LLM,
    ClassificationEvaluator,
    evaluate_dataframe,
)
from rich.console import Console

load_dotenv()

console = Console()

# Mapping from dotted Phoenix column names to clean template variable names
COLUMN_TO_VARIABLE: Dict[str, str] = {
    "attributes.query": "query",
    "attributes.dietary_restriction": "dietary_restriction",
    "attributes.output.value": "output",
}


def load_traces_from_phoenix() -> pd.DataFrame:
    """Load traces from Phoenix using SpanQuery."""
    console.print("[yellow]Loading traces from Phoenix...")

    try:
        query = SpanQuery().where("span_kind == 'CHAIN'")

        client = Client()
        trace_df = client.spans.get_spans_dataframe(query=query, project_identifier="recipe-agent")

        if trace_df.empty:
            console.print("[red]No traces found in Phoenix!")
            return pd.DataFrame()

        console.print(f"[green]Loaded {len(trace_df)} traces from Phoenix")
        return trace_df

    except Exception as e:
        console.print(f"[red]Error loading traces from Phoenix: {str(e)}")
        console.print("[yellow]Please check your Phoenix configuration and ensure traces exist.")
        return pd.DataFrame()


def load_judge_prompt(prompt_path: str) -> str:
    """Load the judge prompt from file."""
    with open(prompt_path, "r") as f:
        return f.read()


def load_test_data(judgy_path: str) -> Tuple[List[int], List[int]]:
    """Load test labels and predictions for judgy."""
    with open(judgy_path, "r") as f:
        data = json.load(f)
    return data["test_labels"], data["test_preds"]


def _normalize_prompt_variables(prompt: str) -> str:
    """Replace dotted Phoenix column placeholders with clean variable names.

    E.g. {attributes.query} -> {query}
    """
    for dotted, clean in COLUMN_TO_VARIABLE.items():
        prompt = prompt.replace(f"{{{dotted}}}", f"{{{clean}}}")
    return prompt


def _strip_json_format_instruction(prompt: str) -> str:
    """Remove JSON format instructions from the prompt.

    ClassificationEvaluator uses tool calling to structure output,
    so explicit JSON formatting instructions are unnecessary.
    """
    # Remove lines asking for JSON format
    prompt = re.sub(
        r"MAKE SURE TO RETURN YOUR EVALUATION IN THE FOLLOWING JSON FORMAT:.*",
        "Return a label of PASS or FAIL and your explanation.",
        prompt,
        flags=re.DOTALL,
    )
    return prompt.strip()


def run_judge_on_traces(
    judge_prompt: str, traces_df: pd.DataFrame
) -> Tuple[List[int], pd.DataFrame]:
    """Run the judge on all traces and return binary predictions."""

    console.print(f"[yellow]Running judge on {len(traces_df)} traces with Phoenix evals...")

    # Normalize the prompt: replace dotted column names with clean variables,
    # and remove JSON format instructions (ClassificationEvaluator uses tool calling)
    clean_prompt = _normalize_prompt_variables(judge_prompt)
    clean_prompt = _strip_json_format_instruction(clean_prompt)

    # Set up ClassificationEvaluator
    model = LLM(provider="openai", model="gpt-4o")

    evaluator = ClassificationEvaluator(
        name="judge",
        llm=model,
        prompt_template=clean_prompt,
        choices={"PASS": 1.0, "FAIL": 0.0},
    )

    # Rename dotted column names so the evaluator template variables resolve correctly
    eval_df = traces_df.rename(columns={k: v for k, v in COLUMN_TO_VARIABLE.items()})

    # Run evaluation
    results_df = evaluate_dataframe(
        dataframe=eval_df,
        evaluators=[evaluator],
    )

    # Extract labels from score column
    score_data = results_df["judge_score"]
    results_df["label"] = score_data.apply(
        lambda x: x.get("label") if isinstance(x, dict) else None
    )
    results_df["explanation"] = score_data.apply(
        lambda x: x.get("explanation") if isinstance(x, dict) else None
    )

    console.print(f"[green]Completed labeling of {len(results_df)} traces")

    # Log to Phoenix
    px_client = Client()
    px_client.spans.log_span_annotations_dataframe(
        dataframe=results_df,
        annotation_name="LLM-as-Judge Evaluation",
        annotator_kind="LLM",
    )

    results_df = results_df.rename(
        columns={
            "label": "llm_as_judge_label",
            "explanation": "llm_as_judge_explanation",
        },
    )

    console.print("[green]Completed LLM-as-Judge Evaluation, logged to Phoenix")

    # Convert to binary predictions for judgy
    binary_predictions: List[int] = []
    for label in results_df["llm_as_judge_label"]:
        if label == "PASS":
            binary_predictions.append(1)
        elif label == "FAIL":
            binary_predictions.append(0)
        else:
            # Default to FAIL for unknown/error cases
            binary_predictions.append(0)

    return binary_predictions, results_df


def compute_metrics_with_judgy(
    test_labels: List[int],
    test_preds: List[int],
    unlabeled_preds: List[int],
) -> Tuple[float, float, float, float]:
    """Compute corrected success rate and confidence interval using judgy."""

    # Estimate true success rate with judgy
    theta_hat, lower_bound, upper_bound = estimate_success_rate(
        test_labels=test_labels,
        test_preds=test_preds,
        unlabeled_preds=unlabeled_preds,
    )

    # Also compute raw observed success rate
    raw_success_rate = float(np.mean(unlabeled_preds))

    return theta_hat, lower_bound, upper_bound, raw_success_rate


def save_final_results(
    theta_hat: float,
    lower_bound: float,
    upper_bound: float,
    raw_success_rate: float,
    total_traces: int,
    results_dir: Path,
) -> None:
    """Save final evaluation results."""

    results: Dict[str, Any] = {
        "final_evaluation": {
            "total_traces_evaluated": total_traces,
            "raw_observed_success_rate": raw_success_rate,
            "corrected_success_rate": theta_hat,
            "confidence_interval_95": {
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
            },
            "interpretation": {
                "description": ("Corrected success rate accounts for judge errors (TPR/TNR)"),
                "raw_vs_corrected": (
                    f"Raw rate: {raw_success_rate:.3f}, Corrected rate: {theta_hat:.3f}"
                ),
            },
        }
    }

    results_path = results_dir / "final_evaluation.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    console.print(f"[green]Saved final results to {results_path}")


def print_interpretation(
    theta_hat: float,
    lower_bound: float,
    upper_bound: float,
    raw_success_rate: float,
) -> None:
    """Print interpretation of results."""

    console.print("\n[bold]Final Results:")
    console.print("=" * 30)

    console.print(
        f"[blue]Raw Observed Success Rate: {raw_success_rate:.3f} ({raw_success_rate * 100:.1f}%)"
    )
    console.print(f"[green]Corrected Success Rate: {theta_hat:.3f} ({theta_hat * 100:.1f}%)")
    console.print(f"[yellow]95% Confidence Interval: [{lower_bound:.3f}, {upper_bound:.3f}]")
    console.print(
        f"[yellow]                        [{lower_bound * 100:.1f}%, {upper_bound * 100:.1f}%]"
    )

    correction_magnitude = abs(raw_success_rate - theta_hat)
    console.print(
        f"[cyan]Correction Applied: {correction_magnitude:.3f} "
        f"({correction_magnitude * 100:.1f} percentage points)"
    )
