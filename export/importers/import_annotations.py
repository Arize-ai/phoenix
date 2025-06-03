#!/usr/bin/env python3
"""
Phoenix to Arize Annotation Importer

This script imports annotations from a Phoenix export directory into Arize.
It reads annotation data from the Phoenix export format, converts them to the
format expected by Arize, and imports them into the specified projects.
"""

import os
import json
import argparse
import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

import pandas as pd
from tqdm import tqdm

from .utils import (
    get_projects,
    RESULTS_DIR,
    save_results_to_file,
    setup_logging,
    parse_common_args,
    validate_required_args
)

# Configure logging
logger = logging.getLogger(__name__)

def load_annotations(project_dir: Path) -> List[Dict[str, Any]]:
    """
    Load annotations from a project directory.
    
    Args:
        project_dir: Path to the project directory
        
    Returns:
        List of annotation dictionaries
    """
    annotations_file = project_dir / "annotations.json"
    if not annotations_file.exists():
        logger.info(f"No annotations file found for {project_dir.name}")
        return []
    
    with open(annotations_file, 'r') as f:
        annotations = json.load(f)
        
    # Filter out annotations that might cause problems (incomplete data)
    valid_annotations = []
    for annotation in annotations:
        # Skip annotations without required fields
        if not annotation.get('span_id'):
            continue
            
        # Make sure it has a name
        if not annotation.get('name'):
            continue
            
        # Make sure it has a result with either label or score
        result = annotation.get('result', {})
        if not result or (result.get('label') is None and result.get('score') is None and not result.get('explanation')):
            logger.warning(f"Skipping annotation without valid result: {annotation}")
            continue
            
        valid_annotations.append(annotation)
        
    if len(valid_annotations) < len(annotations):
        logger.info(f"Filtered out {len(annotations) - len(valid_annotations)} invalid annotations")
        
    return valid_annotations

def convert_annotations_to_dataframe(
    annotations: List[Dict[str, Any]], 
    project_name: str
) -> pd.DataFrame:
    """
    Convert Phoenix annotations to a DataFrame format suitable for Arize.
    
    Args:
        annotations: List of annotation dictionaries
        project_name: Name of the project
        
    Returns:
        DataFrame formatted for Arize annotations
    """
    if not annotations:
        return pd.DataFrame()
    
    # Gather annotations by span_id to properly format them
    annotations_by_span = {}
    for annotation in annotations:
        span_id = annotation['span_id']
        if span_id not in annotations_by_span:
            annotations_by_span[span_id] = []
        annotations_by_span[span_id].append(annotation)
    
    # Format rows according to Arize format
    formatted_rows = []
    for span_id, anno_list in annotations_by_span.items():
        
        # Create separate rows for each annotation
        for annotation in anno_list:
            name = annotation['name'].replace(' ', '_')
            result = annotation.get('result', {})
            
            # Get timestamp from annotation
            annotation_timestamp = annotation.get('created_at')
            # Convert to nanoseconds
            if isinstance(annotation_timestamp, str):
                # Parse ISO format and convert to nanoseconds
                dt = datetime.fromisoformat(annotation_timestamp.replace('Z', '+00:00'))
                timestamp_ns = int(dt.timestamp() * 1000000000)
            else:
                # Use current time in nanoseconds as fallback
                timestamp_ns = int(datetime.now().timestamp() * 1000000000)
            
            # Get updated_by information
            annotator = annotation.get('annotator_kind')
            updated_by = f"{annotator}"
            
            # Create row for this annotation
            row = {
                'context.span_id': span_id,
                'project_name': project_name,
                'Updated_by': updated_by,
                'updated_at': timestamp_ns
            }
            
            # Add label if present
            if result and result.get('label') is not None:
                row[f'annotation.{name}.label'] = result['label']
                
            # Add score if present    
            if result and result.get('score') is not None:
                row[f'annotation.{name}.score'] = float(result['score'])
                
            # Add note if explanation exists
            if result and result.get('explanation'):
                row['annotation.notes'] = f"{result['explanation']}"
            
            # Only add row if it has some annotation data
            has_annotation_data = any(key.startswith('annotation.') for key in row.keys())
            if has_annotation_data:
                formatted_rows.append(row)
    
    # Create dataframe
    df = pd.DataFrame(formatted_rows)
    
    # Clean up any NaN values that could cause issues
    for col in df.columns:
        if col.endswith('.label') or col.endswith('.updated_by'):
            df[col] = df[col].fillna('Unknown')
    
    return df

def check_traces(api_key: str, space_id: str, project_name: str) -> bool:
    """
    Check if traces exist in Arize for a project.
    
    Args:
        api_key: Arize API key
        space_id: Arize Space ID
        project_name: Name of the project to check
        
    Returns:
        True if project exists in Arize, False otherwise
    """
    try:
        from arize.pandas.logger import Client
        import arize
        logger.info(f"Arize version: {arize.__version__}")
    except ImportError as e:
        logger.error(f"Arize Python client import error: {e}")
        return False

    # Initialize Arize client
    logger.info(f"Initializing Arize client with Space ID: {space_id}")
    arize_client = Client(
        space_id=space_id,
        api_key=api_key,
    )

    # Check if project exists by trying to send a test annotation
    try:
        # Create a minimal test annotation with an invalid span ID
        test_df = pd.DataFrame({
            'context.span_id': ['test_invalid_span'],
            'annotation.test.label': ['test'],
            'project_name': [project_name],
        })
        
        # Send a single annotation and catch the specific "span not found" error
        try:
            arize_client.log_annotations(
                dataframe=test_df,
                project_name=project_name,
            )
            return True
        except Exception as e:
            error_str = str(e)
            # If the error mentions span not found, the project exists
            if "span not found" in error_str.lower() or "Invalid_Traces_Not_Found" in error_str:
                logger.info(f"Project {project_name} exists but test span not found (expected)")
                return True
            else:
                logger.error(f"Project check error: {e}")
                logger.error(f"Project {project_name} may not exist in Arize")
                return False
                
    except Exception as e:
        logger.error(f"Error checking project {project_name}: {e}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        logger.error(f"Project {project_name} may not exist in Arize")
        return False

def import_annotations(
    api_key: str,
    space_id: str,
    export_dir: str,
    results_file: str
) -> Dict[str, Any]:
    """
    Import annotations from Phoenix export to Arize.
    
    Args:
        api_key: Arize API key
        space_id: Arize Space ID
        export_dir: Path to Phoenix export directory
        results_file: Path to save results
        
    Returns:
        Dictionary with import results
    """
    logger.info("Starting annotation import process...")
    
    results = {
        'projects': {},
        'summary': {
            'total_projects': 0,
            'successful_projects': 0,
            'total_annotations': 0,
            'failed_projects': []
        }
    }

    try:
        from arize.pandas.logger import Client
        import arize
        logger.info(f"Arize version: {arize.__version__}")
    except ImportError as e:
        logger.error(f"Arize Python client import error: {e}")
        return results

    # Define the results directory in the parent directory
    if not results_file.startswith('/'):  # If not an absolute path
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
    arize_client = Client(
        space_id=space_id,
        api_key=api_key,
    )
    
    # Load previous results if they exist
    previous_results = {}
    if os.path.exists(results_file):
        with open(results_file, 'r') as f:
            previous_results = json.load(f)
    
    # Get all projects
    projects = get_projects(export_dir)
    
    if not projects:
        logger.error("No projects found in the export directory")
        return results
    
    logger.info(f"Found {len(projects)} projects")
    
    # Process each project
    for project_name in tqdm(projects, desc="Importing annotations"):
        # Skip projects that have been successfully imported
        if project_name in previous_results.get('projects', {}) and previous_results['projects'][project_name].get('success'):
            logger.info(f"Skipping project {project_name} as it was already imported successfully")
            results['projects'][project_name] = previous_results['projects'][project_name]
            continue
            
        project_dir = Path(export_dir) / "projects" / project_name
        
        # Load annotations
        annotations = load_annotations(project_dir)
        
        if not annotations:
            logger.info(f"No annotations found for project {project_name}")
            results['projects'][project_name] = {
                'success': True,
                'annotations_count': 0,
                'message': "No annotations found"
            }
            continue
        
        # Check if the project exists in Arize
        if not check_traces(api_key, space_id, project_name):
            logger.warning(f"Project {project_name} doesn't exist in Arize yet. Make sure to import traces first.")
            results['projects'][project_name] = {
                'success': False,
                'annotations_count': 0,
                'message': "Project not found in Arize. Import traces first."
            }
            continue
            
        # Load traces file to get valid span_ids for this project
        traces_file = project_dir / "traces.json"
        trace_span_ids = set()
        if traces_file.exists():
            try:
                with open(traces_file, 'r') as f:
                    traces = json.load(f)
                    # Extract trace and span IDs
                    for trace in traces:
                        for key, value in trace.items():
                            if isinstance(value, str) and ('span_id' in key or 'context.span_id' in key):
                                trace_span_ids.add(value)
            except Exception as e:
                logger.warning(f"Could not read traces file: {e}")
        
        # Filter annotations to only include those with span_ids that exist in traces
        filtered_annotations = []
        for annotation in annotations:
            if annotation['span_id'] in trace_span_ids:
                filtered_annotations.append(annotation)
        
        if trace_span_ids and not filtered_annotations:
            logger.warning(f"None of the annotations have matching span IDs in the traces file")
            # Try to use all annotations anyway
            filtered_annotations = annotations
        elif trace_span_ids:
            logger.info(f"Filtered to {len(filtered_annotations)} annotations with matching span IDs")
        
        # Convert annotations to Arize format
        df = convert_annotations_to_dataframe(filtered_annotations, project_name)
        
        if df.empty:
            logger.info(f"No valid annotations to import for project {project_name}")
            results['projects'][project_name] = {
                'success': True,
                'annotations_count': 0,
                'message': "No valid annotations to import"
            }
            continue
        
        # Log annotations to Arize
        try:
            # Check column requirements
            required_columns = ['context.span_id']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")
            
            # Make sure at least one annotation column exists
            annotation_columns = [col for col in df.columns if col.startswith('annotation.')]
            if not annotation_columns:
                raise ValueError("No annotation columns found. Columns must use format: annotation.<n>.<type>")
            
            # Log annotations in batches to avoid timeouts
            batch_size = 10
            total_annotations = len(df)
            success_count = 0
            
            for i in range(0, total_annotations, batch_size):
                batch_df = df.iloc[i:i+batch_size].copy()
                try:
                    logger.info(f"Sending batch {i//batch_size + 1}/{(total_annotations-1)//batch_size + 1} ({len(batch_df)} annotations)")
                    response = arize_client.log_annotations(
                        dataframe=batch_df,
                        project_name=project_name,
                    )
                    logger.debug(f"Batch response: {response}")
                    success_count += len(batch_df)
                except Exception as batch_error:
                    logger.error(f"Error in batch {i//batch_size + 1}: {batch_error}")
            
            results['projects'][project_name] = {
                'success': success_count > 0,
                'annotations_count': success_count,
                'message': f"Successfully imported {success_count}/{total_annotations} annotations",
                'span_ids': df['context.span_id'].tolist()
            }
            logger.info(f"Successfully imported {success_count}/{total_annotations} annotations for project {project_name}")
            
        except Exception as e:
            logger.error(f"Error importing annotations for project {project_name}: {e}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            results['projects'][project_name] = {
                'success': False,
                'annotations_count': 0,
                'message': f"Error: {str(e)}"
            }
    
    # Save results
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    total_success = sum(1 for p in results['projects'].values() if p.get('success'))
    total_annotations = sum(p.get('annotations_count', 0) for p in results['projects'].values())
    logger.info(f"Import completed: {total_success}/{len(results['projects'])} projects successful, {total_annotations} annotations imported")
    
    return results

def main() -> None:
    """Main entry point for the script."""
    parser = parse_common_args('Import Phoenix annotations to Arize')
    parser.add_argument(
        '--results-file',
        type=str,
        default=str(RESULTS_DIR / 'annotation_import_results.json'),
        help='File to store import results (default: results/annotation_import_results.json)'
    )
    
    args = parser.parse_args()
    
    # Validate required arguments
    if not validate_required_args(args.api_key, args.space_id):
        return
    
    # Setup logging
    setup_logging(args.verbose)
    
    # Import annotations
    result = import_annotations(
        api_key=args.api_key,
        space_id=args.space_id,
        export_dir=args.export_dir,
        results_file=args.results_file
    )
    
    if result and result.get('projects'):
        save_results_to_file(result, args.results_file, "Annotation import results")
        successful = result['summary']['successful_projects']
        total = result['summary']['total_projects']
        print(f"Successfully imported annotations from {successful}/{total} projects")
    else:
        print("No annotations were imported")

if __name__ == "__main__":
    main() 