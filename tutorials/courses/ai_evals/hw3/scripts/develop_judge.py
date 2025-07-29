#!/usr/bin/env python3
"""Develop and refine the LLM judge prompt for dietary adherence evaluation.

This script creates an LLM judge prompt with carefully selected few-shot examples
using embedding similarity and iteratively refines it on the dev set.
"""

import os
import random
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


def select_few_shot_examples(
    train_traces: pd.DataFrame, num_positive: int = 1, num_negative: int = 3
) -> List[Dict[str, Any]]:
    """Select few-shot examples randomly from train set."""

    console.print("[yellow]Selecting random few-shot examples...")

    train_traces = train_traces.to_dict("records")
    # Separate by label
    train_pass = [trace for trace in train_traces if trace["ground_truth_label"] == "PASS"]
    train_fail = [trace for trace in train_traces if trace["ground_truth_label"] == "FAIL"]

    selected_examples = []

    # Select positive examples (PASS) randomly
    if train_pass and len(train_pass) >= num_positive:
        selected_examples.extend(random.sample(train_pass, num_positive))
    elif train_pass:
        selected_examples.extend(train_pass)  # Use all available if less than requested

    # Select negative examples (FAIL) randomly
    if train_fail and len(train_fail) >= num_negative:
        selected_examples.extend(random.sample(train_fail, num_negative))
    elif train_fail:
        selected_examples.extend(train_fail)  # Use all available if less than requested

    pass_count = len([e for e in selected_examples if e["ground_truth_label"] == "PASS"])
    fail_count = len([e for e in selected_examples if e["ground_truth_label"] == "FAIL"])
    console.print(
        f"""[green]Selected {len(selected_examples)} few-shot examples
        ({pass_count} PASS, {fail_count} FAIL)"""
    )
    return selected_examples


def create_judge_prompt(few_shot_examples: List[Dict[str, Any]]) -> str:
    """Create the LLM judge prompt with few-shot examples."""

    # Base prompt
    base_prompt = """You are an expert nutritionist and dietary specialist evaluating whether recipe
    responses properly adhere to specified dietary restrictions.

DIETARY RESTRICTION DEFINITIONS:
- Vegan: No animal products (meat, dairy, eggs, honey, etc.)
- Vegetarian: No meat or fish, but dairy and eggs are allowed
- Gluten-free: No wheat, barley, rye, or other gluten-containing grains
- Dairy-free: No milk, cheese, butter, yogurt, or other dairy products
- Keto: Very low carb (typically <20g net carbs), high fat, moderate protein
- Paleo: No grains, legumes, dairy, refined sugar, or processed foods
- Pescatarian: No meat except fish and seafood
- Kosher: Follows Jewish dietary laws (no pork, shellfish, mixing meat/dairy)
- Halal: Follows Islamic dietary laws (no pork, alcohol, proper slaughter)
- Nut-free: No tree nuts or peanuts
- Low-carb: Significantly reduced carbohydrates (typically <50g per day)
- Sugar-free: No added sugars or high-sugar ingredients
- Raw vegan: Vegan foods not heated above 118°F (48°C)
- Whole30: No grains, dairy, legumes, sugar, alcohol, or processed foods
- Diabetic-friendly: Low glycemic index, controlled carbohydrates
- Low-sodium: Reduced sodium content for heart health

EVALUATION CRITERIA:
- PASS: The recipe clearly adheres to the dietary preferences with appropriate ingredients
and preparation methods
- FAIL: The recipe contains ingredients or methods that violate the dietary preferences
- Consider both explicit ingredients and cooking methods

Here are some examples of how to evaluate dietary adherence:

"""

    # Add few-shot examples
    for i, example in enumerate(few_shot_examples, 1):
        base_prompt += f"\nExample {i}:\n"
        base_prompt += f"Query and Response: {example['attributes.output.value']}\n"
        base_prompt += f"Explanation: {example['ground_truth_explanation']}\n"
        base_prompt += f"Label: {example['ground_truth_label']}\n"

    # Add evaluation template - using placeholders that won't conflict with JSON
    base_prompt += """

Now evaluate the following recipe response:

Query: {attributes.query}
Dietary Restriction: {attributes.dietary_restriction}
Recipe Response: {attributes.output.value}

Provide your evaluation in the following format:
"explanation": "Detailed explanation of your evaluation, citing specific ingredients or methods",
"label": "PASS" or "FAIL"
"""

    return base_prompt


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


def evaluate_judge_on_dev(
    judge_prompt: str, dev_traces: List[Dict[str, Any]], sample_size: int = 50
) -> Tuple[float, float, List[Dict[str, Any]]]:
    """Label traces using Phoenix evals."""
    # Sample traces for labeling
    if len(dev_traces) > sample_size:
        sampled_df = dev_traces.sample(n=sample_size, random_state=42)
    else:
        sampled_df = dev_traces

    console.print(f"[yellow]Labeling {len(sampled_df)} traces with Phoenix evals...")

    # Run the evaluation using Phoenix
    predictions = llm_generate(
        dataframe=sampled_df,
        template=judge_prompt,
        model=OpenAIModel(model="gpt-4o", api_key=os.getenv("OPENAI_API_KEY")),
        verbose=True,
        output_parser=output_parser,
        include_prompt=True,
        include_response=True,
    )

    predictions = pd.merge(predictions, sampled_df, left_index=True, right_index=True)

    console.print(f"[green]Completed labeling of {len(predictions)} traces")

    predictions.set_index(sampled_df.index)

    from phoenix.trace import SpanEvaluations

    px.Client().log_evaluations(
        SpanEvaluations(eval_name="LLM-as-Judge Evaluation", dataframe=predictions)
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


def save_judge_prompt(prompt: str, output_path: str) -> None:
    """Save the judge prompt to a text file."""
    with open(output_path, "w") as f:
        f.write(prompt)
    console.print(f"[green]Saved judge prompt to {output_path}")


def main():
    """Main function to develop the LLM judge."""
    console.print("[bold blue]LLM Judge Development")
    console.print("=" * 50)

    # Set up paths
    script_dir = Path(__file__).parent
    hw3_dir = script_dir.parent
    data_dir = hw3_dir / "data"
    results_dir = hw3_dir / "results"
    results_dir.mkdir(exist_ok=True)

    # Load data splits
    train_path = data_dir / "train_set.csv"
    dev_path = data_dir / "dev_set.csv"

    if not train_path.exists() or not dev_path.exists():
        console.print("[red]Error: Train or dev set not found!")
        console.print("[yellow]Please run split_data.py first.")
        return

    train_traces = load_data_split(str(train_path))
    dev_traces = load_data_split(str(dev_path))

    console.print(
        f"[green]Loaded {len(train_traces)} train traces and {len(dev_traces)} dev traces"
    )

    # Select few-shot examples randomly
    few_shot_examples = select_few_shot_examples(train_traces)

    if not few_shot_examples:
        console.print("[red]Failed to select few-shot examples!")
        return

    # Create judge prompt
    judge_prompt = create_judge_prompt(few_shot_examples)

    print("judge_prompt", judge_prompt)

    # Evaluate judge on dev set
    console.print("[yellow]Evaluating judge on dev set...")
    tpr, tnr, predictions = evaluate_judge_on_dev(judge_prompt, dev_traces)

    # Print results
    console.print("\n[bold]Judge Performance on Dev Set:")
    console.print(f"True Positive Rate (TPR): {tpr:.3f}")
    console.print(f"True Negative Rate (TNR): {tnr:.3f}")
    console.print(f"Balanced Accuracy: {(tpr + tnr) / 2:.3f}")

    # Save judge prompt
    prompt_path = results_dir / "judge_prompt.txt"
    save_judge_prompt(judge_prompt, str(prompt_path))

    # Save dev set predictions for analysis
    predictions_path = results_dir / "dev_predictions.json"
    with open(predictions_path, "w") as f:
        predictions.to_json(f)
    console.print(f"[green]Saved dev predictions to {predictions_path}")

    console.print("\n[bold green]Judge development completed!")
    console.print(f"[blue]Judge prompt saved to: {prompt_path}")


if __name__ == "__main__":
    main()
