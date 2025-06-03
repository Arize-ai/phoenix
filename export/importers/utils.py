#!/usr/bin/env python3
"""
Utility functions for Phoenix to Arize import operations.

This module contains commonly used functions across all importer modules
to reduce code duplication and maintain consistency.
"""

import os
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone

from dotenv import load_dotenv

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
        logger.error(f"Error loading {file_path}: {e}")
        return None

def get_projects(export_dir: Union[str, Path]) -> List[str]:
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

def get_project_metadata(export_dir: Union[str, Path], project_name: str) -> Optional[Dict]:
    """
    Get metadata for a specific project.
    
    Args:
        export_dir: Path to the Phoenix export directory
        project_name: Name of the project
        
    Returns:
        Project metadata dictionary or None if not found
    """
    metadata_path = Path(export_dir) / "projects" / project_name / "project_metadata.json"
    if not metadata_path.exists():
        logger.warning(f"Project metadata file not found: {metadata_path}")
        return None
    
    return load_json_file(metadata_path)

def phoenix_timestamp_to_nanos_utc(timestamp_str: Optional[str]) -> Optional[int]:
    """
    Convert Phoenix timestamp string (e.g., "2025-05-13T05:12:32.418894000Z")
    to nanoseconds since Unix epoch, UTC.
    
    Args:
        timestamp_str: Phoenix timestamp string
        
    Returns:
        Nanoseconds since Unix epoch or None if conversion fails
    """
    if not timestamp_str:
        return None
    try:
        # Remove 'Z' and handle potential extra precision beyond microseconds
        if timestamp_str.endswith('Z'):
            ts_to_parse = timestamp_str[:-1]  # Remove Z
            # datetime.fromisoformat doesn't like more than 6 decimal places for seconds
            parts = ts_to_parse.split('.')
            if len(parts) == 2 and len(parts[1]) > 6:
                ts_to_parse = parts[0] + '.' + parts[1][:6]
            else:
                ts_to_parse = ts_to_parse
        else:
            ts_to_parse = timestamp_str

        dt_object_naive = datetime.fromisoformat(ts_to_parse)
        # Assume the naive datetime object is already UTC as per 'Z' suffix
        dt_object_utc = dt_object_naive.replace(tzinfo=timezone.utc)
        
        return int(dt_object_utc.timestamp() * 1_000_000_000)
    except ValueError as e:
        logger.warning(f"Error converting timestamp '{timestamp_str}': {e}")
        return None

def ensure_results_directory() -> Path:
    """
    Ensure the results directory exists and return its path.
    
    Returns:
        Path to the results directory
    """
    RESULTS_DIR.mkdir(exist_ok=True)
    return RESULTS_DIR

def generate_unique_id(length: int = 8) -> str:
    """
    Generate a random string for unique identifiers.
    
    Args:
        length: Length of the generated string
        
    Returns:
        Random string of specified length
    """
    import random
    import string
    letters = string.ascii_letters + string.digits
    return ''.join(random.choice(letters) for _ in range(length))

def setup_logging(verbose: bool = False) -> None:
    """
    Setup logging configuration.
    
    Args:
        verbose: Whether to enable verbose (DEBUG) logging
    """
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True  # Override existing configuration
    )

def validate_required_args(api_key: Optional[str], space_id: Optional[str]) -> bool:
    """
    Validate that required Arize API arguments are provided.
    
    Args:
        api_key: Arize API key
        space_id: Arize Space ID
        
    Returns:
        True if both arguments are provided, False otherwise
    """
    if not api_key:
        logger.error("No Arize API key provided. Set the ARIZE_API_KEY environment variable or use --api-key")
        return False
    
    if not space_id:
        logger.error("No Arize Space ID provided. Set the ARIZE_SPACE_ID environment variable or use --space-id")
        return False
    
    return True

def save_results_to_file(results: Any, file_path: Union[str, Path], description: str = "results") -> None:
    """
    Save results to a JSON file.
    
    Args:
        results: Results data to save
        file_path: Path to save the results file
        description: Description of the results for logging
    """
    try:
        with open(file_path, "w") as f:
            json.dump(results, f, indent=2)
        logger.info(f"{description.capitalize()} saved to {file_path}")
    except Exception as e:
        logger.error(f"Error saving {description} to {file_path}: {e}")

def parse_common_args(description: str) -> argparse.ArgumentParser:
    """
    Create an argument parser with common arguments for import scripts.
    
    Args:
        description: Description for the argument parser
        
    Returns:
        Configured ArgumentParser instance (not parsed yet)
    """
    parser = argparse.ArgumentParser(description=description)
    
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
        '--export-dir', 
        type=str, 
        default=os.getenv('PHOENIX_EXPORT_DIR', 'phoenix_export'),
        help='Phoenix export directory (default: from PHOENIX_EXPORT_DIR env var or "phoenix_export")'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    return parser

def check_export_directory(export_dir: Union[str, Path]) -> bool:
    """
    Check if the export directory exists and contains expected structure.
    
    Args:
        export_dir: Path to the Phoenix export directory
        
    Returns:
        True if directory exists and has basic structure, False otherwise
    """
    export_path = Path(export_dir)
    if not export_path.exists():
        logger.error(f"Export directory does not exist: {export_path}")
        return False
    
    # Check for basic structure
    projects_dir = export_path / "projects"
    if not projects_dir.exists():
        logger.warning(f"Projects directory not found in export: {projects_dir}")
    
    return True 