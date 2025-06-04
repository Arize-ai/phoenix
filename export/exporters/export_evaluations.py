#!/usr/bin/env python3
"""
Phoenix Evaluations Exporter

This module handles exporting evaluations

Usage:
  from exporters import export_evaluations

  # Export evaluations for all projects
  export_evaluations.export_evaluations(
      client=client,
      output_dir="./phoenix_export/projects",
      project_names=None  # Export all projects
  )

  # Export evaluations for specific projects
  export_evaluations.export_evaluations(
      client=client,
      output_dir="./phoenix_export/projects",
      project_names=["project1", "project2"]
  )
"""

import io
import json
import logging
import os
from typing import Dict, List, Optional, Union

import httpx
from tqdm import tqdm

# Handle both direct execution and module import
try:
    from .utils import get_projects, save_json
except ImportError:
    from utils import get_projects, save_json

# Import pandas for data handling
try:
    import pandas as pd
except ImportError:
    pd = None

# Configure logging
logger = logging.getLogger(__name__)


def get_evaluations(client: httpx.Client, project_name: str) -> List[Dict]:
    """
    Get evaluations for a specific project.

    Args:
        client: HTTPX client
        project_name: Name of the project

    Returns:
        List of evaluation dictionaries
    """
    try:
        response = client.get("/v1/evaluations", params={"project_name": project_name})
        response.raise_for_status()

        # The evaluations endpoint returns PyArrow data, we need to handle this carefully
        content_type = response.headers.get("content-type", "")

        if "application/x-pandas-arrow" in content_type:
            # This is PyArrow format, we need to convert it to JSON-serializable format
            return _handle_pyarrow_evaluations(response.content)
        else:
            # JSON response
            data = response.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "data" in data:
                return data.get("data", [])
            else:
                return [data] if data else []

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.info(f"No evaluations found for project {project_name}")
            return []
        logger.error(f"Error fetching evaluations for project {project_name}: {e}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding evaluations response for project {project_name}: {e}")
        return []


def _handle_pyarrow_evaluations(content: bytes) -> List[Dict]:
    """
    Handle PyArrow content from evaluations endpoint.

    Args:
        content: Raw bytes from the response

    Returns:
        List of evaluation dictionaries with proper structure
    """
    try:
        # Try to import PyArrow for proper handling
        try:
            import pyarrow as pa

            # Read PyArrow data
            with io.BytesIO(content) as buffer:
                # This might be a stream of multiple PyArrow tables
                tables = []
                try:
                    reader = pa.ipc.open_stream(buffer)
                    for batch in reader:
                        table = pa.Table.from_batches([batch])
                        tables.append(table)
                except Exception:
                    # Try reading as a single table
                    buffer.seek(0)
                    try:
                        table = pa.ipc.open_file(buffer).read_all()
                        tables.append(table)
                    except Exception:
                        logger.warning("Could not parse PyArrow data, treating as binary")
                        return []

                # Process each table and extract structured evaluation data
                all_evaluations = []
                for table in tables:
                    df = table.to_pandas()

                    # Get metadata from the schema if available
                    schema_metadata = table.schema.metadata or {}
                    eval_metadata = {}

                    for key, value in schema_metadata.items():
                        try:
                            key_str = key.decode("utf-8") if isinstance(key, bytes) else str(key)
                            value_str = (
                                value.decode("utf-8") if isinstance(value, bytes) else str(value)
                            )
                            if key_str == "arize":
                                eval_metadata = json.loads(value_str)
                                break
                        except Exception:
                            continue

                    # Extract evaluations with proper structure
                    evaluations = _extract_evaluations_from_dataframe(df, eval_metadata)
                    all_evaluations.extend(evaluations)

                return all_evaluations

        except ImportError:
            logger.warning("PyArrow not available, cannot parse evaluation data properly")
            return []

    except Exception as e:
        logger.error(f"Error handling PyArrow evaluations data: {e}")
        return []


def _extract_evaluations_from_dataframe(df, metadata: Dict) -> List[Dict]:
    """
    Extract structured evaluations from a pandas DataFrame.

    Args:
        df: Pandas DataFrame with evaluation data
        metadata: Metadata about the evaluation

    Returns:
        List of structured evaluation dictionaries
    """
    evaluations = []

    # Get evaluation name from metadata
    eval_name = metadata.get("eval_name", "unknown")
    eval_type = metadata.get("eval_type", "SpanEvaluations")

    # Reset index to make index columns available as regular columns
    df_reset = df.reset_index()

    # Convert DataFrame to records, preserving all columns
    records = df_reset.to_dict("records")

    # For each record, create a structured evaluation
    for record in records:
        evaluation = {"eval_name": eval_name, "eval_type": eval_type, "metadata": metadata}

        # Extract context information (span_id, trace_id, document_position)
        context = {}
        eval_data = {}

        for key, value in record.items():
            if pd and pd.isna(value):
                value = None

            if key.startswith("context."):
                context[key] = value
            elif key.startswith("eval."):
                # Handle nested evaluation structure
                eval_parts = key.split(".")
                if len(eval_parts) >= 3:  # eval.{name}.{field}
                    eval_category = eval_parts[1]
                    field = eval_parts[2]

                    if eval_category not in eval_data:
                        eval_data[eval_category] = {}
                    eval_data[eval_category][field] = value
                else:
                    eval_data[key] = value
            else:
                # Direct fields (label, score, explanation, or other index fields)
                eval_data[key] = value

        evaluation["context"] = context
        evaluation["data"] = eval_data

        evaluations.append(evaluation)

    return evaluations


def export_project_evaluations(
    client: httpx.Client, project_name: str, output_dir: str, verbose: bool = False
) -> Dict[str, Union[str, int]]:
    """
    Export evaluations for a specific project.

    Args:
        client: HTTPX client
        project_name: Name of the project
        output_dir: Directory to save the exported data
        verbose: Whether to enable verbose output

    Returns:
        Dictionary with export results
    """
    project_dir = os.path.join(output_dir, project_name)
    os.makedirs(project_dir, exist_ok=True)

    result = {"project_name": project_name, "evaluation_count": 0, "status": "exported"}

    try:
        logger.info(f"Fetching evaluations for project {project_name}...")
        evaluations = get_evaluations(client, project_name)

        if evaluations:
            result["evaluation_count"] = len(evaluations)
            logger.info(f"Retrieved {len(evaluations)} evaluations for project {project_name}")

            # Save evaluations to file
            save_json(evaluations, os.path.join(project_dir, "evaluations.json"))

            if verbose:
                # Group evaluations by type for reporting
                eval_types = {}
                eval_names = {}
                for eval_item in evaluations:
                    eval_type = eval_item.get("eval_type", "unknown")
                    eval_name = eval_item.get("eval_name", "unknown")

                    eval_types[eval_type] = eval_types.get(eval_type, 0) + 1
                    eval_names[eval_name] = eval_names.get(eval_name, 0) + 1

                logger.debug(f"Evaluation breakdown for {project_name}:")
                logger.debug(f"  By type: {eval_types}")
                logger.debug(f"  By name: {eval_names}")
        else:
            logger.info(f"No evaluations found for project {project_name}")

        return result

    except Exception as e:
        logger.error(f"Error during evaluations export for {project_name}: {e}")
        result["status"] = "error"
        result["error"] = str(e)
        return result


def export_evaluations(
    client: httpx.Client,
    output_dir: str,
    project_names: Optional[List[str]] = None,
    verbose: bool = False,
    results_file: Optional[str] = None,
) -> Dict[str, Dict]:
    """
    Export evaluations for multiple projects.

    Args:
        client: HTTPX client
        output_dir: Directory to save the exported data
        project_names: List of project names to export (None for all projects)
        verbose: Whether to enable verbose output
        results_file: Path to save the results JSON

    Returns:
        Dictionary with export results for each project
    """
    os.makedirs(output_dir, exist_ok=True)

    if verbose:
        logger.setLevel(logging.DEBUG)

    results = {}

    try:
        # Get all projects if project_names is None
        if project_names is None:
            logger.info("Fetching list of projects...")
            projects = get_projects(client)
            project_names = [p["name"] for p in projects]

        if not project_names:
            logger.warning("No projects found or provided")
            return results

        logger.info(f"Found {len(project_names)} projects to export evaluations for")

        # Export evaluations for each project
        for project_name in tqdm(project_names, desc="Exporting evaluations"):
            results[project_name] = export_project_evaluations(
                client=client, project_name=project_name, output_dir=output_dir, verbose=verbose
            )

        logger.info(f"Evaluations export completed successfully. Data saved to {output_dir}")

        # Save results to file if requested
        if results_file:
            save_json(results, results_file)
            logger.info(f"Export results saved to {results_file}")

        return results

    except Exception as e:
        logger.error(f"Error during evaluations export: {e}")
        if results_file:
            save_json({"error": str(e), "projects": results}, results_file)
        return results


if __name__ == "__main__":
    import argparse

    from dotenv import load_dotenv

    load_dotenv()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    parser = argparse.ArgumentParser(description="Export evaluations from a Phoenix server")

    parser.add_argument(
        "--base-url",
        type=str,
        default=os.environ.get("PHOENIX_ENDPOINT"),
        help="Phoenix server base URL (default: from PHOENIX_ENDPOINT env var)",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=os.environ.get("PHOENIX_API_KEY"),
        help="Phoenix API key for authentication (default: from PHOENIX_API_KEY env var)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./phoenix_export/projects",
        help="Directory to save exported data (default: ./phoenix_export/projects)",
    )
    parser.add_argument(
        "--project",
        type=str,
        action="append",
        help="Project name to export evaluations for (can be used multiple times)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("--results-file", type=str, help="Path to save export results JSON")

    args = parser.parse_args()

    if not args.base_url:
        logger.error(
            "No Phoenix base URL provided. Set PHOENIX_ENDPOINT env variable or use --base-url"
        )
        exit(1)

    # Create HTTPX client
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"

    client = httpx.Client(base_url=args.base_url.rstrip("/"), headers=headers)

    # Export evaluations
    results = export_evaluations(
        client=client,
        output_dir=args.output_dir,
        project_names=args.project,  # None if no --project arguments were provided
        verbose=args.verbose,
        results_file=args.results_file,
    )

    # Print summary
    success_count = sum(1 for p in results.values() if p.get("status") == "exported")
    error_count = sum(1 for p in results.values() if p.get("status") == "error")
    total_evaluations = sum(p.get("evaluation_count", 0) for p in results.values())

    print("\nExport Summary:")
    print(f"- Projects: {len(results)} total, {success_count} succeeded, {error_count} failed")
    print(f"- Exported: {total_evaluations} evaluations")

    if args.results_file:
        print(f"Detailed results saved to: {args.results_file}")

    if error_count > 0:
        exit(1)
