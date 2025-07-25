#!/usr/bin/env python3
"""Label Recipe Bot traces for dietary adherence using Phoenix evals.

This script uses Phoenix evals with GPT-4o to create ground truth labels
for whether Recipe Bot responses properly adhere to dietary restrictions.
"""

import pandas as pd
import json
import random
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from rich.console import Console
from dotenv import load_dotenv
import phoenix as px
from phoenix.evals import llm_generate, OpenAIModel
from phoenix.trace.dsl import SpanQuery

load_dotenv()

console = Console()

script_dir = Path(__file__).parent
hw3_dir = script_dir.parent
data_dir = hw3_dir / "data"

# Labeling prompt for GPT-4o (adapted for Phoenix evals)
LABELING_PROMPT = """You are an expert nutritionist and dietary specialist. Your task is to evaluate whether a recipe response properly adheres to the specified dietary restriction.

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
- PASS: The recipe clearly adheres to the dietary restriction with appropriate ingredients and preparation methods
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
"confidence": "HIGH", "MEDIUM", or "LOW"
"""

def load_traces_from_phoenix() -> pd.DataFrame:
    """Load traces from Phoenix."""
    try:
        query = SpanQuery().where(
            "span_kind == 'CHAIN'"
        )
        
        trace_df = px.Client(endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT")).query_spans(query, project_name='recipe-agent')
        console.print(f"[green]Loaded {len(trace_df)} traces from Phoenix")
        return trace_df
    except Exception as e:
        console.print(f"[red]Error loading traces from Phoenix: {str(e)}")
        return pd.DataFrame()

def output_parser(output: str, row_index: int) -> Dict[str, Any]:
    """Output parser function for Phoenix evals."""
    label_pattern = r'"label":\s*"([^"]*)"'
    explanation_pattern = r'"explanation":\s*"([^"]*)"'
    confidence_pattern = r'"confidence":\s*"([^"]*)"'

    label_match = re.search(label_pattern, output, re.IGNORECASE)
    explanation_match = re.search(explanation_pattern, output, re.IGNORECASE)
    confidence_match = re.search(confidence_pattern, output, re.IGNORECASE)
    
    return {
        "label": label_match.group(1) if label_match else None,
        "explanation": explanation_match.group(1) if explanation_match else None,
        "confidence": confidence_match.group(1) if confidence_match else None,
    }

def generate_phoenix_labels(trace_df: pd.DataFrame, prompt: str, sample_size: int = 150) -> pd.DataFrame:
    """Label traces using Phoenix evals."""
    # Sample traces for labeling
    if len(trace_df) > sample_size:
        sampled_df = trace_df.sample(n=sample_size, random_state=42)
    else:
        sampled_df = trace_df
    
    console.print(f"[yellow]Labeling {len(sampled_df)} traces with Phoenix evals...")
    
    # Run the evaluation using Phoenix
    test_results = llm_generate(
        dataframe=sampled_df,
        template=prompt,
        model=OpenAIModel(model='gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
        verbose=True,
        output_parser=output_parser,
        include_prompt=True,
    )

    test_results = pd.merge(test_results, sampled_df, left_index=True, right_index=True)
    
    
    console.print(f"[green]Completed labeling of {len(test_results)} traces")

    test_results.set_index(sampled_df.index)

    from phoenix.trace import SpanEvaluations
    px.Client().log_evaluations(
        SpanEvaluations(eval_name="Ground Truth Labels", dataframe=test_results)
    )

    test_results.rename(columns={"label": "ground_truth_label", "confidence": "ground_truth_confidence", "explanation": "ground_truth_explanation"}, inplace=True)

    console.print("[green]Logged evaluations to Phoenix")
    return test_results

def balance_labels(labeled_df: pd.DataFrame, 
                  target_positive: int = 75, 
                  target_negative: int = 75) -> pd.DataFrame:
    """Balance the dataset to have roughly equal positive and negative examples."""
    # Filter successfully labeled traces
    valid_df = labeled_df[labeled_df["ground_truth_label"].isin(["PASS", "FAIL"])]
    pass_traces = valid_df[valid_df["ground_truth_label"] == "PASS"]
    fail_traces = valid_df[valid_df["ground_truth_label"] == "FAIL"]
    
    console.print(f"[blue]Available traces: {len(pass_traces)} PASS, {len(fail_traces)} FAIL")
    
    # Sample to get balanced dataset
    selected_pass = pass_traces.sample(n=min(target_positive, len(pass_traces)), random_state=42)
    selected_fail = fail_traces.sample(n=min(target_negative, len(fail_traces)), random_state=42)
    
    balanced_df = pd.concat([selected_pass, selected_fail]).sample(frac=1, random_state=42)
    
    
    console.print(f"[green]Balanced dataset: {len(selected_pass)} PASS, {len(selected_fail)} FAIL")
    
    return balanced_df

def show_confidence_distribution_pie(balanced_df: pd.DataFrame):
    """Display confidence distribution as a pie chart style."""
    console.print("\n[bold blue]Confidence Distribution")
    console.print("=" * 40)
    
    confidence_counts = balanced_df["ground_truth_confidence"].value_counts()
    total = len(balanced_df)
    
    # Unicode pie chart characters
    pie_chars = ["🟢", "🟡", "🟠", "🔴", "🟣", "🔵"]
    
    for i, (confidence, count) in enumerate(confidence_counts.items()):
        percentage = (count / total) * 100
        pie_char = pie_chars[i % len(pie_chars)]
        
        console.print(f"{pie_char} {confidence}: {count} ({percentage:.1f}%)")

def main():
    """Main function to label traces using Phoenix evals."""
    console.print("[bold blue]Recipe Bot Trace Labeling with Phoenix Evals")
    console.print("=" * 50)
    
    # Set up paths
    script_dir = Path(__file__).parent
    hw3_dir = script_dir.parent
    data_dir = hw3_dir / "data"
    
    # Load traces from Phoenix
    console.print("[yellow]Loading traces from Phoenix...")
    trace_df = load_traces_from_phoenix()
    
    if trace_df.empty:
        console.print("[red]Error: No traces found in Phoenix!")
        console.print("[yellow]Please run generate_traces.py first to generate traces.")
        return
    
    # Label traces with Phoenix evals
    console.print("[yellow]Labeling traces with Phoenix evals...")
    test_results = generate_phoenix_labels(trace_df, prompt=LABELING_PROMPT, sample_size=200)  # Label more than needed

    # Balance the dataset
    balanced_df = balance_labels(test_results, target_positive=75, target_negative=75)
    
    # Print summary statistics
    console.print("\n[bold]Labeling Summary:")
    console.print(f"Total labeled traces: {len(balanced_df)}")
    
    label_counts = balanced_df["ground_truth_label"].value_counts()    
    console.print("\nLabel distribution:")
    for label, count in label_counts.items():
        console.print(f"  {label}: {count}")
    
    show_confidence_distribution_pie(balanced_df)
    balanced_df.to_csv(data_dir / "labeled_traces.csv", index=False)



if __name__ == "__main__":
    main() 