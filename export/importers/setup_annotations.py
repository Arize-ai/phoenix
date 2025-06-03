#!/usr/bin/env python3
"""
Phoenix to Arize Annotation Configuration Helper

This script analyzes annotation data from a Phoenix export directory
and provides guidance on configuring the necessary annotation types
in the Arize UI before importing annotations.
"""

import os
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Set, Any, Tuple

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

def parse_args() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        Parsed command line arguments
    """
    parser = argparse.ArgumentParser(description='Setup annotations in Arize UI')
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
    projects = [d.name for d in projects_dir.iterdir() if d.is_dir()]
    logger.info(f"Found {len(projects)} projects in {projects_dir}")
    return projects

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
    
    try:
        with open(annotations_file, 'r') as f:
            annotations = json.load(f)
            logger.info(f"Loaded {len(annotations)} annotations from {annotations_file}")
            return annotations
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing annotations file {annotations_file}: {e}")
        return []
    except Exception as e:
        logger.error(f"Error loading annotations file {annotations_file}: {e}")
        return []

def analyze_annotations(annotations: List[Dict[str, Any]]) -> Tuple[Set[str], Set[str], Set[str], Dict[str, Set[str]]]:
    """
    Analyze annotations to extract names, types, and values.
    
    Args:
        annotations: List of annotation dictionaries
        
    Returns:
        Tuple containing:
        - Set of annotation names
        - Set of annotation names with labels
        - Set of annotation names with scores
        - Dictionary mapping annotation names to their possible label values
    """
    annotation_names = set()
    annotation_with_labels = set()
    annotation_with_scores = set()
    label_values = {}
    
    for annotation in annotations:
        name = annotation.get('name')
        if not name:
            logger.warning(f"Skipping annotation without name: {annotation}")
            continue
            
        annotation_names.add(name)
        result = annotation.get('result', {})
        
        # Check if it has a label
        if result and result.get('label') is not None:
            annotation_with_labels.add(name)
            if name not in label_values:
                label_values[name] = set()
            label_values[name].add(result['label'])
            # If it has a label, we ignore the score as the Arize UI doesn't support both label and score
            continue 
            
        # Check if it has a score (only if no label)
        if result and result.get('score') is not None:
            annotation_with_scores.add(name)
    
    return annotation_names, annotation_with_labels, annotation_with_scores, label_values

def main() -> None:
    """Main entry point for the script."""
    args = parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")
    
    export_dir = args.export_dir
    logger.info(f"Analyzing annotations from {export_dir}")
    
    # Check if export directory exists
    if not os.path.exists(export_dir):
        logger.error(f"Export directory does not exist: {export_dir}")
        print(f"\n⚠️ ERROR: Export directory does not exist: {export_dir}")
        print(f"Please run export_all_projects.py first to create the export directory.")
        return
    
    # Get all projects
    projects = get_projects(export_dir)
    
    if not projects:
        logger.error("No projects found in the export directory")
        print(f"\n⚠️ ERROR: No projects found in export directory: {export_dir}/projects")
        print(f"Please run export_all_projects.py with the --projects and --annotations flags first.")
        return
    
    logger.info(f"Found {len(projects)} projects")
    
    # Process each project
    project_analysis_results = {}
    
    # Track if we found any annotations at all
    found_annotations = False
    
    for project_name in projects:
        project_dir = Path(export_dir) / "projects" / project_name
        
        # Load annotations
        annotations = load_annotations(project_dir)
        
        if not annotations:
            logger.info(f"No annotations file found or file is empty for project {project_name}")
            # We'll store an empty result so the project is acknowledged if needed,
            # but it won't print in the guide if there are no names.
            project_analysis_results[project_name] = (set(), set(), set(), {})
            continue
        
        found_annotations = True
            
        # Analyze annotations for this project
        names, with_labels, with_scores, label_values = analyze_annotations(annotations)
        
        # Filter out "note" annotations from being reported for manual setup
        reportable_names = {name for name in names if name.lower() != "note"}
        
        project_analysis_results[project_name] = (reportable_names, with_labels, with_scores, label_values)

        if reportable_names:
            logger.info(f"Project {project_name} has {len(annotations)} raw annotations, yielding {len(reportable_names)} unique annotation types to configure (excluding 'note'):")
            for name in sorted(reportable_names):
                log_message_detail = ""
                if name in with_labels:
                    log_message_detail += f"Type: Label, Values: {', '.join(sorted(label_values.get(name, [])))}"
                elif name in with_scores: # Only if not a label
                    log_message_detail += f"Type: Score"
                logger.info(f"  - {name}: {log_message_detail}")
        else:
            logger.info(f"Project {project_name} has {len(annotations)} raw annotations, but no valid annotation types (excluding 'note') were extracted for the guide.")

    # Check if we found any annotations
    if not found_annotations:
        logger.error("No annotations found in any projects (annotations.json files are missing or empty).")
        print("\n⚠️ ERROR: No annotations found in any projects.")
        print("Please make sure that:")
        print("1. You've exported annotations with export_all_projects.py --annotations")
        print("2. Your Phoenix server has annotations for at least one project and these are present in the export.")
        return
    
    # Check if any project actually yielded valid annotation names for the guide
    any_valid_annotations_for_guide = any(
        data[0] for data in project_analysis_results.values() # data[0] is 'names' set
    )
    if not any_valid_annotations_for_guide:
        logger.error("No valid annotation types found across all projects to generate a configuration guide.")
        print("\n⚠️ ERROR: No valid annotation types found to configure.")
        print("This might mean annotations exist but are missing required fields (name, and a result with label/score).")
        return
    
    # Print summary and configuration instructions
    print("\n=== Annotation Configuration Guide ===\n")
    print("Before importing annotations into Arize, you must configure each annotation type in the Arize UI for the respective projects.")
    print("Follow these general steps to add an annotation type in the Arize UI:")
    print("1. Navigate to a trace within the relevant project in the Arize platform")
    print("2. Click the 'Annotate' button to open the annotation panel")
    print("3. Click 'Add Annotation'")
    print("4. Create an annotation configuration using the details provided below for each project and annotation name.\n")

    for project_name, (names, with_labels, with_scores, label_values) in project_analysis_results.items():
        if not names: # Skip projects if they had no valid annotations to configure
            continue

        print(f"--- Project: {project_name} ---")
        
        for name in sorted(names):
            print(f"  Annotation Name: {name}")
            
            if name in with_labels:
                print(f"    Type: Label")
                if name in label_values and label_values[name]:
                    print(f"    Values: {', '.join(sorted(label_values[name]))}")
            elif name in with_scores: # This implies it wasn't a label, due to analyze_annotations logic
                print(f"    Type: Score")
            print() # Blank line for readability
        print("-" * 30 + "\n")

    print("After configuring these annotations in the Arize UI for the respective projects, you can run the import_annotations.py script.")

if __name__ == "__main__":
    main() 