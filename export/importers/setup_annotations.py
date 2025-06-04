#!/usr/bin/env python3
"""
Phoenix to Arize Annotation Configuration Helper

This script analyzes annotation data from a Phoenix export directory
and provides guidance on configuring the necessary annotation types
in the Arize UI before importing annotations.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from .utils import get_projects, parse_common_args, setup_logging

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

    try:
        with open(annotations_file, "r") as f:
            annotations = json.load(f)
            return annotations
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing annotations file {annotations_file}: {e}")
        return []
    except Exception as e:
        logger.error(f"Error loading annotations file {annotations_file}: {e}")
        return []


def analyze_annotations(
    annotations: List[Dict[str, Any]],
) -> Tuple[Set[str], Set[str], Set[str], Dict[str, Set[str]]]:
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
        name = annotation.get("name")
        if not name:
            continue

        annotation_names.add(name)
        result = annotation.get("result", {})

        # Check if it has a label
        if result and result.get("label") is not None:
            annotation_with_labels.add(name)
            if name not in label_values:
                label_values[name] = set()
            label_values[name].add(result["label"])
            # ignore the score if the label is present
            # the Arize Annnotations doesn't support both label and score
            continue

        # Check if it has a score (only if no label)
        if result and result.get("score") is not None:
            annotation_with_scores.add(name)

    return annotation_names, annotation_with_labels, annotation_with_scores, label_values


def main() -> None:
    """Main entry point for the script."""
    parser = parse_common_args("Setup annotations in Arize UI")
    args = parser.parse_args()

    # Set logging level
    setup_logging(args.verbose)

    export_dir = args.export_dir

    # Check if export directory exists
    if not Path(export_dir).exists():
        logger.error(f"Export directory does not exist: {export_dir}")
        print(f"\n⚠️ ERROR: Export directory does not exist: {export_dir}")
        print("Please run export_all_projects.py first to create the export directory.")
        return

    # Get all projects
    projects = get_projects(export_dir)

    if not projects:
        logger.error("No projects found in the export directory")
        print(f"\n⚠️ ERROR: No projects found in export directory: {export_dir}/projects")
        print(
            "Please run export_all_projects.py with the --projects and --annotations flags first."
        )
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
            project_analysis_results[project_name] = (set(), set(), set(), {})
            continue

        found_annotations = True

        # Analyze annotations for this project
        names, with_labels, with_scores, label_values = analyze_annotations(annotations)

        project_analysis_results[project_name] = (names, with_labels, with_scores, label_values)

    # Check if we found any annotations
    if not found_annotations:
        print("\n⚠️ ERROR: No annotations found in any projects.")
        print("Please make sure that:")
        print("1. You've exported annotations with export_all_projects.py --annotations")
        print("2. Your Phoenix server has annotations for at least one project.")
        return

    # Check if any project actually yielded valid annotation names for the guide
    any_valid_annotations_for_guide = any(
        data[0]
        for data in project_analysis_results.values()  # data[0] is 'names' set
    )
    if not any_valid_annotations_for_guide:
        print("\n⚠️ ERROR: No valid annotation types found to configure.")
        return

    # Print summary and configuration instructions
    print("\n=== Annotation Configuration Guide ===\n")
    print("Before importing annotations, you must configure each annotation type in the Arize UI.")
    print("Follow these general steps to add an annotation type in the Arize UI:")
    print("1. Navigate to a trace within the relevant project in the Arize platform")
    print("2. Click the 'Annotate' button to open the annotation panel")
    print("3. Click 'Add Annotation'")
    print(
        "4. Create an annotation configuration using the details provided "
        "below for each project and annotation name.\n"
    )

    for project_name, (
        names,
        with_labels,
        with_scores,
        label_values,
    ) in project_analysis_results.items():
        if not names:  # Skip projects if they had no valid annotations to configure
            continue

        print(f"--- Project: {project_name} ---")

        for name in sorted(names):
            print(f"  Annotation Name: {name}")

            if name in with_labels:
                print("    Type: Label")
                if name in label_values and label_values[name]:
                    print(f"    Values: {', '.join(sorted(label_values[name]))}")
            elif (
                name in with_scores
            ):  # This implies it wasn't a label, due to analyze_annotations logic
                print("    Type: Score")
            print()  # Blank line for readability
        print("-" * 30 + "\n")

    print("After configuring these annotations in the Arize UI, annotations can be imported")


if __name__ == "__main__":
    main()
