import asyncio
import json
import re
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, TypedDict

import aiohttp


class TokenPrice(TypedDict):
    token_type: str
    base_rate: float
    is_prompt: bool


def filter_models(model_ids: list[str]) -> list[str]:
    include_patterns = [
        r"gpt",
        r"claude",
        r"gemini",
        r"mistral",
        r"anthropic",
        r"openai",
    ]
    exclude_patterns = [
        r"/",
        r"ft",
        r"anthropic\.",
        r"mistral\.",
        r"claude-2.*",
        r"embedding",
        r"gemini-1.*",
    ]
    include_regexes = [re.compile(pattern, re.IGNORECASE) for pattern in include_patterns]
    exclude_regexes = [re.compile(pattern, re.IGNORECASE) for pattern in exclude_patterns]
    filtered_models = []
    for model_id in model_ids:
        if any(regex.search(model_id) for regex in exclude_regexes):
            continue

        if any(regex.search(model_id) for regex in include_regexes):
            filtered_models.append(model_id)

    return filtered_models


# Asynchronously fetch data from a given URL
async def fetch_data(url: str) -> Optional[dict[str, Any]]:
    try:
        # Create an asynchronous session
        async with aiohttp.ClientSession() as session:
            # Send a GET request to the URL
            async with session.get(url) as resp:
                # Raise an error if the response status is not OK
                resp.raise_for_status()
                # Parse the response JSON
                resp_text = await resp.text()
                resp_json = json.loads(resp_text)
                print("Fetched data from URL successfully.")
                assert isinstance(resp_json, dict)
                return resp_json
    except Exception as e:
        # Print an error message if fetching data fails
        print(f"Error fetching data from URL: {e}")
        return None


# Transform the remote data into a generic structure
def transform_remote_data(data: dict[str, Any]) -> dict[str, Any]:
    """
    Transform LiteLLM data into a generic model format.

    LiteLLM format:
    {
        "model_name": {
            "max_tokens": int,
            "max_input_tokens": int,
            "max_output_tokens": int,
            "input_cost_per_token": float,
            "output_cost_per_token": float,
            "litellm_provider": str,
            "mode": str,
            "supports_function_calling": bool,
            "supports_vision": bool
        }
    }
    """
    # First, collect all model IDs that have pricing information
    models_with_pricing = []
    for model_id, model_info in data.items():
        if "input_cost_per_token" in model_info or "output_cost_per_token" in model_info:
            models_with_pricing.append(model_id)

    # Filter the models
    filtered_model_ids = filter_models(models_with_pricing)
    print(f"Total models with pricing: {len(models_with_pricing)}")
    print(f"Models after filtering: {len(filtered_model_ids)}")
    print("Filtered model IDs:")
    for model_id in filtered_model_ids:
        print(f"  - {model_id}")

    transformed = {}

    for model_id in filtered_model_ids:
        model_info = data[model_id]

        # Build the token price list
        token_prices = []

        if input_cost := float(model_info.get("input_cost_per_token", 0)):
            token_prices.append(
                TokenPrice(
                    token_type="input",
                    base_rate=input_cost,
                    is_prompt=True,
                )
            )

        if output_cost := float(model_info.get("output_cost_per_token", 0)):
            token_prices.append(
                TokenPrice(
                    token_type="output",
                    base_rate=output_cost,
                    is_prompt=False,
                )
            )

        # Check for cache pricing if available
        if cache_read_cost := float(model_info.get("cache_read_input_token_cost", 0)):
            token_prices.append(
                TokenPrice(
                    token_type="cache_read",
                    base_rate=cache_read_cost,
                    is_prompt=True,
                )
            )

        if cache_creation_cost := float(model_info.get("cache_creation_input_token_cost", 0)):
            token_prices.append(
                TokenPrice(
                    token_type="cache_write",
                    base_rate=cache_creation_cost,
                    is_prompt=True,
                )
            )

        if token_prices:
            transformed[model_id] = token_prices

    return transformed


# Merge remote data with existing local data
def merge_data(local_data: dict[str, Any], remote_data: dict[str, Any]) -> dict[str, Any]:
    """
    Merge remote data into local data, updating existing entries and adding new ones.
    """
    merged = deepcopy(local_data)
    models = merged.get("models", [])

    # Create a mapping of model names to indices for faster lookup
    model_index_map = {}
    for idx, model in enumerate(models):
        model_index_map[model["name"]] = idx

    # Update existing models and track which ones were updated
    updated_models = set()
    for model_id, token_prices in remote_data.items():
        # Try to find a matching model by name
        if model_id in model_index_map:
            idx = model_index_map[model_id]
            # Only update if the model doesn't have an openrouter_id
            # (to avoid overwriting OpenRouter data)
            if "openrouter_id" not in models[idx]:
                models[idx]["token_prices"] = token_prices
                updated_models.add(model_id)
        else:
            # Add new model if it doesn't exist
            new_model = {
                "name": model_id,
                "name_pattern": f"(?i)^({model_id})$",
                "token_prices": token_prices,
            }
            models.append(new_model)
            updated_models.add(model_id)

    merged["models"] = models
    print(f"Updated/added {len(updated_models)} models from LiteLLM")

    return merged


# Write data to the json file
def write_to_file(file_path: Path, data: dict[str, Any]) -> None:
    try:
        # Add metadata
        data["last_updated"] = datetime.utcnow().isoformat() + "Z"

        # Open the file in write mode
        with open(file_path, "w") as file:
            # Dump the data as JSON into the file with nice formatting
            json.dump(data, file, indent=2, sort_keys=False)
        print(f"Successfully updated {file_path}")
    except Exception as e:
        # Print an error message if writing to file fails
        print(f"Error writing to file: {e}")
        raise


# Load local data from a specified file
def load_local_data(file_path: Path) -> dict[str, Any]:
    try:
        # Open the file in read mode
        with open(file_path, "r") as file:
            # Load and return the JSON data
            data = json.load(file)
            assert isinstance(data, dict)
            return data
    except FileNotFoundError:
        # Return empty dict if file doesn't exist yet
        print(f"File not found: {file_path} - will create new file")
        return {"models": []}
    except json.JSONDecodeError as e:
        # Print an error message if JSON decoding fails
        print(f"Error decoding JSON: {e}")
        return {"models": []}


def has_diff(local_data: dict[str, Any], merged_data: dict[str, Any]) -> bool:
    return local_data != merged_data


def main() -> int:
    # Configuration
    local_file_path = (
        Path(__file__).parent / "../src/phoenix/server/cost_tracking/model_cost_manifest.json"
    )
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

    # Load existing local data
    data = load_local_data(local_file_path)

    # Fetch and transform remote data
    litellm_models = asyncio.run(fetch_data(url))
    if not litellm_models:
        print("Failed to fetch model data from LiteLLM")
        return 1

    # Transform the fetched data into generic format
    transformed_data = transform_remote_data(litellm_models)
    print(f"Found {len(transformed_data)} models with pricing from LiteLLM")

    # Merge with existing data
    merged_data = merge_data(data, transformed_data)

    # Write the updated data back to file if there are changes
    if has_diff(data, merged_data):
        write_to_file(local_file_path, merged_data)
        print("Model data updated successfully")
    else:
        print("No changes detected")

    # Print summary
    print(f"Total models in file: {len(merged_data.get('models', []))}")
    print(f"Models from this sync: {len(transformed_data)}")

    return 0


# Entry point of the script
if __name__ == "__main__":
    exit(main())
