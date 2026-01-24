#!/usr/bin/env python3
"""Label Recipe Bot traces for dietary adherence using Phoenix evals.

This script uses Phoenix evals with GPT-4o to create ground truth labels
for whether Recipe Bot responses properly adhere to dietary restrictions.
"""

import os
import re
from pathlib import Path
from typing import Any, Dict

import pandas as pd
from dotenv import load_dotenv

from phoenix.client import Client
from phoenix.client.types.spans import SpanQuery
from phoenix.evals import OpenAIModel, llm_generate

load_dotenv()

script_dir = Path(__file__).parent
hw3_dir = script_dir.parent
data_dir = hw3_dir / "data"

# Labeling prompt for GPT-4o (adapted for Phoenix evals)
LABELING_PROMPT = """You are an expert nutritionist and dietary specialist. Your task is to evaluate
whether a recipe response properly adheres to the specified dietary restriction.

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
- PASS: The recipe clearly adheres to the dietary restriction with appropriate ingredients
and preparation methods
- FAIL: The recipe contains ingredients or methods that violate the dietary restriction
- Consider both explicit ingredients and cooking methods
- Be strict but reasonable in your evaluation

Please analyze the query, dietary restriction, and recipe response, then provide your evaluation.

Query: {attributes.query}
Dietary Restriction: {attributes.dietary_restriction}
Recipe Response: {attributes.output.value}

Return your response in this exact format:
"explanation": "Detailed explanation of your evaluation, citing specific ingredients or methods",
"label": "PASS" or "FAIL",
"""


def load_traces_from_phoenix() -> pd.DataFrame:
    """Load traces from Phoenix."""
    try:
        query = SpanQuery().where("span_kind == 'CHAIN'")

        client = Client()
        trace_df = client.spans.get_spans_dataframe(query=query, project_identifier="recipe-agent")
        print("Loaded traces from Phoenix")
        return trace_df
    except Exception as e:
        print(f"Error loading traces from Phoenix: {str(e)}")
        return pd.DataFrame()


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


def generate_phoenix_labels(
    trace_df: pd.DataFrame, prompt: str, sample_size: int = 600
) -> pd.DataFrame:
    """Label traces using Phoenix evals."""
    # Sample traces for labeling
    if len(trace_df) > sample_size:
        sampled_df = trace_df.sample(n=sample_size, random_state=42)
    else:
        sampled_df = trace_df

    print(f"Labeling {len(sampled_df)} traces with Phoenix evals...")

    # Run the evaluation using Phoenix
    test_results = llm_generate(
        dataframe=sampled_df,
        template=prompt,
        model=OpenAIModel(model="gpt-4o", api_key=os.getenv("OPENAI_API_KEY")),
        output_parser=output_parser,
        include_prompt=True,
    )

    test_results = pd.merge(test_results, sampled_df, left_index=True, right_index=True)

    print(f"Completed labeling of {len(test_results)} traces")

    test_results.set_index(sampled_df.index)

    px_client = Client()
    px_client.spans.log_span_annotations_dataframe(
        dataframe=test_results,
        annotation_name="Ground Truth Labels",
        annotator_kind="LLM",
    )

    test_results.rename(
        columns={
            "label": "ground_truth_label",
            "explanation": "ground_truth_explanation",
        },
        inplace=True,
    )

    print("Logged evaluations to Phoenix")
    return test_results


def balance_labels(
    labeled_df: pd.DataFrame, target_positive: int = 50, target_negative: int = 50
) -> pd.DataFrame:
    """Balance the dataset to have roughly equal positive and negative examples."""
    # Filter successfully labeled traces
    valid_df = labeled_df[labeled_df["ground_truth_label"].isin(["PASS", "FAIL"])]
    pass_traces = valid_df[valid_df["ground_truth_label"] == "PASS"]
    fail_traces = valid_df[valid_df["ground_truth_label"] == "FAIL"]

    print(f"Available traces: {len(pass_traces)} PASS, {len(fail_traces)} FAIL")

    # Sample to get balanced dataset
    selected_pass = pass_traces.sample(n=min(target_positive, len(pass_traces)), random_state=42)
    selected_fail = fail_traces.sample(n=min(target_negative, len(fail_traces)), random_state=42)

    balanced_df = pd.concat([selected_pass, selected_fail]).sample(frac=1, random_state=42)

    print(f"Balanced dataset: {len(selected_pass)} PASS, {len(selected_fail)} FAIL")

    return balanced_df
