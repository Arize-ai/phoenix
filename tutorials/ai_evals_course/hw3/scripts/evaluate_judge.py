#!/usr/bin/env python3
"""Evaluate the LLM judge performance on the test set.

This script evaluates the finalized LLM judge on the test set to get
unbiased estimates of TPR and TNR for use with judgy.
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd
from dotenv import load_dotenv
from rich.console import Console

import phoenix as px
from phoenix.evals import OpenAIModel, llm_generate

load_dotenv()

console = Console()


def load_data_split(csv_path: str) -> List[Dict[str, Any]]:
    """Load a data split from CSV file."""
    df = pd.read_csv(csv_path)
    return df


def load_judge_prompt(prompt_path: str) -> str:
    """Load the judge prompt from file."""
    with open(prompt_path, "r") as f:
        return f.read()


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


def evaluate_judge_on_test(
    judge_prompt: str, test_traces: pd.DataFrame
) -> Tuple[float, float, pd.DataFrame]:
    """Evaluate the judge prompt on the test set using Phoenix evals."""

    console.print(
        f"[yellow]Evaluating judge on {len(test_traces)} test traces with Phoenix evals..."
    )

    # Run the evaluation using Phoenix
    predictions = llm_generate(
        dataframe=test_traces,
        template=judge_prompt,
        model=OpenAIModel(model="gpt-4o", api_key=os.getenv("OPENAI_API_KEY")),
        verbose=True,
        output_parser=output_parser,
        include_prompt=True,
        include_response=True,
    )

    predictions = pd.merge(predictions, test_traces, left_index=True, right_index=True)

    console.print(f"[green]Completed labeling of {len(predictions)} traces")

    predictions.set_index(test_traces.index)

    from phoenix.trace import SpanEvaluations

    px.Client().log_evaluations(
        SpanEvaluations(eval_name="LLM-as-Judge Test Evaluation", dataframe=predictions)
    )

    predictions.rename(
        columns={"label": "llm_as_judge_label", "confidence": "llm_as_judge_confidence"},
        inplace=True,
    )

    console.print("[green]Completed LLM-as-Judge Evaluation, logged to Phoenix")

    # Calculate TPR and TNR
    tp = (
        (predictions["ground_truth_label"] == "PASS")
        & (predictions["llm_as_judge_label"] == "PASS")
    ).sum()
    fn = (
        (predictions["ground_truth_label"] == "PASS")
        & (predictions["llm_as_judge_label"] == "FAIL")
    ).sum()
    tn = (
        (predictions["ground_truth_label"] == "FAIL")
        & (predictions["llm_as_judge_label"] == "FAIL")
    ).sum()
    fp = (
        (predictions["ground_truth_label"] == "FAIL")
        & (predictions["llm_as_judge_label"] == "PASS")
    ).sum()

    tpr = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    tnr = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    return tpr, tnr, predictions


def analyze_errors(predictions: pd.DataFrame) -> None:
    """Analyze prediction errors to understand judge performance."""

    # False positives (predicted PASS but actually FAIL)
    false_positives = predictions[
        (predictions["ground_truth_label"] == "FAIL")
        & (predictions["llm_as_judge_label"] == "PASS")
    ]

    # False negatives (predicted FAIL but actually PASS)
    false_negatives = predictions[
        (predictions["ground_truth_label"] == "PASS")
        & (predictions["llm_as_judge_label"] == "FAIL")
    ]

    console.print("\n[bold]Error Analysis:")
    console.print(f"False Positives: {len(false_positives)}")
    console.print(f"False Negatives: {len(false_negatives)}")

    if len(false_positives) > 0:
        console.print("\n[red]Sample False Positives (Judge said PASS, should be FAIL):")
        for i, (_, fp) in enumerate(false_positives.head(3).iterrows(), 1):
            console.print(f"{i}. {fp['attributes.dietary_restriction']}: {fp['attributes.query']}")
            console.print(f"   Reasoning: {fp['explanation'][:100]}...")

    if len(false_negatives) > 0:
        console.print("\n[yellow]Sample False Negatives (Judge said FAIL, should be PASS):")
        for i, (_, fn) in enumerate(false_negatives.head(3).iterrows(), 1):
            console.print(f"{i}. {fn['attributes.dietary_restriction']}: {fn['attributes.query']}")
            console.print(f"   Reasoning: {fn['explanation'][:100]}...")


def save_results(tpr: float, tnr: float, predictions: pd.DataFrame, results_dir: Path) -> None:
    """Save evaluation results."""

    # Save performance metrics
    performance = {
        "test_set_performance": {
            "true_positive_rate": float(tpr),
            "true_negative_rate": float(tnr),
            "balanced_accuracy": float((tpr + tnr) / 2),
            "total_predictions": int(len(predictions)),
            "correct_predictions": int(
                (predictions["ground_truth_label"] == predictions["llm_as_judge_label"]).sum()
            ),
            "accuracy": float(
                (predictions["ground_truth_label"] == predictions["llm_as_judge_label"]).mean()
            ),
        }
    }

    performance_path = results_dir / "judge_performance.json"
    with open(performance_path, "w") as f:
        json.dump(performance, f, indent=2)
    console.print(f"[green]Saved performance metrics to {performance_path}")

    # Save detailed predictions
    predictions_path = results_dir / "test_predictions.json"
    predictions.to_json(predictions_path)
    console.print(f"[green]Saved test predictions to {predictions_path}")

    # Save predictions in format for judgy
    test_labels = [1 if label == "PASS" else 0 for label in predictions["ground_truth_label"]]
    test_preds = [1 if label == "PASS" else 0 for label in predictions["llm_as_judge_label"]]

    judgy_data = {
        "test_labels": test_labels,
        "test_preds": test_preds,
        "description": "Test set labels and predictions for judgy evaluation",
    }

    judgy_path = results_dir / "judgy_test_data.json"
    with open(judgy_path, "w") as f:
        json.dump(judgy_data, f, indent=2)
    console.print(f"[green]Saved judgy test data to {judgy_path}")


def main():
    """Main function to evaluate the judge on test set."""
    console.print("[bold blue]LLM Judge Test Set Evaluation")
    console.print("=" * 50)

    # Set up paths
    script_dir = Path(__file__).parent
    hw3_dir = script_dir.parent
    data_dir = hw3_dir / "data"
    results_dir = hw3_dir / "results"

    # Load test set
    test_path = data_dir / "test_set.csv"
    if not test_path.exists():
        console.print("[red]Error: Test set not found!")
        console.print("[yellow]Please run split_data.py first.")
        return

    test_traces = load_data_split(str(test_path))
    console.print(f"[green]Loaded {len(test_traces)} test traces")

    # Load judge prompt
    prompt_path = results_dir / "judge_prompt.txt"
    if not prompt_path.exists():
        console.print("[red]Error: Judge prompt not found!")
        console.print("[yellow]Please run develop_judge.py first.")
        return

    judge_prompt = load_judge_prompt(str(prompt_path))
    console.print("[green]Loaded judge prompt")

    # Evaluate judge on test set
    console.print("[yellow]Evaluating judge on test set... This may take a while.")
    tpr, tnr, predictions = evaluate_judge_on_test(judge_prompt, test_traces)

    # Print results
    console.print("\n[bold]Judge Performance on Test Set:")
    console.print(f"True Positive Rate (TPR): {tpr:.3f}")
    console.print(f"True Negative Rate (TNR): {tnr:.3f}")
    console.print(f"Balanced Accuracy: {(tpr + tnr) / 2:.3f}")
    console.print(
        f"""Overall Accuracy:
        {(predictions["ground_truth_label"] == predictions["llm_as_judge_label"]).mean():.3f}"""
    )

    # Analyze errors
    analyze_errors(predictions)

    # Save results
    save_results(tpr, tnr, predictions, results_dir)

    console.print("\n[bold green]Test set evaluation completed!")
    console.print("[blue]Results saved for use with judgy in the final evaluation step.")


if __name__ == "__main__":
    main()
