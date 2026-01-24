#!/usr/bin/env python3
"""Functions to split labeled traces into train, dev, and test sets.

The functions in this script will be used in develop_judge.py to split the labeled traces into
stratified train/dev/test sets.
"""

from typing import Any, Dict, List, Tuple

import pandas as pd
from sklearn.model_selection import train_test_split

from phoenix.client import Client

phoenix_client = Client()


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
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
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

    return train_df, dev_df, test_df


def print_split_statistics(
    train_df: pd.DataFrame, dev_df: pd.DataFrame, test_df: pd.DataFrame
) -> None:
    """Print statistics about the data splits."""

    def get_label_counts(traces: pd.DataFrame) -> Dict[str, int]:
        counts = {}
        for _, trace in traces.iterrows():
            label = trace["ground_truth_label"]
            counts[label] = counts.get(label, 0) + 1
        return counts

    def get_restriction_counts(traces: pd.DataFrame) -> Dict[str, int]:
        counts = {}
        for _, trace in traces.iterrows():
            restriction = trace["attributes.dietary_restriction"]
            counts[restriction] = counts.get(restriction, 0) + 1
        return counts

    total_traces = len(train_df) + len(dev_df) + len(test_df)

    print("\n[bold]Data Split Statistics:")
    print(f"Total traces: {total_traces}")
    print(f"Train: {len(train_df)} ({len(train_df) / total_traces:.1%})")
    print(f"Dev: {len(dev_df)} ({len(dev_df) / total_traces:.1%})")
    print(f"Test: {len(test_df)} ({len(test_df) / total_traces:.1%})")

    # Label distribution
    print("\n[bold]Label Distribution:")
    for split_name, split_df in [
        ("Train", train_df),
        ("Dev", dev_df),
        ("Test", test_df),
    ]:
        label_counts = get_label_counts(split_df)
        print(f"{split_name}:")
        for label, count in sorted(label_counts.items()):
            print(f"  {label}: {count} ({count / len(split_df):.1%})")

    # Dietary restriction distribution (for train set)
    print("\n[bold]Dietary Restrictions in Train Set:")
    restriction_counts = get_restriction_counts(split_df)
    for restriction, count in sorted(restriction_counts.items()):
        print(f"  {restriction}: {count}")


def validate_splits(train_df: pd.DataFrame, dev_df: pd.DataFrame, test_df: pd.DataFrame) -> bool:
    """Validate that the splits are reasonable."""

    # Check that all splits have both labels
    for split_name, split_df in [
        ("Train", train_df),
        ("Dev", dev_df),
        ("Test", test_df),
    ]:
        labels = set(split_df["ground_truth_label"])
        if len(labels) < 2:
            print(f"Warning: {split_name} set only has labels: {labels}")
            return False

    # Check that train set has reasonable diversity
    train_restrictions = set(train_df["attributes.dietary_restriction"])
    if len(train_restrictions) < 3:
        print(f"Warning: Train set only has {len(train_restrictions)} dietary restrictions")
        return False

    print("Data splits validation passed!")
    return True
