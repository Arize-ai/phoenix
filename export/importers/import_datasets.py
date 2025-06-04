#!/usr/bin/env python3
"""
Phoenix to Arize Dataset Importer

This script imports datasets from a Phoenix export directory into Arize.
It reads dataset metadata and examples from the Phoenix export format,
converts them to the format expected by Arize, and imports them.
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Union

import pandas as pd
from arize.experimental.datasets import ArizeDatasetsClient
from arize.experimental.datasets.utils.constants import GENERATIVE
from tqdm import tqdm

from .utils import (
    RESULTS_DIR,
    load_json_file,
    parse_common_args,
    save_results_to_file,
    setup_logging,
)


def get_datasets(export_dir: Union[str, Path]) -> List[Dict]:
    """
    Get all datasets from the Phoenix export directory.

    Args:
        export_dir: Path to the Phoenix export directory

    Returns:
        List of dataset dictionaries
    """
    datasets_path = Path(export_dir) / "datasets" / "datasets.json"
    if not datasets_path.exists():
        print(f"Datasets file not found: {datasets_path}")
        return []

    return load_json_file(datasets_path) or []


def get_dataset_examples(export_dir: Union[str, Path], dataset_id: str) -> List[Dict]:
    """
    Get examples for a specific dataset.

    Args:
        export_dir: Path to the Phoenix export directory
        dataset_id: ID of the dataset

    Returns:
        List of example dictionaries
    """
    examples_path = Path(export_dir) / "datasets" / f"dataset_{dataset_id}_examples.json"
    if not examples_path.exists():
        print(f"Dataset examples not found: {examples_path}")
        return []

    return load_json_file(examples_path) or []


def convert_examples_to_dataframe(examples: List[Dict]) -> pd.DataFrame:
    """
    Convert dataset examples to a pandas DataFrame suitable for Arize.

    Arize expects a simpler format with basic field types, so this function
    converts the complex nested structures from Phoenix to a flat structure
    with simple string values.

    Args:
        examples: List of dataset examples

    Returns:
        DataFrame formatted for Arize
    """
    if not examples:
        return pd.DataFrame()

    rows = []
    for i, example in enumerate(examples):
        row = {}

        # Add id if available or generate one
        if "id" in example:
            row["id"] = str(example["id"])
        else:
            # Generate a unique ID
            row["id"] = f"example_{i+1}"

        # Simplify input - flatten structure to match test dataset format
        if "input" in example:
            if isinstance(example["input"], dict):
                # Take the first key as main input field or stringify the entire input
                input_keys = list(example["input"].keys())
                if input_keys:
                    main_key = input_keys[0]
                    row["question"] = str(example["input"][main_key])

                    # Store the stringified input for reference
                    row["input"] = json.dumps(example["input"])
                else:
                    row["question"] = json.dumps(example["input"])
            else:
                row["question"] = str(example["input"])

        # Simplify output - convert to string if it's a dict
        if "output" in example:
            if isinstance(example["output"], dict):
                if example["output"]:  # If not empty
                    row["answer"] = json.dumps(example["output"])
                else:
                    row["answer"] = ""  # Empty string for empty dicts
            else:
                row["answer"] = str(example["output"])

        # Add any metadata fields as simple strings
        if "metadata" in example and isinstance(example["metadata"], dict):
            for key, value in example["metadata"].items():
                row[f"metadata_{key}"] = str(value) if value is not None else ""

        rows.append(row)

    df = pd.DataFrame(rows)

    # Ensure 'id' column exists and contains unique string values
    if "id" not in df.columns:
        df["id"] = [f"example_{i+1}" for i in range(len(df))]
    else:
        # Check for duplicate IDs and fix them
        if df["id"].duplicated().any():
            print("WARNING: Found duplicate IDs in dataset, appending unique suffixes")
            dup_mask = df["id"].duplicated(keep=False)
            for i, (idx, row) in enumerate(df[dup_mask].iterrows()):
                df.at[idx, "id"] = f"{row['id']}_{i+1}"

    # Ensure we have at least one data field besides id
    if len(df.columns) < 2:
        df["data"] = "No data"

    return df


def import_datasets(
    export_dir: Union[str, Path],
    space_id: str,
    arize_api_key: str,
    limit: Optional[int] = None,
    verbose: bool = False,
    results_file: Optional[str] = None,
) -> List[Dict]:
    """
    Import datasets from Phoenix export to Arize.

    Args:
        export_dir: Path to the Phoenix export directory
        space_id: Arize Space ID to import into
        arize_api_key: Arize API key for authentication
        limit: Limit the number of datasets to import
        verbose: Enable verbose output
        results_file: Path to save import results (optional)

    Returns:
        List of imported dataset information
    """

    # Setup logging
    setup_logging(verbose)

    # Initialize Arize client
    try:
        client = ArizeDatasetsClient(api_key=arize_api_key)
        if verbose:
            print("Successfully initialized Arize client")
    except Exception as e:
        print(f"Error initializing Arize client: {e}")
        return []

    # Check if export directory exists
    export_path = Path(export_dir)
    if not export_path.exists():
        print(f"Export directory does not exist: {export_path}")
        return []

    # Check if datasets directory exists
    datasets_dir = export_path / "datasets"
    if not datasets_dir.exists():
        print(f"Datasets directory does not exist: {datasets_dir}")
        return []

    # Get all datasets
    datasets = get_datasets(export_dir)
    if verbose:
        print(f"Raw datasets data: {json.dumps(datasets, indent=2)}")

    if limit:
        datasets = datasets[:limit]

    print(f"Found {len(datasets)} datasets to import")

    if len(datasets) == 0:
        return []

    # Load previously imported datasets to avoid duplicates
    if results_file:
        results_path = Path(results_file)
    else:
        results_path = RESULTS_DIR / "dataset_import_results.json"

    previously_imported = {}
    if results_path.exists():
        try:
            with open(results_path, "r") as f:
                imported_data = json.load(f)
                for item in imported_data:
                    # Track by both ID and name to prevent duplicates
                    previously_imported[item.get("phoenix_id")] = item
                    if "original_name" in item:
                        previously_imported[item.get("original_name")] = item
        except Exception as e:
            print(f"Warning: Could not load previous import results: {e}")

    imported_datasets = []
    for dataset in tqdm(datasets, desc="Importing datasets"):
        dataset_id = dataset.get("id")
        if not dataset_id:
            continue

        dataset_name = dataset.get("name", f"Phoenix Dataset {dataset_id}")

        # Skip if already imported
        if dataset_id in previously_imported or dataset_name in previously_imported:
            dataset_info = previously_imported.get(dataset_id) or previously_imported.get(
                dataset_name
            )
            if dataset_info.get(
                "status"
            ) == "error" and "Failed to create dataset" in dataset_info.get("error", ""):
                dataset_info["status"] = "already_exists"
                dataset_info["arize_id"] = "already_exists"
            imported_datasets.append(dataset_info.copy())
            continue

        # Extract timestamp
        timestamp = None
        if "created_at" in dataset:
            try:
                dt = datetime.fromisoformat(dataset["created_at"].replace("Z", "+00:00"))
                timestamp = int(dt.timestamp())
            except (ValueError, TypeError):
                pass

        if not timestamp:
            timestamp = int(time.time())

        unique_dataset_name = dataset_name

        # Get examples for this dataset
        examples = get_dataset_examples(export_dir, dataset_id)

        if not examples:
            continue

        # Convert examples to DataFrame
        df = convert_examples_to_dataframe(examples)
        if df.empty:
            continue

        dataset_info = {
            "phoenix_id": dataset_id,
            "name": unique_dataset_name,
            "original_name": dataset_name,
            "original_timestamp": timestamp,
            "examples_count": len(examples),
        }

        try:
            arize_dataset_id = client.create_dataset(
                space_id=space_id,
                dataset_name=unique_dataset_name,
                dataset_type=GENERATIVE,
                data=df,
            )

            print(f"Successfully imported dataset {unique_dataset_name} with ID {arize_dataset_id}")
            dataset_info["arize_id"] = arize_dataset_id
            dataset_info["status"] = "imported"

        except Exception as e:
            error_message = str(e)
            # Check if the error message suggests the dataset already exists
            # This covers various error formats from the Arize API
            if (
                "already exists" in error_message.lower()
                or "Failed to create dataset" in error_message
            ):
                print(f"Dataset '{unique_dataset_name}' already exists in Arize")
                dataset_info["arize_id"] = "already_exists"
                dataset_info["status"] = "already_exists"
                # Count this as a success since the dataset exists in Arize
            else:
                dataset_info["arize_id"] = "error"
                dataset_info["status"] = "error"
                dataset_info["error"] = error_message

        # Add the dataset info to the list, regardless of success/failure
        imported_datasets.append(dataset_info)

    # Count successful imports
    new_count = sum(1 for d in imported_datasets if d.get("status") == "imported")
    existing_count = sum(1 for d in imported_datasets if d.get("status") == "already_exists")
    error_count = sum(1 for d in imported_datasets if d.get("status") == "error")

    print(
        f"Processed {len(imported_datasets)} datasets: {new_count} imported, "
        f"{existing_count} existing, {error_count} errors"
    )

    return imported_datasets


def main() -> None:
    """Main entry point for the script."""
    parser = parse_common_args("Import Phoenix datasets to Arize")
    parser.add_argument("--limit", type=int, help="Limit the number of datasets to import")
    parser.add_argument(
        "--results-file",
        type=str,
        default=str(RESULTS_DIR / "dataset_import_results.json"),
        help="File to store import results (default: results/dataset_import_results.json)",
    )

    args = parser.parse_args()

    # Validate required arguments
    from .utils import validate_required_args

    if not validate_required_args(args.api_key, args.space_id):
        return

    # Setup logging
    setup_logging(args.verbose)

    # Import datasets
    result = import_datasets(
        export_dir=args.export_dir,
        space_id=args.space_id,
        arize_api_key=args.api_key,
        limit=args.limit,
        verbose=args.verbose,
        results_file=args.results_file,
    )

    if result:
        save_results_to_file(result, args.results_file, "Dataset import results")
        print(f"Successfully imported {len(result)} datasets")
    else:
        print("No datasets were imported")


if __name__ == "__main__":
    main()
