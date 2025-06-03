#!/usr/bin/env python3
"""
Phoenix to Arize Import Tool

This script provides a unified interface to import data from Phoenix export 
to Arize. It can import datasets, traces, annotations, evaluations, and prompts.

Usage:
  cd export
  python import_to_arize.py [--all] [--datasets] [--traces] [--annotations] [--evaluations] [--prompts]
"""

import logging
import os
import sys
import argparse
from pathlib import Path
import json

from utils import parse_import_args
from importers import (
    import_datasets,
    import_traces,
    import_annotations,
    import_evaluations,
    import_prompts,
    setup_annotations
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure results directory exists
RESULTS_DIR = Path("./results")
RESULTS_DIR.mkdir(exist_ok=True)

def import_datasets_wrapper(args: argparse.Namespace) -> bool:
    """
    Import datasets from Phoenix export to Arize.
    
    Args:
        args: Command line arguments
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info("Importing datasets...")
        results_path = RESULTS_DIR / "dataset_import_results.json"
        result = import_datasets.import_datasets(
            export_dir=args.export_dir,
            space_id=args.space_id,
            arize_api_key=args.api_key,
            verbose=args.verbose,
            results_file=str(results_path)
        )
        
        # Count results, considering both "imported" and "already_exists" as success
        if isinstance(result, list) and len(result) > 0:
            new_count = sum(1 for d in result if d.get('status') == 'imported')
            existing_count = sum(1 for d in result if d.get('status') == 'already_exists')
            
            logger.info(f"Dataset import complete: {new_count} newly imported, {existing_count} already existed in Arize (no import needed)")
            
            # Save results to file
            with open(results_path, "w") as f:
                json.dump(result, f, indent=2)
                logger.info(f"Dataset import results saved to {results_path}")
            
            # Return True if any datasets were processed successfully
            return (new_count + existing_count) > 0
        else:
            logger.error("No datasets were imported")
            return False
    except Exception as e:
        logger.error(f"Error importing datasets: {e}")
        return False

def import_traces_wrapper(args: argparse.Namespace) -> bool:
    """
    Import traces from Phoenix export to Arize.
    
    Args:
        args: Command line arguments
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info("Importing traces...")
        results_path = RESULTS_DIR / "trace_import_results.json"
        result = import_traces.import_traces(
            export_dir=args.export_dir,
            space_id=args.space_id,
            arize_api_key=args.api_key,
            verbose=args.verbose,
            results_file=str(results_path)
        )
        
        if result and isinstance(result, dict) and len(result) > 0:
            success_count = sum(1 for status in result.values() if status.get('status') == 'imported')
            logger.info(f"Successfully imported traces from {success_count} projects")
            
            # Save results to file
            with open(results_path, "w") as f:
                json.dump(result, f, indent=2)
                logger.info(f"Trace import results saved to {results_path}")
                
            return success_count > 0
        else:
            logger.error("No traces were imported")
            return False
    except Exception as e:
        logger.error(f"Error importing traces: {e}")
        return False

def import_annotations_wrapper(args: argparse.Namespace) -> bool:
    """
    Import annotations from Phoenix export to Arize.
    
    Args:
        args: Command line arguments
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info("Importing annotations...")
        results_path = RESULTS_DIR / "annotation_import_results.json"
        result = import_annotations.import_annotations(
            api_key=args.api_key,
            space_id=args.space_id,
            export_dir=args.export_dir,
            results_file=str(results_path)
        )
        
        if result and isinstance(result, dict) and 'projects' in result:
            total_success = sum(1 for p in result['projects'].values() if p.get('success'))
            total_annotations = sum(p.get('annotations_count', 0) for p in result['projects'].values())
            logger.info(f"Successfully imported {total_annotations} annotations from {total_success} projects")
            
            # Save results to file
            with open(results_path, "w") as f:
                json.dump(result, f, indent=2)
                logger.info(f"Annotation import results saved to {results_path}")
                
            return total_success > 0
        else:
            logger.error("No annotations were imported")
            return False
    except Exception as e:
        logger.error(f"Error importing annotations: {e}")
        return False

def import_evaluations_wrapper(args: argparse.Namespace) -> bool:
    """
    Import evaluations from Phoenix export to Arize.
    
    Args:
        args: Command line arguments
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info("Importing evaluations...")
        results_path = RESULTS_DIR / "evaluation_import_results.json"
        result = import_evaluations.import_evaluations(
            api_key=args.api_key,
            space_id=args.space_id,
            export_dir=args.export_dir,
            results_file=str(results_path),
            developer_key=getattr(args, 'developer_key', None)
        )
        
        if result and isinstance(result, dict) and 'projects' in result:
            total_success = sum(1 for p in result['projects'].values() if p.get('success'))
            total_evaluations = sum(p.get('evaluations_count', 0) for p in result['projects'].values())
            logger.info(f"Successfully imported {total_evaluations} evaluations from {total_success} projects")
            
            # Save results to file
            with open(results_path, "w") as f:
                json.dump(result, f, indent=2)
                logger.info(f"Evaluation import results saved to {results_path}")
                
            return total_success > 0
        else:
            logger.error("No evaluations were imported")
            return False
    except Exception as e:
        logger.error(f"Error importing evaluations: {e}")
        return False

def import_prompts_wrapper(args: argparse.Namespace) -> bool:
    """
    Import prompts from Phoenix export to Arize.
    
    Args:
        args: Command line arguments
        
    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info("Importing prompts...")
        results_path = RESULTS_DIR / "prompt_import_results.json"
        result = import_prompts.import_prompts(
            export_dir=args.export_dir,
            space_id=args.space_id,
            arize_api_key=args.api_key,
            verbose=args.verbose,
            results_file=str(results_path)
        )
        
        # Count results, considering both "imported" and "already_exists" as success
        if isinstance(result, list) and len(result) > 0:
            new_count = sum(1 for p in result if p.get('status') == 'imported')
            existing_count = sum(1 for p in result if p.get('status') == 'already_exists')
            
            logger.info(f"Prompt import complete: {new_count} newly imported, {existing_count} already existed in Arize (no import needed)")
            
            # Save results to file
            with open(results_path, "w") as f:
                json.dump(result, f, indent=2)
                logger.info(f"Prompt import results saved to {results_path}")
                
            # Return True if any prompts were processed successfully
            return (new_count + existing_count) > 0
        else:
            logger.error("No prompts were imported")
            return False
    except Exception as e:
        logger.error(f"Error importing prompts: {e}")
        return False

def setup_annotations_wrapper(args: argparse.Namespace) -> bool:
    """
    Run the annotation setup guide.
    
    Args:
        args: Command line arguments
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Build command line args
        cmd_args = ['setup_annotations.py', '--export-dir', args.export_dir]
        
        # Add verbose flag if provided
        if args.verbose:
            cmd_args.append('--verbose')
            
        # Store original argv
        original_argv = sys.argv
        try:
            # Set sys.argv to include our arguments
            sys.argv = cmd_args
            # Run the main function
            setup_annotations.main()
            return True
        finally:
            # Restore original argv to prevent side effects
            sys.argv = original_argv
            
    except Exception as e:
        logger.error(f"Error setting up annotations: {e}")
        return False

def main() -> None:
    """Main entry point for the script."""
    args = parse_import_args()
    
    # Check for required arguments
    if not args.api_key:
        logger.error("No Arize API key provided. Set the ARIZE_API_KEY environment variable or use --api-key")
        return
    
    if not args.space_id:
        logger.error("No Arize Space ID provided. Set the ARIZE_SPACE_ID environment variable or use --space-id")
        return
    
    # Check if any import type is selected
    if not (args.all or args.datasets or args.traces or args.annotations or args.evaluations or args.prompts or args.setup_annotations):
        logger.error("No import type selected. Use --help to see available options.")
        return
    
    # Keep track of successful imports
    successful_imports = []
    failed_imports = []
    
    # Import datasets (step 1)
    if args.all or args.datasets:
        logger.info("Step 1/7: Importing datasets...")
        if import_datasets_wrapper(args):
            successful_imports.append("datasets")
        else:
            failed_imports.append("datasets")
    
    # Import prompts (step 2)
    if args.all or args.prompts:
        logger.info("Step 2/7: Importing prompts...")
        if import_prompts_wrapper(args):
            successful_imports.append("prompts")
        else:
            failed_imports.append("prompts")
    
    # Import traces (step 3)
    if args.all or args.traces:
        logger.info("Step 3/7: Importing traces...")
        if import_traces_wrapper(args):
            successful_imports.append("traces")
        else:
            failed_imports.append("traces")
    
    # Import evaluations (step 4)
    if args.all or args.evaluations:
        logger.info("Step 4/7: Importing evaluations...")
        if import_evaluations_wrapper(args):
            successful_imports.append("evaluations")
        else:
            failed_imports.append("evaluations")
    
    # Handle annotations (steps 5-7)
    if args.all or args.annotations:
        # Step 5: Run setup annotations guide
        logger.info("Step 5/7: Setting up and importing annotations...")
        # Always run setup_annotations when annotations is requested
        logger.info("Running annotation setup guide...")
        setup_success = setup_annotations_wrapper(args)
        if setup_success:
            logger.info("✓ Annotation setup guide completed successfully.")
        else:
            logger.error("✗ Annotation setup guide failed.")
            failed_imports.append("annotation setup")
                
        # Step 6: Wait for user confirmation
        print("\n=======================================================")
        print("IMPORTANT: Please configure all annotations in Arize UI:")
        print("1. Navigate to a trace in your project in Arize")
        print("2. Click 'Annotate' button")
        print("3. Add all annotation types listed in the setup guide")
        print("=======================================================")
        
        confirmation = input("\nHave you added all annotation configurations in Arize UI? (yes/no): ").lower()
        
        # Step 7: Import annotations if confirmed
        if confirmation in ["yes", "y"]:
            logger.info("Step 7/7: Importing annotations...")
            if import_annotations_wrapper(args):
                successful_imports.append("annotations")
            else:
                failed_imports.append("annotations")
        else:
            logger.warning("Annotation import skipped. Please configure annotations in Arize UI first.")
            logger.warning("You can run the import again with --annotations when ready.")
    elif args.setup_annotations:
        # Handle case where only --setup-annotations is provided
        logger.info("Running annotation setup guide...")
        if setup_annotations_wrapper(args):
            successful_imports.append("annotation setup")
        else:
            failed_imports.append("annotation setup")
    
    # Print summary
    print("\n=== Import Summary ===")
    if successful_imports:
        logger.info(f"Successfully imported: {', '.join(successful_imports)}")
    
    if failed_imports:
        logger.error(f"Failed to import: {', '.join(failed_imports)}")
    
    if failed_imports:
        sys.exit(1)

if __name__ == "__main__":
    main() 