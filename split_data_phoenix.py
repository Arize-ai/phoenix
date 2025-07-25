#!/usr/bin/env python3
"""Split labeled traces from Phoenix into train, dev, and test sets.

This script splits the labeled traces from Phoenix into stratified train/dev/test sets
for developing and evaluating the LLM judge.
"""

import pandas as pd
import random
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple
from rich.console import Console
from sklearn.model_selection import train_test_split
from dotenv import load_dotenv
import phoenix as px

load_dotenv()
console = Console()

def load_labeled_traces_from_phoenix() -> pd.DataFrame:
    """Load labeled traces from Phoenix."""
    try:
        # Get all evaluations from Phoenix
        client = px.Client(endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT"))
        evaluations = client.get_evaluations(project_name='recipe-agent')
        
        console.print(f"[green]Found {len(evaluations)} evaluation sets in Phoenix")
        
        # Find the dietary adherence evaluation
        dietary_eval = None
        for eval_set in evaluations:
            if eval_set.eval_name == "Dietary Adherence Evaluation":
                dietary_eval = eval_set
                break
        
        if dietary_eval is None:
            console.print("[red]No 'Dietary Adherence Evaluation' found in Phoenix!")
            return pd.DataFrame()
        
        console.print(f"[green]Found dietary adherence evaluation with {len(dietary_eval)} records")
        
        # Get the evaluation dataframe
        eval_df = dietary_eval.get_dataframe(prefix_columns_with_name=True)
        console.print(f"[blue]Evaluation columns: {eval_df.columns.tolist()}")
        
        # Get the corresponding spans to merge with evaluations
        query = px.SpanQuery().where("span_kind == 'CHAIN'")
        spans_df = client.query_spans(query, project_name='recipe-agent')
        
        # Merge evaluations with spans
        # Reset index to make span_id a column for merging
        eval_df_reset = eval_df.reset_index()
        spans_df_reset = spans_df.reset_index()
        
        # Merge on span_id
        merged_df = pd.merge(
            spans_df_reset, 
            eval_df_reset, 
            left_on='context.span_id', 
            right_on='context.span_id', 
            how='inner'
        )
        
        # Filter for valid labels
        label_col = f"eval.Dietary Adherence Evaluation.label"
        if label_col not in merged_df.columns:
            console.print(f"[red]Label column '{label_col}' not found in evaluation data!")
            console.print(f"[blue]Available columns: {merged_df.columns.tolist()}")
            return pd.DataFrame()
        
        valid_df = merged_df[merged_df[label_col].isin(["PASS", "FAIL"])]
        
        console.print(f"[green]Loaded {len(valid_df)} labeled traces from Phoenix")
        return valid_df
        
    except Exception as e:
        console.print(f"[red]Error loading traces from Phoenix: {str(e)}")
        return pd.DataFrame()

def stratified_split(df: pd.DataFrame, 
                    train_ratio: float = 0.15,
                    dev_ratio: float = 0.40,
                    test_ratio: float = 0.45,
                    random_state: int = 42) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split DataFrame into train/dev/test sets with stratification by label."""
    
    # Validate ratios
    assert abs(train_ratio + dev_ratio + test_ratio - 1.0) < 1e-6, "Ratios must sum to 1.0"
    
    label_col = f"eval.Dietary Adherence Evaluation.label"
    
    # First split: separate train from (dev + test)
    train_df, temp_df = train_test_split(
        df, 
        test_size=(dev_ratio + test_ratio),
        stratify=df[label_col],
        random_state=random_state
    )
    
    # Second split: separate dev from test
    # Adjust the test_size to get the right proportions
    dev_test_ratio = dev_ratio / (dev_ratio + test_ratio)
    dev_df, test_df = train_test_split(
        temp_df,
        test_size=(1 - dev_test_ratio),
        stratify=temp_df[label_col],
        random_state=random_state
    )
    
    return train_df, dev_df, test_df

def save_split(df: pd.DataFrame, output_path: str, split_name: str) -> None:
    """Save a data split to CSV file."""
    df.to_csv(output_path, index=False)
    console.print(f"[green]Saved {len(df)} {split_name} traces to {output_path}")

def print_split_statistics(train_df: pd.DataFrame, 
                          dev_df: pd.DataFrame, 
                          test_df: pd.DataFrame) -> None:
    """Print statistics about the data splits."""
    
    label_col = f"eval.Dietary Adherence Evaluation.label"
    dietary_col = "attributes.recipe_query.dietary_restriction"
    
    total_traces = len(train_df) + len(dev_df) + len(test_df)
    
    console.print("\n[bold]Data Split Statistics:")
    console.print(f"Total traces: {total_traces}")
    console.print(f"Train: {len(train_df)} ({len(train_df)/total_traces:.1%})")
    console.print(f"Dev: {len(dev_df)} ({len(dev_df)/total_traces:.1%})")
    console.print(f"Test: {len(test_df)} ({len(test_df)/total_traces:.1%})")
    
    # Label distribution
    console.print("\n[bold]Label Distribution:")
    for split_name, df in [("Train", train_df), ("Dev", dev_df), ("Test", test_df)]:
        label_counts = df[label_col].value_counts()
        console.print(f"{split_name}:")
        for label, count in label_counts.items():
            console.print(f"  {label}: {count} ({count/len(df):.1%})")
    
    # Dietary restriction distribution (for train set)
    if dietary_col in train_df.columns:
        console.print("\n[bold]Dietary Restrictions in Train Set:")
        restriction_counts = train_df[dietary_col].value_counts()
        for restriction, count in restriction_counts.items():
            console.print(f"  {restriction}: {count}")

def validate_splits(train_df: pd.DataFrame, 
                   dev_df: pd.DataFrame, 
                   test_df: pd.DataFrame) -> bool:
    """Validate that the splits are reasonable."""
    
    label_col = f"eval.Dietary Adherence Evaluation.label"
    dietary_col = "attributes.recipe_query.dietary_restriction"
    
    # Check that all splits have both labels
    for split_name, df in [("Train", train_df), ("Dev", dev_df), ("Test", test_df)]:
        labels = set(df[label_col].unique())
        if len(labels) < 2:
            console.print(f"[red]Warning: {split_name} set only has labels: {labels}")
            return False
    
    # Check that train set has reasonable diversity
    if dietary_col in train_df.columns:
        train_restrictions = set(train_df[dietary_col].unique())
        if len(train_restrictions) < 3:
            console.print(f"[red]Warning: Train set only has {len(train_restrictions)} dietary restrictions")
            return False
    
    console.print("[green]Data splits validation passed!")
    return True

def main():
    """Main function to split labeled data from Phoenix."""
    console.print("[bold blue]Data Splitting for LLM Judge Development (Phoenix)")
    console.print("=" * 60)
    
    # Set up paths
    script_dir = Path(__file__).parent
    hw3_dir = script_dir.parent
    data_dir = hw3_dir / "data"
    data_dir.mkdir(exist_ok=True)
    
    # Load labeled traces from Phoenix
    console.print("[yellow]Loading labeled traces from Phoenix...")
    traces_df = load_labeled_traces_from_phoenix()
    
    if traces_df.empty:
        console.print("[red]Error: No labeled traces found in Phoenix!")
        console.print("[yellow]Please run your labeling script first.")
        return
    
    console.print(f"[green]Loaded {len(traces_df)} labeled traces from Phoenix")
    
    # Split the data
    console.print("[yellow]Splitting data into train/dev/test sets...")
    train_df, dev_df, test_df = stratified_split(
        traces_df, 
        train_ratio=0.15,  # Small train set for few-shot examples
        dev_ratio=0.40,    # Larger dev set for judge development
        test_ratio=0.45    # Large test set for final evaluation
    )
    
    # Validate splits
    if not validate_splits(train_df, dev_df, test_df):
        console.print("[red]Data split validation failed!")
        return
    
    # Save splits
    train_path = data_dir / "train_set.csv"
    dev_path = data_dir / "dev_set.csv"
    test_path = data_dir / "test_set.csv"
    
    save_split(train_df, str(train_path), "train")
    save_split(dev_df, str(dev_path), "dev")
    save_split(test_df, str(test_path), "test")
    
    # Print statistics
    print_split_statistics(train_df, dev_df, test_df)
    
    console.print("\n[bold green]Data splitting completed successfully!")
    console.print("\n[bold]Split Rationale:")
    console.print("• Train (15%): Small set for few-shot examples in judge prompt")
    console.print("• Dev (40%): Large set for iterative judge development and tuning")
    console.print("• Test (45%): Large set for final unbiased evaluation of judge performance")
    
    # Show sample of what's available in the data
    console.print("\n[bold]Available Columns in Split Data:")
    sample_cols = [col for col in train_df.columns if not col.startswith('eval.')][:10]
    for col in sample_cols:
        console.print(f"  • {col}")
    if len(train_df.columns) > 10:
        console.print(f"  • ... and {len(train_df.columns) - 10} more columns")

if __name__ == "__main__":
    main() 