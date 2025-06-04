#!/usr/bin/env python3
"""
Phoenix to Arize Trace Importer

This script imports traces from a Phoenix export directory into Arize.
It reads trace data from the Phoenix export format, converts it to the
format expected by Arize, and imports them into the specified project.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd
from arize.pandas.logger import Client
from tqdm import tqdm

from .utils import (
    RESULTS_DIR,
    get_projects,
    load_json_file,
    parse_common_args,
    phoenix_timestamp_to_nanos_utc,
    save_results_to_file,
    setup_logging,
)


def get_project_traces(export_dir: Union[str, Path], project_name: str) -> List[Dict]:
    """
    Get traces for a specific project.

    Args:
        export_dir: Path to the Phoenix export directory
        project_name: Name of the project

    Returns:
        List of trace dictionaries
    """
    traces_path = Path(export_dir) / "projects" / project_name / "traces.json"
    if not traces_path.exists():
        print(f"Traces file not found: {traces_path}")
        return []

    return load_json_file(traces_path) or []


def convert_traces_to_dataframe(traces: List[Dict], verbose: bool = False) -> pd.DataFrame:
    """
    Convert trace data to a pandas DataFrame suitable for Arize.

    Args:
        traces: List of trace dictionaries from Phoenix
        verbose: Whether to print verbose debug information

    Returns:
        DataFrame formatted for Arize
    """
    if not traces:
        return pd.DataFrame()

    rows = []
    for i, trace in enumerate(traces):
        try:
            # Phoenix export format has numeric prefixes on keys like "0_context.span_id"
            # We need to find the span_id and trace_id by pattern matching
            span_id = None
            trace_id = None
            name = None

            # First pass: find important identifiers and the name
            for key in trace.keys():
                if key.endswith("context.span_id"):
                    span_id = trace[key]
                elif key.endswith("context.trace_id"):
                    trace_id = trace[key]
                elif key.endswith("name") and "attributes" not in key:
                    # This should catch keys like "1_name" but not "attributes.llm.model_name"
                    name = trace[key]
                    if verbose and i == 0:
                        print(f"Found name '{name}' from key '{key}'")

            if not span_id or not trace_id:
                if verbose:
                    print(f"Skipping trace #{i} - missing span_id or trace_id: {trace.keys()}")
                continue

            # Create a new row with properly formatted fields for Arize
            row = {
                "context.span_id": span_id,
                "context.trace_id": trace_id,
            }

            # Set the name if found
            if name:
                row["name"] = name
            else:
                if verbose:
                    name_keys = [k for k in trace.keys() if "name" in k]
                    print(f"Trace #{i} missing name field, keys: {name_keys}")
                continue

            # Extract other important fields
            for key in trace.keys():
                # Skip name because we already handled it
                if key.endswith("name") and "attributes" not in key:
                    continue
                # Extract start_time
                elif key.endswith("start_time"):
                    row["start_time"] = phoenix_timestamp_to_nanos_utc(trace[key])
                # Extract end_time
                elif key.endswith("end_time"):
                    row["end_time"] = phoenix_timestamp_to_nanos_utc(trace[key])
                # Extract status
                elif key.endswith("status_code"):
                    row["status"] = trace[key]
                # Extract parent_id
                elif key.endswith("parent_id"):
                    row["parent_id"] = trace[key]

            # Handle attributes (keys starting with "attributes.")
            for key in trace.keys():
                if "attributes." in key:
                    # Remove numeric prefix and keep just the attribute part
                    attr_key = key.split("attributes.")[-1]
                    attr_value = trace[key]

                    # Handle specific fields that need special processing
                    if attr_key == "tool.parameters" and attr_value is not None:
                        # Convert to JSON string if it's not already a string
                        if not isinstance(attr_value, str):
                            try:
                                attr_value = json.dumps(attr_value)
                            except (TypeError, ValueError):
                                attr_value = str(attr_value)

                    row[f"attributes.{attr_key}"] = attr_value

            # Add to the list of rows
            rows.append(row)

        except Exception as e:
            if verbose:
                print(f"Error processing trace #{i}: {str(e)}")

    if not rows:
        return pd.DataFrame()

    # Convert to DataFrame
    df = pd.DataFrame(rows)

    # Ensure critical columns exist
    required_columns = ["context.span_id", "context.trace_id", "name"]
    for col in required_columns:
        if col not in df.columns:
            if verbose:
                print(f"Required column {col} missing from dataframe")
            return pd.DataFrame()

    if verbose:
        print(f"Successfully converted {len(df)} traces to dataframe")

    return df


def import_traces(
    export_dir: Union[str, Path],
    space_id: str,
    arize_api_key: str,
    verbose: bool = False,
    results_file: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Import traces from Phoenix export to Arize.

    Args:
        export_dir: Path to the Phoenix export directory
        space_id: Arize Space ID to import into
        arize_api_key: Arize API key for authentication
        verbose: Enable verbose output
        results_file: Path to save import results (optional)

    Returns:
        Dictionary of import results by project
    """

    # Setup logging
    setup_logging(verbose)

    # Initialize Arize client
    try:
        client = Client(space_id=space_id, api_key=arize_api_key)
        print("Successfully initialized Arize client")
    except Exception as e:
        print(f"Failed to initialize Arize client: {str(e)}")
        return {}

    # Find all projects with traces
    projects = get_projects(export_dir)

    # Filter to only projects that have a traces.json file
    projects_with_traces = []
    for project_name in projects:
        traces_path = Path(export_dir) / "projects" / project_name / "traces.json"
        if traces_path.exists():
            projects_with_traces.append(project_name)

    print(f"Found {len(projects_with_traces)} projects to import traces from")

    # Load previous import results if they exist
    if results_file:
        results_path = Path(results_file)
    else:
        results_path = RESULTS_DIR / "trace_import_results.json"

    previous_results = {}
    if results_path.exists():
        try:
            with open(results_path, "r") as f:
                previous_results = json.load(f)
        except Exception as e:
            print(f"Error loading previous results: {str(e)}")

    # Import traces for each project
    results = previous_results.copy()

    for project_name in tqdm(projects_with_traces, desc="Importing traces by project"):
        # Skip if already successfully imported
        if project_name in results and results[project_name].get("status") == "imported":
            print(f"Project {project_name} already imported, skipping")
            continue

        import_info = {
            "project_name": project_name,
            "status": "pending",
            "message": "",
            "trace_count": 0,
            "import_date": datetime.now().isoformat(),
        }

        try:
            # Read traces
            traces = get_project_traces(export_dir, project_name)

            trace_count = len(traces)
            print(f"Found {trace_count} traces for project {project_name}")

            if trace_count == 0:
                print(f"No traces found for project {project_name}, skipping")
                import_info["status"] = "skipped"
                import_info["message"] = "No traces found"
                results[project_name] = import_info
                continue

            # Convert traces to DataFrame
            df = convert_traces_to_dataframe(traces, verbose=verbose)

            if df.empty:
                print("No valid traces found to convert")
                import_info["status"] = "failed"
                import_info["message"] = "Failed to convert traces to dataframe"
                results[project_name] = import_info
                print(f"Failed to convert traces for project {project_name}, skipping")
                continue

            # Use the original project name
            arize_project_name = project_name

            try:
                client.log_spans(dataframe=df, project_name=arize_project_name)

                print(f"Successfully imported {len(df)} traces to project {arize_project_name}")
                import_info["status"] = "imported"
                import_info["message"] = f"Imported {len(df)} traces"
                import_info["trace_count"] = len(df)
                import_info["arize_project_name"] = arize_project_name

            except Exception as e:
                error_message = str(e)
                print(f"Error importing traces for project {project_name}: {error_message}")
                import_info["status"] = "failed"
                import_info["message"] = f"Error: {error_message}"

        except Exception as e:
            error_message = str(e)
            print(f"Error processing project {project_name}: {error_message}")
            import_info["status"] = "failed"
            import_info["message"] = f"Error: {error_message}"

        results[project_name] = import_info

    # Save results to file
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    # Count successfully imported projects
    imported_count = sum(1 for info in results.values() if info.get("status") == "imported")
    print(f"Successfully imported traces from {imported_count} projects")

    return results


def main() -> None:
    """Main entry point for the script."""
    parser = parse_common_args("Import Phoenix traces to Arize")
    parser.add_argument(
        "--results-file",
        type=str,
        default=str(RESULTS_DIR / "trace_import_results.json"),
        help="File to store import results (default: results/trace_import_results.json)",
    )

    args = parser.parse_args()

    # Validate required arguments
    from .utils import validate_required_args

    if not validate_required_args(args.api_key, args.space_id):
        return

    # Setup logging
    setup_logging(args.verbose)

    # Import traces
    result = import_traces(
        export_dir=args.export_dir,
        space_id=args.space_id,
        arize_api_key=args.api_key,
        verbose=args.verbose,
        results_file=args.results_file,
    )

    if result:
        save_results_to_file(result, args.results_file, "Trace import results")
        success_count = sum(
            1 for r in result.values() if isinstance(r, dict) and r.get("status") == "imported"
        )
        print(f"Successfully imported traces from {success_count} projects")
    else:
        print("No traces were imported")


if __name__ == "__main__":
    main()
