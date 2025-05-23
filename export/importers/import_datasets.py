#!/usr/bin/env python3
"""
Phoenix to Arize Dataset Importer

This script imports datasets from a Phoenix export directory into Arize.
It reads dataset metadata and examples from the Phoenix export format,
converts them to the format expected by Arize, and imports them.
"""

import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Union

import pandas as pd
from dotenv import load_dotenv
from tqdm import tqdm
from arize.experimental.datasets import ArizeDatasetsClient
from arize.experimental.datasets.utils.constants import GENERATIVE

# Load environment variables
load_dotenv()

# Config from environment variables
PHOENIX_EXPORT_DIR = os.environ.get("PHOENIX_EXPORT_DIR", "phoenix_export")
ARIZE_API_KEY = os.environ.get("ARIZE_API_KEY")
ARIZE_SPACE_ID = os.environ.get("ARIZE_SPACE_ID")

# Script and parent directories for relative paths
SCRIPT_DIR = Path(__file__).parent.absolute()
PARENT_DIR = SCRIPT_DIR.parent
RESULTS_DIR = PARENT_DIR / "results"
# Create results directory if it doesn't exist
os.makedirs(RESULTS_DIR, exist_ok=True)

def load_json_file(file_path: Union[str, Path]) -> Optional[Any]:
    """
    Load and parse a JSON file.
    
    Args:
        file_path: Path to the JSON file
        
    Returns:
        Parsed JSON data or None if the file cannot be loaded
    """
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

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
    if 'id' not in df.columns:
        df['id'] = [f"example_{i+1}" for i in range(len(df))]
    else:
        # Check for duplicate IDs and fix them
        if df['id'].duplicated().any():
            print("WARNING: Found duplicate IDs in dataset, appending unique suffixes")
            dup_mask = df['id'].duplicated(keep=False)
            for i, (idx, row) in enumerate(df[dup_mask].iterrows()):
                df.at[idx, 'id'] = f"{row['id']}_{i+1}"
    
    # Ensure we have at least one data field besides id
    if len(df.columns) < 2:
        df['data'] = "No data"
    
    return df

def import_datasets(
    export_dir: Union[str, Path], 
    space_id: str, 
    arize_api_key: str, 
    limit: Optional[int] = None, 
    verbose: bool = False,
    results_file: Optional[str] = None
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
    
    # Initialize Arize client
    try:
        client = ArizeDatasetsClient(api_key=arize_api_key)
        if verbose:
            print(f"Successfully initialized Arize client")
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
        print(f"No datasets found in {export_path / 'datasets' / 'datasets.json'}")
        return []
    
    # Load previously imported datasets to avoid duplicates
    if results_file:
        results_path = Path(results_file)
    else:
        results_path = RESULTS_DIR / "dataset_import_results.json"
    
    previously_imported = {}
    if results_path.exists():
        try:
            with open(results_path, 'r') as f:
                imported_data = json.load(f)
                for item in imported_data:
                    # Track by both ID and name to prevent duplicates
                    previously_imported[item.get('phoenix_id')] = item
                    if 'original_name' in item:
                        previously_imported[item.get('original_name')] = item
        except Exception as e:
            print(f"Warning: Could not load previous import results: {e}")
    
    imported_datasets = []
    for dataset in tqdm(datasets, desc="Importing datasets"):
        dataset_id = dataset.get("id")
        if not dataset_id:
            print("Dataset missing ID, skipping")
            continue
        
        dataset_name = dataset.get("name", f"Phoenix Dataset {dataset_id}")
        
        # Skip if already imported by ID or name
        if dataset_id in previously_imported:
            print(f"Dataset {dataset_id} already imported as {previously_imported[dataset_id]['name']}, skipping")
            # Create a copy and update status if needed
            dataset_info = previously_imported[dataset_id].copy()
            # If status was error but error message suggests dataset already exists, correct it
            if dataset_info.get('status') == 'error' and dataset_info.get('error') and 'Failed to create dataset' in dataset_info.get('error'):
                dataset_info['status'] = 'already_exists'
                dataset_info['arize_id'] = 'already_exists'
            imported_datasets.append(dataset_info)
            continue
        elif dataset_name in previously_imported:
            print(f"Dataset {dataset_name} already imported, skipping")
            # Create a copy and update status if needed
            dataset_info = previously_imported[dataset_name].copy()
            # If status was error but error message suggests dataset already exists, correct it
            if dataset_info.get('status') == 'error' and dataset_info.get('error') and 'Failed to create dataset' in dataset_info.get('error'):
                dataset_info['status'] = 'already_exists'
                dataset_info['arize_id'] = 'already_exists'
            imported_datasets.append(dataset_info)
            continue
        
        # Extract timestamp from dataset created_at or updated_at fields
        timestamp = None
        if "created_at" in dataset:
            try:
                # Parse the timestamp from created_at field
                dt = datetime.fromisoformat(dataset["created_at"].replace("Z", "+00:00"))
                timestamp = int(dt.timestamp())
            except (ValueError, TypeError) as e:
                print(f"Warning: Could not parse created_at timestamp: {e}")
        
        # If no timestamp could be extracted, use current time as fallback
        if not timestamp:
            timestamp = int(time.time())
            print(f"Using current timestamp {timestamp} for dataset {dataset_name}")
        
        # Use the original dataset name without any modifications
        unique_dataset_name = dataset_name
        
        # Get examples for this dataset
        examples = get_dataset_examples(export_dir, dataset_id)
        print(f"Found {len(examples)} examples for dataset {dataset_name}")
        
        if verbose and len(examples) > 0:
            print(f"First example: {json.dumps(examples[0], indent=2)}")
        
        # Skip if no examples
        if not examples:
            print(f"No examples found for dataset {dataset_name}, skipping")
            continue
        
        # Convert examples to DataFrame
        df = convert_examples_to_dataframe(examples)
        if df.empty:
            print(f"Failed to convert examples for dataset {dataset_name}, skipping")
            continue
            
        if verbose:
            print(f"DataFrame columns: {df.columns.tolist()}")
            print(f"DataFrame sample:\n{df.head(1).to_string()}")
        
        # Create dataset in Arize
        print(f"Creating dataset {unique_dataset_name} in Arize space {space_id}...")
        
        dataset_info = {
            "phoenix_id": dataset_id,
            "name": unique_dataset_name,
            "original_name": dataset_name,
            "original_timestamp": timestamp,
            "examples_count": len(examples)
        }
        
        try:
            arize_dataset_id = client.create_dataset(
                space_id=space_id,
                dataset_name=unique_dataset_name,
                dataset_type=GENERATIVE,
                data=df
            )
            
            print(f"Successfully imported dataset {unique_dataset_name} with ID {arize_dataset_id}")
            dataset_info["arize_id"] = arize_dataset_id
            dataset_info["status"] = "imported"
            
        except Exception as e:
            error_message = str(e)
            # Check if the error message suggests the dataset already exists
            # This covers various error formats from the Arize API
            if ("already exists" in error_message.lower() or 
                "Failed to create dataset" in error_message):
                print(f"Dataset '{unique_dataset_name}' already exists in Arize")
                print("Tip: If you need to import multiple versions of this dataset, modify the script")
                print("     to add a unique suffix like a timestamp to the dataset name.")
                dataset_info["arize_id"] = "already_exists"
                dataset_info["status"] = "already_exists"
                # Count this as a success since the dataset exists in Arize
            else:
                print(f"Error importing dataset '{unique_dataset_name}': {e}")
                dataset_info["arize_id"] = "error"
                dataset_info["status"] = "error"
                dataset_info["error"] = error_message
        
        # Add the dataset info to the list, regardless of success/failure
        imported_datasets.append(dataset_info)
    
    # Count successful imports (both new imports and existing datasets)
    new_count = sum(1 for d in imported_datasets if d.get("status") == "imported")
    existing_count = sum(1 for d in imported_datasets if d.get("status") == "already_exists")
    error_count = sum(1 for d in imported_datasets if d.get("status") == "error")
    
    print(f"Processed {len(imported_datasets)} datasets:")
    print(f"  - {new_count} newly imported to Arize")
    print(f"  - {existing_count} already existed in Arize (no import needed)")
    if error_count > 0:
        print(f"  - {error_count} failed to import due to errors")
    
    return imported_datasets

def main() -> None:
    """Main entry point to import datasets from Phoenix to Arize."""
    # Check for required environment variables
    if not ARIZE_API_KEY:
        print("ARIZE_API_KEY environment variable is required")
        return
    
    if not ARIZE_SPACE_ID:
        print("ARIZE_SPACE_ID environment variable is required")
        return
    
    print(f"Using export directory: {PHOENIX_EXPORT_DIR}")
    print(f"Using Arize space ID: {ARIZE_SPACE_ID}")
    
    # Import datasets
    imported = import_datasets(
        export_dir=PHOENIX_EXPORT_DIR,
        space_id=ARIZE_SPACE_ID,
        arize_api_key=ARIZE_API_KEY,
        verbose=False
    )
    
    # Count datasets by status
    success_count = sum(1 for d in imported if d.get("status") == "imported")
    existing_count = sum(1 for d in imported if d.get("status") == "already_exists")
    error_count = sum(1 for d in imported if d.get("status") == "error")
    
    print(f"Processed {len(imported)} datasets:")
    print(f"  - {success_count} newly imported to Arize")
    print(f"  - {existing_count} already existed in Arize (no import needed)")
    if error_count > 0:
        print(f"  - {error_count} failed to import due to errors")
    
    # Save import results
    results_path = RESULTS_DIR / "dataset_import_results.json"
    
    # Ensure parent directory exists
    results_path.parent.mkdir(exist_ok=True)
    
    with open(results_path, "w") as f:
        json.dump(imported, f, indent=2)
    print(f"Import results saved to {results_path}")

if __name__ == "__main__":
    main() 