#!/usr/bin/env python3
"""Evaluate the LLM judge performance on the test set.

This script evaluates the finalized LLM judge on the test set to get
unbiased estimates of TPR and TNR for use with judgy.
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Tuple

import litellm
import pandas as pd
import requests
from dotenv import load_dotenv
from rich.console import Console

from phoenix.client import Client
from phoenix.client.experiments import run_experiment
from phoenix.otel import register

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

tracer_provider = register(project_name="recipe-agent", batch=True, auto_instrument=True)

console = Console()


def load_data_split(csv_path: str) -> pd.DataFrame:
    """Load a data split from CSV file."""
    df = pd.read_csv(csv_path)
    return df


def load_judge_prompt(prompt_path: str) -> str:
    """Load the judge prompt from file."""
    with open(prompt_path, "r") as f:
        return f.read()


def generate_eval_prompt(input, metadata, base_prompt):
    """Generate evaluation prompt for a single example."""
    formatted_prompt = base_prompt.replace("{attributes.query}", str(input.get("attributes.query")))
    formatted_prompt = formatted_prompt.replace(
        "{attributes.dietary_restriction}",
        str(metadata.get("attributes.dietary_restriction")),
    )
    formatted_prompt = formatted_prompt.replace(
        "{attributes.output.value}", str(metadata.get("attributes.output.value"))
    )

    return formatted_prompt


def create_task_function(base_prompt):
    """Create a task function that uses the provided base prompt."""

    def task(input, metadata):
        eval_prompt = generate_eval_prompt(input, metadata, base_prompt)
        completion = litellm.completion(
            model="gpt-4o",
            messages=[{"role": "user", "content": eval_prompt}],
            response_format={"type": "json_object"},
        )
        return json.loads(completion.choices[0].message.content)

    return task


def eval_tp(metadata, output):
    """Evaluate true positive."""
    label = output.get("label")
    tp = (metadata["ground_truth_label"] == "PASS") & (label.lower() == "pass")
    return tp


def eval_tn(metadata, output):
    """Evaluate true negative."""
    label = output.get("label")
    tn = (metadata["ground_truth_label"] == "FAIL") & (label.lower() == "fail")
    return tn


def eval_fp(metadata, output):
    """Evaluate false positive."""
    label = output.get("label")
    fp = (metadata["ground_truth_label"] == "FAIL") & (label.lower() == "pass")
    return fp


def eval_fn(metadata, output):
    """Evaluate false negative."""
    label = output.get("label")
    fn = (metadata["ground_truth_label"] == "PASS") & (label.lower() == "fail")
    return fn


def accuracy(metadata, output):
    """Evaluate accuracy."""
    label = output.get("label")
    accuracy = metadata["ground_truth_label"].lower() == label.lower()
    return accuracy


def evaluate_judge_on_test(
    judge_prompt: str, test_traces: pd.DataFrame
) -> Tuple[float, float, pd.DataFrame]:
    """Evaluate the judge prompt on the test set using Phoenix experiments."""

    console.print(
        f"[yellow]Evaluating judge on {len(test_traces)} test traces with Phoenix experiments..."
    )

    # Set up Phoenix client
    phoenix_client = Client()

    # Upload test dataset to Phoenix
    test_dataset = phoenix_client.datasets.create_dataset(
        dataframe=test_traces,
        name="test_set",
        input_keys=["attributes.query"],
        output_keys=[],
        metadata_keys=[
            "attributes.output.value",
            "ground_truth_label",
            "ground_truth_explanation",
            "attributes.dietary_restriction",
            "attributes.trace_num",
        ],
    )

    # Create task function with the judge prompt
    task = create_task_function(judge_prompt)

    # Run the experiment
    experiment = run_experiment(
        dataset=test_dataset,
        task=task,
        evaluators=[eval_tp, eval_tn, eval_fp, eval_fn, accuracy],
    )
    # Note: experiment result object may have different API in new client
    # experiment_id = experiment.id

    # Get results via API
    base_url = "http://localhost:6006"
    url = f"{base_url}/v1/experiments/{experiment.id}/json"
    response = requests.get(url)
    results = response.json()

    # Process results to get metrics
    metrics_count = defaultdict(int)
    for entry in results:
        for ann in entry["annotations"]:
            if (
                ann["name"] in ("eval_tp", "eval_tn", "eval_fp", "eval_fn")
                and ann["label"] == "True"
            ):
                metrics_count[ann["name"]] += 1

    # Extract counts
    TP = metrics_count["eval_tp"]
    TN = metrics_count["eval_tn"]
    FP = metrics_count["eval_fp"]
    FN = metrics_count["eval_fn"]

    # Compute metrics
    TPR = TP / (TP + FN) if (TP + FN) > 0 else 0
    TNR = TN / (TN + FP) if (TN + FP) > 0 else 0
    # balanced_acc = (TPR + TNR) / 2

    # Build predictions dataframe for analysis
    predictions_data = []
    for idx, entry in enumerate(results):
        # Extract prediction and ground truth
        prediction = entry.get("output", {})
        test_data = test_traces.iloc[idx]

        predictions_data.append(
            {
                "ground_truth_label": test_data.get("ground_truth_label"),
                "llm_as_judge_label": prediction.get("label"),
                "explanation": prediction.get("explanation"),
                "attributes.query": test_data.get("attributes.query"),
                "attributes.dietary_restriction": test_data.get("attributes.dietary_restriction"),
                "attributes.output.value": test_data.get("attributes.output.value"),
            }
        )

    predictions = pd.DataFrame(predictions_data)

    console.print(f"[green]Completed labeling of {len(predictions)} traces")

    console.print("[green]Completed LLM-as-Judge Evaluation, logged to Phoenix")

    return TPR, TNR, predictions


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

    performance_path = results_dir + "/judge_performance.json"
    with open(performance_path, "w") as f:
        json.dump(performance, f, indent=2)
    console.print(f"[green]Saved performance metrics to {performance_path}")

    # Save detailed predictions
    predictions_path = results_dir + "/test_predictions.json"
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

    judgy_path = results_dir + "/judgy_test_data.json"
    with open(judgy_path, "w") as f:
        json.dump(judgy_data, f, indent=2)
    console.print(f"[green]Saved judgy test data to {judgy_path}")
