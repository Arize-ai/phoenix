#!/usr/bin/env python3
"""
Phoenix to Arize Evaluation Importer

This script imports evaluations from a Phoenix export directory into Arize.
It reads evaluation data from the Phoenix export format, converts them to the
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
from dotenv import load_dotenv
from tqdm import tqdm

# Load environment variables
load_dotenv()

# Script and parent directories for relative paths
SCRIPT_DIR = Path(__file__).parent.absolute()
PARENT_DIR = SCRIPT_DIR.parent
RESULTS_DIR = PARENT_DIR / "results"
# Create results directory if it doesn't exist
os.makedirs(RESULTS_DIR, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        Parsed command line arguments
    """
    parser = argparse.ArgumentParser(description='Import Phoenix evaluations to Arize')
    parser.add_argument(
        '--api-key', 
        type=str, 
        default=os.getenv('ARIZE_API_KEY'),
        help='Arize API key (default: from ARIZE_API_KEY env var)'
    )
    parser.add_argument(
        '--space-id', 
        type=str, 
        default=os.getenv('ARIZE_SPACE_ID'),
        help='Arize Space ID (default: from ARIZE_SPACE_ID env var)'
    )
    parser.add_argument(
        '--developer-key', 
        type=str, 
        default=os.getenv('ARIZE_DEVELOPER_KEY'),
        help='Arize Developer Key (default: from ARIZE_DEVELOPER_KEY env var)'
    )
    parser.add_argument(
        '--export-dir', 
        type=str, 
        default=os.getenv('PHOENIX_EXPORT_DIR', 'phoenix_export'),
        help='Phoenix export directory (default: from PHOENIX_EXPORT_DIR env var or "phoenix_export")'
    )
    parser.add_argument(
        '--results-file',
        type=str,
        default=str(RESULTS_DIR / 'evaluation_import_results.json'),
        help='File to store import results (default: results/evaluation_import_results.json)'
    )
    return parser.parse_args()

def get_projects(export_dir: str) -> List[str]:
    """
    Get all project names from the Phoenix export directory.
    
    Args:
        export_dir: Path to the Phoenix export directory
        
    Returns:
        List of project names
    """
    projects_dir = Path(export_dir) / "projects"
    if not projects_dir.exists():
        logger.error(f"Projects directory not found: {projects_dir}")
        return []
    
    # Return list of project directories
    return [d.name for d in projects_dir.iterdir() if d.is_dir()]

def load_evaluations(project_dir: Path) -> List[Dict[str, Any]]:
    """
    Load evaluations from a project directory.
    
    Args:
        project_dir: Path to the project directory
        
    Returns:
        List of evaluation dictionaries
    """
    # Check for dedicated evaluations file first
    evaluations_file = project_dir / "evaluations.json"
    if evaluations_file.exists():
        with open(evaluations_file, 'r') as f:
            evaluations = json.load(f)
    else:
        # Fall back to annotations file and filter for evaluations
        annotations_file = project_dir / "annotations.json"
        if not annotations_file.exists():
            logger.info(f"No evaluations or annotations file found for {project_dir.name}")
            return []
        
        with open(annotations_file, 'r') as f:
            all_annotations = json.load(f)
            
        # Filter for evaluations (assuming evaluations have specific characteristics)
        # This could be based on annotator_kind, name patterns, or other fields
        evaluations = []
        for item in all_annotations:
            # Check if this looks like an evaluation (has score, or specific naming patterns)
            result = item.get('result', {})
            name = item.get('name', '').lower()
            
            # Consider it an evaluation if it has a score, or matches evaluation naming patterns
            is_evaluation = (
                result.get('score') is not None or
                any(eval_term in name for eval_term in ['eval', 'quality', 'relevance', 'accuracy', 'toxicity', 'hallucination', 'safety'])
            )
            
            if is_evaluation:
                evaluations.append(item)
                
    # Filter out evaluations that might cause problems (incomplete data)
    valid_evaluations = []
    for evaluation in evaluations:
        # Extract span_id from different possible locations
        span_id = None
        
        # First try direct span_id field (annotations format)
        if evaluation.get('span_id'):
            span_id = evaluation['span_id']
        # Try context.span_id (evaluations format)
        elif evaluation.get('context', {}).get('context.span_id'):
            span_id = evaluation['context']['context.span_id']
        # Try nested context field
        elif evaluation.get('context', {}).get('span_id'):
            span_id = evaluation['context']['span_id']
            
        if not span_id:
            logger.warning(f"Skipping evaluation without span_id: {evaluation}")
            continue
            
        # Make sure it has a name (try eval_name for evaluations format)
        name = evaluation.get('name') or evaluation.get('eval_name')
        if not name:
            logger.warning(f"Skipping evaluation without name: {evaluation}")
            continue
            
        # Make sure it has a result with either label, score, or explanation
        # Handle both annotations format (result field) and evaluations format (data field)
        result = evaluation.get('result') or evaluation.get('data')
        if not result or (result.get('label') is None and result.get('score') is None and not result.get('explanation')):
            logger.warning(f"Skipping evaluation without valid result: {evaluation}")
            continue
            
        # Normalize the evaluation format for consistent processing
        normalized_evaluation = {
            'span_id': span_id,
            'name': name,
            'result': result
        }
        
        valid_evaluations.append(normalized_evaluation)
        
    if len(valid_evaluations) < len(evaluations):
        logger.info(f"Filtered out {len(evaluations) - len(valid_evaluations)} invalid evaluations")
        
    return valid_evaluations

def convert_evaluations_to_dataframe(
    evaluations: List[Dict[str, Any]], 
    project_name: str
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
        span_id = evaluation['span_id']
        if span_id not in evaluations_by_span:
            evaluations_by_span[span_id] = []
        evaluations_by_span[span_id].append(evaluation)
    
    # Format rows according to Arize evaluations format
    formatted_rows = []
    for span_id, eval_list in evaluations_by_span.items():
        
        # Group evaluations by span_id - create one row per span with all evaluations
        row = {
            'context.span_id': span_id,
        }
        
        # Process each evaluation for this span
        for evaluation in eval_list:
            name = evaluation['name'].lower().replace(' ', '_').replace('-', '_')
            result = evaluation.get('result', {})
            
            # Add label if present
            if result and result.get('label') is not None:
                row[f'eval.{name}.label'] = result['label']
                
            # Add score if present    
            if result and result.get('score') is not None:
                row[f'eval.{name}.score'] = float(result['score'])
                
            # Add explanation if present
            if result and result.get('explanation'):
                row[f'eval.{name}.explanation'] = str(result['explanation'])
        
        # Only add row if it has some evaluation data
        has_evaluation_data = any(key.startswith('eval.') for key in row.keys())
        if has_evaluation_data:
            formatted_rows.append(row)
    
    # Create dataframe
    df = pd.DataFrame(formatted_rows)
    
    # Clean up any NaN values that could cause issues
    for col in df.columns:
        if col.endswith('.label'):
            df[col] = df[col].fillna('Unknown')
        elif col.endswith('.explanation'):
            df[col] = df[col].fillna('')
    
    # Log information
    if not df.empty:
        logger.info(f"Formatted {len(df)} evaluation rows from {len(evaluations)} evaluations")
        logger.info(f"Sample of converted evaluations dataframe:\n{df.head(1).to_string()}")
        logger.info(f"DataFrame columns: {df.columns.tolist()}")
    
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
        import arize
        logger.info(f"Arize version: {arize.__version__}")
    except ImportError as e:
        logger.error(f"Arize Python client import error: {e}")
        logger.error("Please install with 'pip install arize'")
        return False

    # Initialize Arize client
    logger.info(f"Initializing Arize client with Space ID: {space_id}")
    client_kwargs = {
        'space_id': space_id,
        'api_key': api_key,
    }
    if developer_key:
        client_kwargs['developer_key'] = developer_key
        
    arize_client = Client(**client_kwargs)

    # Check if project exists by trying to send a test evaluation
    try:
        # Create a minimal test evaluation with an invalid span ID
        test_df = pd.DataFrame({
            'context.span_id': ['test_invalid_span'],
            'eval.test.label': ['test'],
            'eval.test.score': [0.5],
        })
        
        # Send a single evaluation and catch the specific "span not found" error
        try:
            arize_client.log_evaluations_sync(
                dataframe=test_df,
                project_name=project_name,
            )
            logger.info(f"Test evaluation sent to project {project_name}")
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

def import_evaluations(
    api_key: str,
    space_id: str,
    export_dir: str,
    results_file: str,
    developer_key: str = None
) -> Dict[str, Any]:
    """
    Import Phoenix evaluations to Arize.
    
    Args:
        api_key: Arize API key
        space_id: Arize Space ID
        export_dir: Path to Phoenix export directory
        results_file: Path to store import results
        developer_key: Arize Developer Key (optional)
        
    Returns:
        Dictionary with import results
    """
    try:
        from arize.pandas.logger import Client
        import arize
        logger.info(f"Arize version: {arize.__version__}")
    except ImportError as e:
        logger.error(f"Arize Python client import error: {e}")
        logger.error("Please install with 'pip install arize'")
        return {}

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
    client_kwargs = {
        'space_id': space_id,
        'api_key': api_key,
    }
    if developer_key:
        client_kwargs['developer_key'] = developer_key
        
    arize_client = Client(**client_kwargs)
    
    # Load previous results if they exist
    previous_results = {}
    if os.path.exists(results_file):
        with open(results_file, 'r') as f:
            previous_results = json.load(f)
    
    # Get all projects
    logger.info(f"Loading projects from {export_dir}")
    projects = get_projects(export_dir)
    
    if not projects:
        logger.error("No projects found in the export directory")
        return {}
    
    logger.info(f"Found {len(projects)} projects")
    
    # Initialize results
    results = {
        'timestamp': datetime.now().isoformat(),
        'projects': {}
    }
    
    # Process each project
    for project_name in tqdm(projects, desc="Importing evaluations"):
        # Skip projects that have been successfully imported
        if project_name in previous_results.get('projects', {}) and previous_results['projects'][project_name].get('success'):
            logger.info(f"Skipping project {project_name} as it was already imported successfully")
            results['projects'][project_name] = previous_results['projects'][project_name]
            continue
            
        project_dir = Path(export_dir) / "projects" / project_name
        
        # Load evaluations
        evaluations = load_evaluations(project_dir)
        
        if not evaluations:
            logger.info(f"No evaluations found for project {project_name}")
            results['projects'][project_name] = {
                'success': True,
                'evaluations_count': 0,
                'message': "No evaluations found"
            }
            continue
        
        # Check if the project exists in Arize
        if not check_traces(api_key, space_id, project_name, developer_key):
            logger.warning(f"Project {project_name} doesn't exist in Arize yet. Make sure to import traces first.")
            results['projects'][project_name] = {
                'success': False,
                'evaluations_count': 0,
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
                
                logger.info(f"Found {len(trace_span_ids)} span IDs in traces file")
            except Exception as e:
                logger.warning(f"Could not read traces file: {e}")
        
        # Filter evaluations to only include those with span_ids that exist in traces
        filtered_evaluations = []
        for evaluation in evaluations:
            if evaluation['span_id'] in trace_span_ids:
                filtered_evaluations.append(evaluation)
        
        if trace_span_ids and not filtered_evaluations:
            logger.warning(f"None of the evaluations have matching span IDs in the traces file")
            # Try to use all evaluations anyway
            filtered_evaluations = evaluations
        elif trace_span_ids:
            logger.info(f"Filtered to {len(filtered_evaluations)} evaluations with matching span IDs")
        
        # Convert evaluations to Arize format
        df = convert_evaluations_to_dataframe(filtered_evaluations, project_name)
        
        if df.empty:
            logger.info(f"No valid evaluations to import for project {project_name}")
            results['projects'][project_name] = {
                'success': True,
                'evaluations_count': 0,
                'message': "No valid evaluations to import"
            }
            continue
        
        # Log evaluations to Arize
        try:
            logger.info(f"Importing {len(df)} evaluations for project {project_name}")
            # Print detailed dataframe info before sending
            logger.debug(f"DataFrame dtypes: {df.dtypes}")
            logger.debug(f"DataFrame shape: {df.shape}")
            
            # Check column requirements
            required_columns = ['context.span_id']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")
            
            # Make sure at least one evaluation column exists
            evaluation_columns = [col for col in df.columns if col.startswith('eval.')]
            if not evaluation_columns:
                raise ValueError("No evaluation columns found. Columns must use format: eval.<name>.<type>")
            
            # Log evaluations in batches to avoid timeouts
            batch_size = 10
            total_evaluations = len(df)
            success_count = 0
            
            for i in range(0, total_evaluations, batch_size):
                batch_df = df.iloc[i:i+batch_size].copy()
                try:
                    logger.info(f"Sending batch {i//batch_size + 1}/{(total_evaluations-1)//batch_size + 1} ({len(batch_df)} evaluations)")
                    response = arize_client.log_evaluations_sync(
                        dataframe=batch_df,
                        project_name=project_name,
                    )
                    logger.debug(f"Batch response: {response}")
                    success_count += len(batch_df)
                except Exception as batch_error:
                    logger.error(f"Error in batch {i//batch_size + 1}: {batch_error}")
            
            results['projects'][project_name] = {
                'success': success_count > 0,
                'evaluations_count': success_count,
                'message': f"Successfully imported {success_count}/{total_evaluations} evaluations",
                'span_ids': df['context.span_id'].tolist()
            }
            logger.info(f"Successfully imported {success_count}/{total_evaluations} evaluations for project {project_name}")
            
        except Exception as e:
            logger.error(f"Error importing evaluations for project {project_name}: {e}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            results['projects'][project_name] = {
                'success': False,
                'evaluations_count': 0,
                'message': f"Error: {str(e)}"
            }
    
    # Save results
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    total_success = sum(1 for p in results['projects'].values() if p.get('success'))
    total_evaluations = sum(p.get('evaluations_count', 0) for p in results['projects'].values())
    logger.info(f"Import completed: {total_success}/{len(results['projects'])} projects successful, {total_evaluations} evaluations imported")
    
    return results

def main() -> None:
    """Main entry point for the script."""
    args = parse_args()
    
    if not args.api_key:
        logger.error("No Arize API key provided. Set the ARIZE_API_KEY environment variable or use --api-key")
        return
    
    if not args.space_id:
        logger.error("No Arize Space ID provided. Set the ARIZE_SPACE_ID environment variable or use --space-id")
        return
    
    logger.info(f"Starting import from {args.export_dir} to Arize")
    import_evaluations(
        api_key=args.api_key,
        space_id=args.space_id,
        export_dir=args.export_dir,
        results_file=args.results_file,
        developer_key=args.developer_key
    )

if __name__ == "__main__":
    main() 