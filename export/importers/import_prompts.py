#!/usr/bin/env python3
"""
Phoenix to Arize Prompt Importer

This script imports prompts from a Phoenix export directory into Arize's Prompt Hub.
It reads prompt data from the Phoenix export format, converts them to the format
expected by Arize's Prompt Hub, and imports them.
"""

import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Union

from dotenv import load_dotenv
from tqdm import tqdm
from arize.experimental.prompt_hub import ArizePromptClient, Prompt, LLMProvider

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

def get_prompts(export_dir: Union[str, Path]) -> List[Dict]:
    """
    Get all prompts from the Phoenix export directory.
    
    Args:
        export_dir: Path to the Phoenix export directory
        
    Returns:
        List of prompt dictionaries
    """
    prompts_path = Path(export_dir) / "prompts" / "prompts.json"
    if not prompts_path.exists():
        print(f"Prompts file not found: {prompts_path}")
        return []
    
    return load_json_file(prompts_path) or []

def convert_phoenix_prompt_to_arize(phoenix_prompt: Dict) -> Prompt:
    """
    Convert a Phoenix prompt to Arize format.
    
    Phoenix prompts have a different structure than Arize prompts.
    This function maps the Phoenix format to the Arize format.
    
    Args:
        phoenix_prompt: Phoenix prompt dictionary
        
    Returns:
        Arize Prompt object
    """
    # Extract basic information
    prompt_id = phoenix_prompt.get("id")
    name = phoenix_prompt.get("name", f"Phoenix Prompt {prompt_id}")
    content = phoenix_prompt.get("content", "")
    description = phoenix_prompt.get("description", "")
    
    # Extract metadata as tags
    metadata = phoenix_prompt.get("metadata", {})
    tags = [f"{k}:{v}" for k, v in metadata.items() if v is not None] if isinstance(metadata, dict) else []
    
    # Default to OpenAI provider if not specified
    model_name = metadata.get("model", "gpt-4") if isinstance(metadata, dict) else "gpt-4"
    
    # Create messages structure - convert the content to a user message
    messages = [
        {
            "role": "user",
            "content": content
        }
    ]
    
    # If there's a system message in metadata, add it
    if isinstance(metadata, dict) and "system_message" in metadata:
        system_message = {
            "role": "system",
            "content": metadata["system_message"]
        }
        messages.insert(0, system_message)
    
    # Create the Arize prompt
    arize_prompt = Prompt(
        name=name,
        messages=messages,
        provider=LLMProvider.OPENAI,  # Default to OpenAI, can be customized based on metadata
        model_name=model_name,
        description=description,
        tags=tags
    )
    
    return arize_prompt

def import_prompts(
    export_dir: Union[str, Path], 
    space_id: str, 
    arize_api_key: str, 
    limit: Optional[int] = None, 
    verbose: bool = False,
    results_file: Optional[str] = None
) -> List[Dict]:
    """
    Import prompts from Phoenix export to Arize.
    
    Args:
        export_dir: Path to the Phoenix export directory
        space_id: Arize Space ID to import into
        arize_api_key: Arize API key for authentication
        limit: Limit the number of prompts to import
        verbose: Enable verbose output
        results_file: Path to save import results (optional)
        
    Returns:
        List of imported prompt information
    """
    # Initialize Arize client
    try:
        client = ArizePromptClient(
            space_id=space_id,
            api_key=arize_api_key
        )
        if verbose:
            print(f"Successfully initialized Arize Prompt Hub client")
    except Exception as e:
        print(f"Error initializing Arize client: {e}")
        return []
    
    # Check if export directory exists
    export_path = Path(export_dir)
    if not export_path.exists():
        print(f"Export directory does not exist: {export_path}")
        return []
    
    # Check if prompts directory exists
    prompts_dir = export_path / "prompts"
    if not prompts_dir.exists():
        print(f"Prompts directory does not exist: {prompts_dir}")
        return []
    
    # List files in the prompts directory
    print("Files in the prompts directory:")
    for file_path in prompts_dir.iterdir():
        print(f"  - {file_path.name}")
    
    # Get all prompts
    phoenix_prompts = get_prompts(export_dir)
    if verbose:
        print(f"Raw prompts data: {json.dumps(phoenix_prompts, indent=2)}")
        
    if limit:
        phoenix_prompts = phoenix_prompts[:limit]
    
    print(f"Found {len(phoenix_prompts)} prompts to import")
    
    if len(phoenix_prompts) == 0:
        print(f"No prompts found in {export_path / 'prompts' / 'prompts.json'}")
        return []
    
    # Load previously imported prompts to avoid duplicates
    if results_file:
        results_path = Path(results_file)
    else:
        results_path = RESULTS_DIR / "prompt_import_results.json"
    
    previously_imported = {}
    if results_path.exists():
        try:
            with open(results_path, 'r') as f:
                imported_data = json.load(f)
                for item in imported_data:
                    # Track by both ID and name to prevent duplicates
                    phoenix_id = item.get('phoenix_id')
                    if phoenix_id:
                        previously_imported[phoenix_id] = item
                    
                    # Also track by original name if present
                    original_name = item.get('original_name')
                    if original_name:
                        previously_imported[original_name] = item
        except Exception as e:
            print(f"Warning: Could not load previous import results: {e}")
    
    # Try to get existing prompts from Arize
    try:
        # Wrap the client.pull_prompts() call in a try-except specifically for the toolChoice issue
        try:
            existing_arize_prompts = client.pull_prompts()
            existing_prompt_names = [p.name for p in existing_arize_prompts]
            print(f"Found {len(existing_prompt_names)} existing prompts in Arize")
        except Exception as pull_error:
            # Check if the error is the known toolChoice GraphQL issue
            if "toolChoice" in str(pull_error) and "must have a selection of subfields" in str(pull_error):
                print("Warning: Could not get existing prompts due to GraphQL schema issue with toolChoice.")
                print("Will proceed with import but may create duplicates if prompt names conflict.")
                existing_prompt_names = []
            else:
                # Re-raise if it's a different error
                raise
    except Exception as e:
        print(f"Warning: Could not get existing prompts from Arize: {e}")
        existing_prompt_names = []
    
    imported_prompts = []
    for phoenix_prompt in tqdm(phoenix_prompts, desc="Importing prompts"):
        prompt_id = phoenix_prompt.get("id")
        if not prompt_id:
            print("Prompt missing ID, skipping")
            continue
        
        prompt_name = phoenix_prompt.get("name", f"Phoenix Prompt {prompt_id}")
            
        # Skip if already imported by ID
        if prompt_id in previously_imported:
            print(f"Prompt {prompt_id} already imported as {previously_imported[prompt_id]['name']}, skipping")
            prompt_info = previously_imported[prompt_id].copy()
            imported_prompts.append(prompt_info)
            continue
        # Skip if already imported by name
        elif prompt_name in previously_imported:
            print(f"Prompt {prompt_name} already imported, skipping")
            prompt_info = previously_imported[prompt_name].copy()
            imported_prompts.append(prompt_info)
            continue
        
        # Extract timestamp from prompt created_at or updated_at fields
        timestamp = None
        if "created_at" in phoenix_prompt:
            try:
                # Parse the timestamp from created_at field
                dt = datetime.fromisoformat(phoenix_prompt["created_at"].replace("Z", "+00:00"))
                timestamp = int(dt.timestamp())
            except (ValueError, TypeError) as e:
                print(f"Warning: Could not parse created_at timestamp: {e}")
        
        # If no timestamp could be extracted, use current time as fallback
        if not timestamp:
            timestamp = int(time.time())
            print(f"Using current timestamp {timestamp} for prompt {prompt_name}")
        
        # Use the original prompt name without modifications, only add suffix if name conflicts
        unique_prompt_name = prompt_name
        
        # Check if unique_prompt_name exists in Arize
        if unique_prompt_name in existing_prompt_names:
            print(f"Prompt with name {unique_prompt_name} already exists in Arize")
            # First try with just timestamp
            timestamp_name = f"{prompt_name}_{timestamp}"
            if timestamp_name in existing_prompt_names:
                # Add random ID if timestamp name also exists
                unique_id = generate_unique_id()
                unique_prompt_name = f"{prompt_name}_{timestamp}_{unique_id}"
            else:
                unique_prompt_name = timestamp_name
            print(f"Using alternate name: {unique_prompt_name}")
        
        # Convert Phoenix prompt to Arize format
        arize_prompt = convert_phoenix_prompt_to_arize(phoenix_prompt)
        
        # Override the name with our unique name
        arize_prompt.name = unique_prompt_name
        
        # Create prompt in Arize
        print(f"Creating prompt {unique_prompt_name} in Arize space {space_id}...")
        
        prompt_info = {
            "phoenix_id": prompt_id,
            "name": unique_prompt_name,
            "original_name": prompt_name
        }
        # If we had to use a timestamp or unique_id, store that information
        if unique_prompt_name != prompt_name:
            prompt_info["timestamp"] = timestamp
            if "unique_id" in locals() and unique_id:
                prompt_info["unique_id"] = unique_id
        
        try:
            # Push the prompt to Arize
            client.push_prompt(arize_prompt)
            
            print(f"Successfully imported prompt {unique_prompt_name}")
            prompt_info["status"] = "imported"
            
        except Exception as e:
            error_message = str(e)
            print(f"Error importing prompt {unique_prompt_name}: {error_message}")
            
            # Check if the error is due to a duplicate prompt name
            if "already exists" in error_message:
                # Add this name to our known existing names to avoid future duplication attempts
                if unique_prompt_name not in existing_prompt_names:
                    existing_prompt_names.append(unique_prompt_name)
                prompt_info["status"] = "already_exists"
            else:
                prompt_info["status"] = "error"
                prompt_info["error"] = error_message
        
        # Add the prompt info to the list, regardless of success/failure
        imported_prompts.append(prompt_info)
    
    # Count successful and already existing imports
    success_count = sum(1 for p in imported_prompts if p.get("status") == "imported")
    existing_count = sum(1 for p in imported_prompts if p.get("status") == "already_exists")
    error_count = sum(1 for p in imported_prompts if p.get("status") == "error")
    
    print(f"Processed {len(imported_prompts)} prompts:")
    print(f"  - {success_count} newly imported to Arize")
    print(f"  - {existing_count} already existed in Arize (no import needed)")
    if error_count > 0:
        print(f"  - {error_count} failed to import due to errors")
    
    return imported_prompts

def main() -> None:
    """Main entry point to import prompts from Phoenix to Arize."""
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Import prompts from Phoenix to Arize')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    parser.add_argument('--export-dir', type=str, default=PHOENIX_EXPORT_DIR, 
                        help=f'Path to export directory (default: {PHOENIX_EXPORT_DIR})')
    args = parser.parse_args()
    
    # Check for required environment variables
    if not ARIZE_API_KEY:
        print("ARIZE_API_KEY environment variable is required")
        return
    
    if not ARIZE_SPACE_ID:
        print("ARIZE_SPACE_ID environment variable is required")
        return
    
    print(f"Using export directory: {args.export_dir}")
    print(f"Using Arize space ID: {ARIZE_SPACE_ID}")
    
    # Import prompts
    imported = import_prompts(
        export_dir=args.export_dir,
        space_id=ARIZE_SPACE_ID,
        arize_api_key=ARIZE_API_KEY,
        verbose=args.verbose
    )
    
    print(f"Import complete. Processed {len(imported)} prompts:")
    
    # All status handling is done in import_prompts function
    
    # Debug - Print all prompts and their status
    if args.verbose:
        print("\nDebug: Status of each prompt:")
        for i, p in enumerate(imported):
            print(f"  Prompt {i+1}: {p.get('name')} - Status: {p.get('status', 'None')}")
    
    # Count status types
    new_count = sum(1 for p in imported if p.get("status") == "imported")
    existing_count = sum(1 for p in imported if p.get("status") == "already_exists")
    error_count = sum(1 for p in imported if p.get("status") == "error")
    
    print(f"  - {new_count} newly imported to Arize")
    print(f"  - {existing_count} already existed in Arize (no import needed)")
    if error_count > 0:
        print(f"  - {error_count} failed to import due to errors")
    
    # Save import results
    # Use default results file path in main function
    results_path = RESULTS_DIR / "prompt_import_results.json"
    
    # Ensure parent directory exists
    results_path.parent.mkdir(exist_ok=True)
    
    with open(results_path, "w") as f:
        json.dump(imported, f, indent=2)
    print(f"Import results saved to {results_path}")

if __name__ == "__main__":
    main() 