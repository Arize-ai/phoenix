#!/usr/bin/env python3
"""Run full evaluation using the LLM judge and judgy for corrected metrics.

This script runs the finalized judge on all traces and uses judgy to compute
the corrected success rate with confidence intervals.
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from judgy import estimate_success_rate
from rich.console import Console

import phoenix as px
from phoenix.evals import OpenAIModel, llm_generate
from phoenix.trace import SpanEvaluations
from phoenix.trace.dsl import SpanQuery

load_dotenv()

console = Console()


def load_traces_from_phoenix() -> pd.DataFrame:
    """Load traces from Phoenix using SpanQuery."""
    console.print("[yellow]Loading traces from Phoenix...")

    try:
        query = SpanQuery().where("span_kind == 'CHAIN'")

        client = px.Client(endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT"))
        trace_df = client.query_spans(query, project_name="recipe-agent")

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


def output_parser(output: str, row_index: int) -> Dict[str, Any]:
    """Output parser function for Phoenix evals."""
    label_pattern = r'"label":\s*"([^"]*)"'
    explanation_pattern = r'"explanation":\s*"([^"]*)"'

    label_match = re.search(label_pattern, output, re.IGNORECASE)
    explanation_match = re.search(explanation_pattern, output, re.IGNORECASE)

    return {
        "label": label_match.group(1) if label_match else None,
        "explanation": explanation_match.group(1) if explanation_match else None,
    }


def run_judge_on_traces(
    judge_prompt: str, traces_df: pd.DataFrame
) -> Tuple[List[int], pd.DataFrame]:
    """Run the judge on all traces using Phoenix evals and return binary predictions."""

    console.print(f"[yellow]Running judge on {len(traces_df)} traces with Phoenix evals...")

    # Run the evaluation using Phoenix
    predictions = llm_generate(
        dataframe=traces_df,
        template=judge_prompt,
        model=OpenAIModel(model="gpt-4o", api_key=os.getenv("OPENAI_API_KEY")),
        verbose=True,
        output_parser=output_parser,
        include_prompt=True,
        include_response=True,
    )

    predictions = pd.merge(predictions, traces_df, left_index=True, right_index=True)

    console.print(f"[green]Completed labeling of {len(predictions)} traces")

    px.Client().log_evaluations(
        SpanEvaluations(eval_name="LLM-as-Judge Full Evaluation", dataframe=predictions)
    )

    predictions.rename(
        columns={"label": "llm_as_judge_label", "confidence": "llm_as_judge_confidence"},
        inplace=True,
    )

    console.print("[green]Completed LLM-as-Judge Evaluation, logged to Phoenix")

    # Convert to binary predictions for judgy
    binary_predictions = []
    for label in predictions["llm_as_judge_label"]:
        if label == "PASS":
            binary_predictions.append(1)
        elif label == "FAIL":
            binary_predictions.append(0)
        else:
            # Default to FAIL for unknown/error cases
            binary_predictions.append(0)

    return binary_predictions, predictions


def compute_metrics_with_judgy(
    test_labels: List[int], test_preds: List[int], unlabeled_preds: List[int]
) -> Tuple[float, float, float, float]:
    """Compute corrected success rate and confidence interval using judgy."""

    # Estimate true success rate with judgy
    theta_hat, lower_bound, upper_bound = estimate_success_rate(
        test_labels=test_labels, test_preds=test_preds, unlabeled_preds=unlabeled_preds
    )

    # Also compute raw observed success rate
    raw_success_rate = np.mean(unlabeled_preds)

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

    results = {
        "final_evaluation": {
            "total_traces_evaluated": total_traces,
            "raw_observed_success_rate": raw_success_rate,
            "corrected_success_rate": theta_hat,
            "confidence_interval_95": {"lower_bound": lower_bound, "upper_bound": upper_bound},
            "interpretation": {
                "description": "Corrected success rate accounts for judge errors (TPR/TNR)",
                "raw_vs_corrected": f"""Raw rate: {raw_success_rate:.3f},
                Corrected rate: {theta_hat:.3f}""",
            },
        }
    }

    results_path = results_dir / "final_evaluation.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    console.print(f"[green]Saved final results to {results_path}")


def print_interpretation(
    theta_hat: float, lower_bound: float, upper_bound: float, raw_success_rate: float
) -> None:
    """Print interpretation of results."""

    console.print("\n[bold]Final Results:")
    console.print("=" * 30)

    console.print(
        f"[blue]Raw Observed Success Rate: {raw_success_rate:.3f} ({raw_success_rate*100:.1f}%)"
    )
    console.print(f"[green]Corrected Success Rate: {theta_hat:.3f} ({theta_hat*100:.1f}%)")
    console.print(f"[yellow]95% Confidence Interval: [{lower_bound:.3f}, {upper_bound:.3f}]")
    console.print(
        f"[yellow]                        [{lower_bound*100:.1f}%, {upper_bound*100:.1f}%]"
    )

    correction_magnitude = abs(raw_success_rate - theta_hat)
    console.print(
        f"""[cyan]Correction Applied: {correction_magnitude:.3f}
        ({correction_magnitude*100:.1f} percentage points)"""
    )


def main():
    """Main function for full evaluation."""
    console.print("[bold blue]Full Recipe Bot Dietary Adherence Evaluation")
    console.print("=" * 60)

    # Set up paths
    script_dir = Path(__file__).parent
    hw3_dir = script_dir.parent
    results_dir = hw3_dir / "results"

    # Load judge prompt
    prompt_path = results_dir / "judge_prompt.txt"
    if not prompt_path.exists():
        console.print("[red]Error: Judge prompt not found!")
        console.print("[yellow]Please run develop_judge.py first.")
        return

    judge_prompt = load_judge_prompt(str(prompt_path))
    console.print("[green]Loaded judge prompt")

    # Load test set performance data for judgy
    judgy_path = results_dir / "judgy_test_data.json"
    if not judgy_path.exists():
        console.print("[red]Error: Test set performance data not found!")
        console.print("[yellow]Please run evaluate_judge.py first.")
        return

    test_labels, test_preds = load_test_data(str(judgy_path))
    console.print(f"[green]Loaded test set performance: {len(test_labels)} examples")

    # Load all traces from Phoenix
    all_traces = load_traces_from_phoenix()
    if all_traces.empty:
        console.print("[red]Error: No traces found in Phoenix!")
        console.print("[yellow]Please ensure traces have been generated and logged to Phoenix.")
        return

    console.print(f"[green]Loaded {len(all_traces)} valid traces from Phoenix for evaluation")

    # Run judge on all traces
    console.print("[yellow]Running judge on all traces... This will take a while.")
    binary_predictions, predictions_df = run_judge_on_traces(judge_prompt, all_traces)

    console.print(f"[green]Completed evaluation of {len(binary_predictions)} traces")
    console.print(f"[blue]Raw success rate: {np.mean(binary_predictions):.3f}")

    # Compute corrected metrics with judgy
    console.print("[yellow]Computing corrected success rate with judgy...")
    theta_hat, lower_bound, upper_bound, raw_success_rate = compute_metrics_with_judgy(
        test_labels, test_preds, binary_predictions
    )

    # Print and save results
    print_interpretation(theta_hat, lower_bound, upper_bound, raw_success_rate)
    save_final_results(
        theta_hat, lower_bound, upper_bound, raw_success_rate, len(all_traces), results_dir
    )

    console.print("\n[bold green]Full evaluation completed successfully!")
    console.print("[blue]Evaluation was performed on traces from Phoenix.")
    console.print("[blue]Check the results/ directory for detailed outputs.")


if __name__ == "__main__":
    main()
