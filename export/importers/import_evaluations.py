#!/usr/bin/env python3
"""
Phoenix to Arize Evaluation Importer

This script imports evaluations from a Phoenix export directory into Arize.
It reads evaluation data from the Phoenix export format, converts them to the
format expected by Arize, and imports them into the specified projects.
"""

import json
import logging
import os
import traceback
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
from tqdm import tqdm

from .utils import (
    RESULTS_DIR,
    get_projects,
    parse_common_args,
    save_results_to_file,
    setup_logging,
    validate_required_args,
)

# Configure logging
logger = logging.getLogger(__name__)


def load_evaluations(project_dir: Path) -> List[Dict[str, Any]]:
    """
    Load evaluations from a project directory.

    Args:
        project_dir: Path to the project directory

    Returns:
        List of evaluation dictionaries
    """
    # Check for dedicated evaluations file
    evaluations_file = project_dir / "evaluations.json"
    if not evaluations_file.exists():
        return []

    with open(evaluations_file, "r") as f:
        evaluations = json.load(f)

    # Filter out evaluations that might cause problems (incomplete data)
    valid_evaluations = []
    for evaluation in evaluations:
        # Extract span_id from different possible locations
        span_id = None

        # First try direct span_id field (annotations format)
        if evaluation.get("span_id"):
            span_id = evaluation["span_id"]
        # Try context.span_id (evaluations format)
        elif evaluation.get("context", {}).get("context.span_id"):
            span_id = evaluation["context"]["context.span_id"]
        # Try nested context field
        elif evaluation.get("context", {}).get("span_id"):
            span_id = evaluation["context"]["span_id"]

        if not span_id:
            continue

        # Make sure it has a name (try eval_name for evaluations format)
        name = evaluation.get("name") or evaluation.get("eval_name")
        if not name:
            continue

        # Make sure it has a result with either label, score, or explanation
        # Handle both annotations format (result field) and evaluations format (data field)
        result = evaluation.get("result") or evaluation.get("data")
        if not result or (
            result.get("label") is None
            and result.get("score") is None
            and not result.get("explanation")
        ):
            continue

        # Normalize the evaluation format for consistent processing
        normalized_evaluation = {"span_id": span_id, "name": name, "result": result}

        valid_evaluations.append(normalized_evaluation)

    return valid_evaluations


def convert_evaluations_to_dataframe(
    evaluations: List[Dict[str, Any]], project_name: str
) -> pd.DataFrame:
    """
    Convert Phoenix evaluations to a DataFrame format suitable for Arize.

    Args:
        evaluations: List of evaluation dictionaries
        project_name: Name of the project

    Returns:
        DataFrame formatted for Arize evaluations
    """
    if not evaluations:
        return pd.DataFrame()

    # Gather evaluations by span_id to properly format them
    evaluations_by_span = {}
    for evaluation in evaluations:
        span_id = evaluation["span_id"]
        if span_id not in evaluations_by_span:
            evaluations_by_span[span_id] = []
        evaluations_by_span[span_id].append(evaluation)

    # Format rows according to Arize evaluations format
    formatted_rows = []
    for span_id, eval_list in evaluations_by_span.items():
        # Group evaluations by span_id - create one row per span with all evaluations
        row = {
            "context.span_id": span_id,
        }

        # Process each evaluation for this span
        for evaluation in eval_list:
            name = evaluation["name"].lower().replace(" ", "_").replace("-", "_")
            result = evaluation.get("result", {})

            # Add label if present
            if result and result.get("label") is not None:
                row[f"eval.{name}.label"] = result["label"]

            # Add score if present
            if result and result.get("score") is not None:
                row[f"eval.{name}.score"] = float(result["score"])

            # Add explanation if present
            if result and result.get("explanation"):
                row[f"eval.{name}.explanation"] = str(result["explanation"])

        # Only add row if it has some evaluation data
        has_evaluation_data = any(key.startswith("eval.") for key in row.keys())
        if has_evaluation_data:
            formatted_rows.append(row)

    # Create dataframe
    df = pd.DataFrame(formatted_rows)

    # Clean up any NaN values that could cause issues
    for col in df.columns:
        if col.endswith(".label"):
            df[col] = df[col].fillna("Unknown")
        elif col.endswith(".explanation"):
            df[col] = df[col].fillna("")

    return df


def check_traces(api_key: str, space_id: str, project_name: str, developer_key: str = None) -> bool:
    """
    Check if traces exist in Arize for a project.

    Args:
        api_key: Arize API key
        space_id: Arize Space ID
        project_name: Name of the project to check
        developer_key: Arize Developer Key (optional)

    Returns:
        True if project exists in Arize, False otherwise
    """
    try:
        from arize.pandas.logger import Client
    except ImportError as e:
        logger.error(f"Arize Python client import error: {e}")
        return False

    # Initialize Arize client
    logger.info(f"Initializing Arize client with Space ID: {space_id}")
    client_kwargs = {
        "space_id": space_id,
        "api_key": api_key,
    }
    if developer_key:
        client_kwargs["developer_key"] = developer_key

    arize_client = Client(**client_kwargs)

    # Check if project exists by trying to send a test evaluation
    try:
        # Create a minimal test evaluation with an invalid span ID
        test_df = pd.DataFrame(
            {
                "context.span_id": ["test_invalid_span"],
                "eval.test.label": ["test"],
                "eval.test.score": [0.5],
            }
        )

        # Send a single evaluation and catch the specific "span not found" error
        try:
            arize_client.log_evaluations_sync(
                dataframe=test_df,
                project_name=project_name,
            )
            return True
        except Exception as e:
            error_str = str(e)
            # If the error mentions span not found, the project exists
            if "span not found" in error_str.lower() or "Invalid_Traces_Not_Found" in error_str:
                return True
            else:
                return False

    except Exception as e:
        logger.error(f"Error checking project {project_name}: {e}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        logger.error(f"Project {project_name} may not exist in Arize")
        return False


def import_evaluations(
    api_key: str, space_id: str, export_dir: str, results_file: str, developer_key: str = None
) -> Dict[str, Any]:
    """
    Import evaluations from Phoenix export to Arize.

    Args:
        api_key: Arize API key
        space_id: Arize Space ID
        export_dir: Path to Phoenix export directory
        results_file: Path to save results
        developer_key: Arize Developer Key (optional)

    Returns:
        Dictionary with import results
    """
    logger.info("Starting evaluation import process...")

    results = {
        "projects": {},
        "summary": {
            "total_projects": 0,
            "successful_projects": 0,
            "total_evaluations": 0,
            "failed_projects": [],
        },
    }

    try:
        import arize
        from arize.pandas.logger import Client

        logger.info(f"Arize version: {arize.__version__}")
    except ImportError as e:
        logger.error(f"Arize Python client import error: {e}")
        logger.error("Please install with 'pip install arize'")
        return results

    # Define the results directory in the parent directory
    if not results_file.startswith("/"):  # If not an absolute path
        script_dir = Path(__file__).parent.absolute()
        parent_dir = script_dir.parent
        results_dir = parent_dir / "results"
        results_file = str(results_dir / Path(results_file).name)
    else:
        results_dir = os.path.dirname(results_file)

    # Create results directory if it doesn't exist
    os.makedirs(results_dir, exist_ok=True)

    # Initialize Arize client
    logger.info(f"Initializing Arize client with Space ID: {space_id}")
    client_kwargs = {
        "space_id": space_id,
        "api_key": api_key,
    }
    if developer_key:
        client_kwargs["developer_key"] = developer_key

    arize_client = Client(**client_kwargs)

    # Load previous results if they exist
    previous_results = {}
    if os.path.exists(results_file):
        with open(results_file, "r") as f:
            previous_results = json.load(f)

    # Get all projects
    projects = get_projects(export_dir)

    if not projects:
        logger.error("No projects found in the export directory")
        return results

    # Process each project
    for project_name in tqdm(projects, desc="Importing evaluations"):
        # Skip projects that have been successfully imported
        if project_name in previous_results.get("projects", {}) and previous_results["projects"][
            project_name
        ].get("success"):
            logger.info(f"Skipping project {project_name} as it was already imported successfully")
            results["projects"][project_name] = previous_results["projects"][project_name]
            continue

        project_dir = Path(export_dir) / "projects" / project_name

        # Load evaluations
        evaluations = load_evaluations(project_dir)

        if not evaluations:
            logger.info(f"No evaluations found for project {project_name}")
            results["projects"][project_name] = {
                "success": True,
                "evaluations_count": 0,
                "message": "No evaluations found",
            }
            continue

        # Check if the project exists in Arize
        if not check_traces(api_key, space_id, project_name, developer_key):
            logger.warning(
                f"Project {project_name} doesn't exist in Arize yet. Please import traces first."
            )
            results["projects"][project_name] = {
                "success": False,
                "evaluations_count": 0,
                "message": "Project not found in Arize. Import traces first.",
            }
            continue

        # Load traces file to get valid span_ids for this project
        traces_file = project_dir / "traces.json"
        trace_span_ids = set()
        if traces_file.exists():
            try:
                with open(traces_file, "r") as f:
                    traces = json.load(f)
                    # Extract trace and span IDs
                    for trace in traces:
                        for key, value in trace.items():
                            if isinstance(value, str) and (
                                "span_id" in key or "context.span_id" in key
                            ):
                                trace_span_ids.add(value)

                logger.info(f"Found {len(trace_span_ids)} span IDs in traces file")
            except Exception as e:
                logger.warning(f"Could not read traces file: {e}")

        # Filter evaluations to only include those with span_ids that exist in traces
        filtered_evaluations = []
        for evaluation in evaluations:
            if evaluation["span_id"] in trace_span_ids:
                filtered_evaluations.append(evaluation)

        if trace_span_ids and not filtered_evaluations:
            logger.warning("None of the evaluations have matching span IDs in the traces file")
            # Try to use all evaluations anyway
            filtered_evaluations = evaluations
        elif trace_span_ids:
            logger.info(
                f"Filtered to {len(filtered_evaluations)} evaluations with matching span IDs"
            )

        # Convert evaluations to Arize format
        df = convert_evaluations_to_dataframe(filtered_evaluations, project_name)

        if df.empty:
            logger.info(f"No valid evaluations to import for project {project_name}")
            results["projects"][project_name] = {
                "success": True,
                "evaluations_count": 0,
                "message": "No valid evaluations to import",
            }
            continue

        # Log evaluations to Arize
        try:
            # Check column requirements
            required_columns = ["context.span_id"]
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")

            # Make sure at least one evaluation column exists
            evaluation_columns = [col for col in df.columns if col.startswith("eval.")]
            if not evaluation_columns:
                raise ValueError(
                    "No evaluation columns found. Columns must use format: eval.<name>.<type>"
                )

            # Log evaluations in batches to avoid timeouts
            batch_size = 10
            total_evaluations = len(df)
            success_count = 0

            for i in range(0, total_evaluations, batch_size):
                batch_df = df.iloc[i : i + batch_size].copy()
                try:
                    logger.info(
                        f"Sending batch {i//batch_size + 1}/{(total_evaluations-1)//batch_size + 1}"
                        f"({len(batch_df)} evaluations)"
                    )
                    arize_client.log_evaluations_sync(
                        dataframe=batch_df,
                        project_name=project_name,
                    )
                    success_count += len(batch_df)
                except Exception as batch_error:
                    logger.error(f"Error in batch {i//batch_size + 1}: {batch_error}")

            results["projects"][project_name] = {
                "success": success_count > 0,
                "evaluations_count": success_count,
                "message": f"Successfully imported {success_count}/{total_evaluations} evaluations",
                "span_ids": df["context.span_id"].tolist(),
            }
            logger.info(
                f"Successfully imported {success_count}/{total_evaluations} evaluations "
                f"for project {project_name}"
            )

        except Exception as e:
            results["projects"][project_name] = {
                "success": False,
                "evaluations_count": 0,
                "message": f"Error: {str(e)}",
            }

    # Save results
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2)

    # Print summary
    total_success = sum(1 for p in results["projects"].values() if p.get("success"))
    total_evaluations = sum(p.get("evaluations_count", 0) for p in results["projects"].values())
    logger.info(
        f"Import completed: {total_success}/{len(results['projects'])} projects successful,"
        f"{total_evaluations} evaluations imported"
    )

    return results


def main() -> None:
    """Main entry point for the script."""
    parser = parse_common_args("Import Phoenix evaluations to Arize")
    parser.add_argument(
        "--developer-key",
        type=str,
        default=os.getenv("ARIZE_DEVELOPER_KEY"),
        help="Arize Developer Key (default: from ARIZE_DEVELOPER_KEY env var)",
    )
    parser.add_argument(
        "--results-file",
        type=str,
        default=str(RESULTS_DIR / "evaluation_import_results.json"),
        help="File to store import results (default: results/evaluation_import_results.json)",
    )

    args = parser.parse_args()

    # Validate required arguments
    if not validate_required_args(args.api_key, args.space_id):
        return

    # Setup logging
    setup_logging(args.verbose)

    # Import evaluations
    result = import_evaluations(
        api_key=args.api_key,
        space_id=args.space_id,
        export_dir=args.export_dir,
        results_file=args.results_file,
        developer_key=getattr(args, "developer_key", None),
    )

    if result and result.get("projects"):
        save_results_to_file(result, args.results_file, "Evaluation import results")
        successful = result["summary"]["successful_projects"]
        total = result["summary"]["total_projects"]
        print(f"Successfully imported evaluations from {successful}/{total} projects")
    else:
        print("No evaluations were imported")


if __name__ == "__main__":
    main()
