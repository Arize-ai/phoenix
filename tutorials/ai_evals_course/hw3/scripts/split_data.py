#!/usr/bin/env python3
"""Split labeled traces into train, dev, and test sets.

This script splits the labeled traces into stratified train/dev/test sets
for developing and evaluating the LLM judge.
"""

from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd
from rich.console import Console
from sklearn.model_selection import train_test_split

console = Console()


def load_labeled_traces(csv_path: str) -> List[Dict[str, Any]]:
    """Load labeled traces from CSV file."""
    df = pd.read_csv(csv_path)
    return df.to_dict("records")


def stratified_split(
    traces: List[Dict[str, Any]],
    train_ratio: float = 0.15,
    dev_ratio: float = 0.40,
    test_ratio: float = 0.45,
    random_state: int = 42,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Split traces into train/dev/test sets with stratification by label."""

    # Validate ratios
    assert abs(train_ratio + dev_ratio + test_ratio - 1.0) < 1e-6, "Ratios must sum to 1.0"

    # Convert to DataFrame for easier manipulation
    df = pd.DataFrame(traces)

    # First split: separate train from (dev + test)
    train_df, temp_df = train_test_split(
        df,
        test_size=(dev_ratio + test_ratio),
        stratify=df["ground_truth_label"],
        random_state=random_state,
    )

    # Second split: separate dev from test
    # Adjust the test_size to get the right proportions
    dev_test_ratio = dev_ratio / (dev_ratio + test_ratio)
    dev_df, test_df = train_test_split(
        temp_df,
        test_size=(1 - dev_test_ratio),
        stratify=temp_df["ground_truth_label"],
        random_state=random_state,
    )

    # Convert back to list of dictionaries
    train_traces = train_df.to_dict("records")
    dev_traces = dev_df.to_dict("records")
    test_traces = test_df.to_dict("records")

    return train_traces, dev_traces, test_traces


def save_split(traces: List[Dict[str, Any]], output_path: str, split_name: str) -> None:
    """Save a data split to CSV file."""
    df = pd.DataFrame(traces)
    df.to_csv(output_path, index=False)
    console.print(f"[green]Saved {len(traces)} {split_name} traces to {output_path}")


def print_split_statistics(
    train_traces: List[Dict[str, Any]],
    dev_traces: List[Dict[str, Any]],
    test_traces: List[Dict[str, Any]],
) -> None:
    """Print statistics about the data splits."""

    def get_label_counts(traces: List[Dict[str, Any]]) -> Dict[str, int]:
        counts = {}
        for trace in traces:
            label = trace["ground_truth_label"]
            counts[label] = counts.get(label, 0) + 1
        return counts

    def get_restriction_counts(traces: List[Dict[str, Any]]) -> Dict[str, int]:
        counts = {}
        for trace in traces:
            restriction = trace["attributes.dietary_restriction"]
            counts[restriction] = counts.get(restriction, 0) + 1
        return counts

    total_traces = len(train_traces) + len(dev_traces) + len(test_traces)

    console.print("\n[bold]Data Split Statistics:")
    console.print(f"Total traces: {total_traces}")
    console.print(f"Train: {len(train_traces)} ({len(train_traces)/total_traces:.1%})")
    console.print(f"Dev: {len(dev_traces)} ({len(dev_traces)/total_traces:.1%})")
    console.print(f"Test: {len(test_traces)} ({len(test_traces)/total_traces:.1%})")

    # Label distribution
    console.print("\n[bold]Label Distribution:")
    for split_name, traces in [("Train", train_traces), ("Dev", dev_traces), ("Test", test_traces)]:
        label_counts = get_label_counts(traces)
        console.print(f"{split_name}:")
        for label, count in sorted(label_counts.items()):
            console.print(f"  {label}: {count} ({count/len(traces):.1%})")

    # Dietary restriction distribution (for train set)
    console.print("\n[bold]Dietary Restrictions in Train Set:")
    restriction_counts = get_restriction_counts(train_traces)
    for restriction, count in sorted(restriction_counts.items()):
        console.print(f"  {restriction}: {count}")


def validate_splits(
    train_traces: List[Dict[str, Any]],
    dev_traces: List[Dict[str, Any]],
    test_traces: List[Dict[str, Any]],
) -> bool:
    """Validate that the splits are reasonable."""

    # Check that all splits have both labels
    for split_name, traces in [("Train", train_traces), ("Dev", dev_traces), ("Test", test_traces)]:
        labels = set(trace["ground_truth_label"] for trace in traces)
        if len(labels) < 2:
            console.print(f"[red]Warning: {split_name} set only has labels: {labels}")
            return False

    # Check that train set has reasonable diversity
    train_restrictions = set(trace["attributes.dietary_restriction"] for trace in train_traces)
    if len(train_restrictions) < 3:
        console.print(
            f"[red]Warning: Train set only has {len(train_restrictions)} dietary restrictions"
        )
        return False

    console.print("[green]Data splits validation passed!")
    return True


def main():
    """Main function to split labeled data."""
    console.print("[bold blue]Data Splitting for LLM Judge Development")
    console.print("=" * 50)

    # Set up paths
    script_dir = Path(__file__).parent
    hw3_dir = script_dir.parent
    data_dir = hw3_dir / "data"

    # Load labeled traces
    labeled_path = data_dir / "labeled_traces.csv"
    if not labeled_path.exists():
        console.print(f"[red]Error: {labeled_path} not found!")
        console.print("[yellow]Please run label_data.py first.")
        return

    traces = load_labeled_traces(str(labeled_path))
    console.print(f"[green]Loaded {len(traces)} labeled traces")

    # Split the data
    console.print("[yellow]Splitting data into train/dev/test sets...")
    train_traces, dev_traces, test_traces = stratified_split(
        traces,
        train_ratio=0.15,  # Small train set for few-shot examples
        dev_ratio=0.40,  # Larger dev set for judge development
        test_ratio=0.45,  # Large test set for final evaluation
    )

    # Validate splits
    if not validate_splits(train_traces, dev_traces, test_traces):
        console.print("[red]Data split validation failed!")
        return

    # Save splits
    train_path = data_dir / "train_set.csv"
    dev_path = data_dir / "dev_set.csv"
    test_path = data_dir / "test_set.csv"

    save_split(train_traces, str(train_path), "train")
    save_split(dev_traces, str(dev_path), "dev")
    save_split(test_traces, str(test_path), "test")

    # Print statistics
    print_split_statistics(train_traces, dev_traces, test_traces)

    console.print("\n[bold green]Data splitting completed successfully!")
    console.print("\n[bold]Split Rationale:")
    console.print("• Train (15%): Small set for few-shot examples in judge prompt")
    console.print("• Dev (40%): Large set for iterative judge development and tuning")
    console.print("• Test (45%): Large set for final unbiased evaluation of judge performance")


if __name__ == "__main__":
    main()
