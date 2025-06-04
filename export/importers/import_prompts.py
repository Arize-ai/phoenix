#!/usr/bin/env python3
"""
Phoenix to Arize Prompt Importer

This script imports prompts from a Phoenix export directory into Arize's Prompt Hub.
It reads prompt data from the Phoenix export format, converts them to the format
expected by Arize's Prompt Hub, and imports them.
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Union

from arize.experimental.prompt_hub import ArizePromptClient, LLMProvider, Prompt
from tqdm import tqdm

from .utils import (
    RESULTS_DIR,
    generate_unique_id,
    load_json_file,
    parse_common_args,
    save_results_to_file,
    setup_logging,
)


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
    tags = (
        [f"{k}:{v}" for k, v in metadata.items() if v is not None]
        if isinstance(metadata, dict)
        else []
    )

    # Default to OpenAI provider if not specified
    model_name = metadata.get("model", "gpt-4") if isinstance(metadata, dict) else "gpt-4"

    # Create messages structure - convert the content to a user message
    messages = [{"role": "user", "content": content}]

    # If there's a system message in metadata, add it
    if isinstance(metadata, dict) and "system_message" in metadata:
        system_message = {"role": "system", "content": metadata["system_message"]}
        messages.insert(0, system_message)

    # Create the Arize prompt
    arize_prompt = Prompt(
        name=name,
        messages=messages,
        provider=LLMProvider.OPENAI,  # Default to OpenAI, can be customized based on metadata
        model_name=model_name,
        description=description,
        tags=tags,
    )

    return arize_prompt


def import_prompts(
    export_dir: Union[str, Path],
    space_id: str,
    arize_api_key: str,
    limit: Optional[int] = None,
    verbose: bool = False,
    results_file: Optional[str] = None,
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
    # Setup logging
    setup_logging(verbose)

    # Initialize Arize client
    try:
        client = ArizePromptClient(space_id=space_id, api_key=arize_api_key)
        if verbose:
            print("Successfully initialized Arize Prompt Hub client")
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
            with open(results_path, "r") as f:
                imported_data = json.load(f)
                for item in imported_data:
                    # Track by both ID and name to prevent duplicates
                    phoenix_id = item.get("phoenix_id")
                    if phoenix_id:
                        previously_imported[phoenix_id] = item

                    # Also track by original name if present
                    original_name = item.get("original_name")
                    if original_name:
                        previously_imported[original_name] = item
        except Exception as e:
            print(f"Warning: Could not load previous import results: {e}")

    # Try to get existing prompts from Arize
    try:
        try:
            existing_arize_prompts = client.pull_prompts()
            existing_prompt_names = [p.name for p in existing_arize_prompts]
        except Exception as pull_error:
            if "toolChoice" in str(pull_error) and "must have a selection of subfields" in str(
                pull_error
            ):
                existing_prompt_names = []
            else:
                raise
    except Exception as e:
        print(f"Warning: Could not get existing prompts from Arize: {e}")
        existing_prompt_names = []

    imported_prompts = []
    for phoenix_prompt in tqdm(phoenix_prompts, desc="Importing prompts"):
        prompt_id = phoenix_prompt.get("id")
        if not prompt_id:
            continue

        prompt_name = phoenix_prompt.get("name", f"Phoenix Prompt {prompt_id}")

        # Skip if already imported
        if prompt_id in previously_imported or prompt_name in previously_imported:
            prompt_info = previously_imported.get(prompt_id) or previously_imported.get(prompt_name)
            imported_prompts.append(prompt_info.copy())
            continue

        # Extract timestamp
        timestamp = None
        if "created_at" in phoenix_prompt:
            try:
                dt = datetime.fromisoformat(phoenix_prompt["created_at"].replace("Z", "+00:00"))
                timestamp = int(dt.timestamp())
            except (ValueError, TypeError):
                pass

        if not timestamp:
            timestamp = int(time.time())

        unique_prompt_name = prompt_name

        # Check if unique_prompt_name exists in Arize
        if unique_prompt_name in existing_prompt_names:
            timestamp_name = f"{prompt_name}_{timestamp}"
            if timestamp_name in existing_prompt_names:
                unique_id = generate_unique_id()
                unique_prompt_name = f"{prompt_name}_{timestamp}_{unique_id}"
            else:
                unique_prompt_name = timestamp_name

        # Convert Phoenix prompt to Arize format
        arize_prompt = convert_phoenix_prompt_to_arize(phoenix_prompt)

        # Override the name with our unique name
        arize_prompt.name = unique_prompt_name

        prompt_info = {
            "phoenix_id": prompt_id,
            "name": unique_prompt_name,
            "original_name": prompt_name,
        }
        if unique_prompt_name != prompt_name:
            prompt_info["timestamp"] = timestamp

        try:
            # Push the prompt to Arize
            client.push_prompt(arize_prompt)

            prompt_info["status"] = "imported"

        except Exception as e:
            error_message = str(e)
            print(f"Error importing prompt {unique_prompt_name}: {error_message}")

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

    print(
        f"Processed {len(imported_prompts)} prompts: {success_count} imported"
        f"{existing_count} existing, {error_count} errors"
    )

    return imported_prompts


def main() -> None:
    """Main entry point for the script."""
    parser = parse_common_args("Import Phoenix prompts to Arize")
    parser.add_argument("--limit", type=int, help="Limit the number of prompts to import")
    parser.add_argument(
        "--results-file",
        type=str,
        default=str(RESULTS_DIR / "prompt_import_results.json"),
        help="File to store import results (default: results/prompt_import_results.json)",
    )

    args = parser.parse_args()

    # Validate required arguments
    from .utils import validate_required_args

    if not validate_required_args(args.api_key, args.space_id):
        return

    # Setup logging
    setup_logging(args.verbose)

    # Import prompts
    result = import_prompts(
        export_dir=args.export_dir,
        space_id=args.space_id,
        arize_api_key=args.api_key,
        limit=args.limit,
        verbose=args.verbose,
        results_file=args.results_file,
    )

    if result:
        save_results_to_file(result, args.results_file, "Prompt import results")
        print(f"Successfully processed {len(result)} prompts")
    else:
        print("No prompts were imported")


if __name__ == "__main__":
    main()
