import asyncio
import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, TypedDict

import aiohttp


class TokenPrice(TypedDict):
    token_type: str
    base_rate: float
    is_prompt: bool
    source: str


# Asynchronously fetch data from a given URL
async def fetch_data(url: str) -> Optional[list[dict[str, Any]]]:
    try:
        # Create an asynchronous session
        async with aiohttp.ClientSession() as session:
            # Send a GET request to the URL
            async with session.get(url) as resp:
                # Raise an error if the response status is not OK
                resp.raise_for_status()
                # Parse the response JSON
                resp_json = await resp.json()
                print("Fetched data from URL successfully.")
                # Return the 'data' field from the JSON response
                data = resp_json.get("data", resp_json)
                assert isinstance(data, list)
                return data
    except Exception as e:
        # Print an error message if fetching data fails
        print(f"Error fetching data from URL: {e}")
        return None


# Transform the remote data into a generic structure
def transform_remote_data(data: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Transform OpenRouter API data into a generic model format.

    Output format:
    {
        "model_id": {
            "provider": "provider_name",
            "max_tokens": int,
            "input_cost_per_token": float,
            "max_output_tokens": int (optional),
            "output_cost_per_token": float,
            "input_cost_per_image": float (optional),
            "supports_vision": bool (optional)
        }
    }
    """
    transformed = {}

    for row in data:
        # Create a unique model identifier
        model_id = row["id"]

        # Build the generic model object
        if "pricing" not in row:
            continue
        pricing = row["pricing"]
        model_info = []
        if prompt_pricing := float(pricing.get("prompt", 0)):
            model_info.append(
                TokenPrice(
                    token_type="input",
                    base_rate=prompt_pricing,
                    is_prompt=True,
                    source="openrouter",
                )
            )
        if completion_pricing := float(pricing.get("completion", 0)):
            model_info.append(
                TokenPrice(
                    token_type="output",
                    base_rate=completion_pricing,
                    is_prompt=False,
                    source="openrouter",
                )
            )
        # TODO: add image pricing once semantic conventions are finalized
        # if image_pricing := float(pricing.get("image", 0)):
        #     model_info.append(
        #         TokenPrice(
        #             token_type="image",
        #             base_rate=image_pricing,
        #             is_prompt=False,
        #         )
        #     )
        if cache_read_pricing := float(pricing.get("input_cache_read", 0)):
            model_info.append(
                TokenPrice(
                    token_type="cache_read",
                    base_rate=cache_read_pricing,
                    is_prompt=True,
                    source="openrouter",
                )
            )
        if cache_write_pricing := float(pricing.get("input_cache_write", 0)):
            model_info.append(
                TokenPrice(
                    token_type="cache_write",
                    base_rate=cache_write_pricing,
                    is_prompt=True,
                    source="openrouter",
                )
            )

        transformed[model_id] = model_info

    return transformed


# Merge remote data with existing local data
def merge_data(local_data: dict[str, Any], remote_data: dict[str, Any]) -> dict[str, Any]:
    """
    Merge remote data into local data, updating existing entries and adding new ones.
    """
    merged = deepcopy(local_data)
    models = merged.get("models", [])

    # Create a mapping of openrouter_id to indices for faster lookup
    openrouter_index_map = {}
    for idx, model in enumerate(models):
        if "openrouter_id" in model:
            openrouter_index_map[model["openrouter_id"]] = idx

    # Update existing models and track which ones were updated
    updated_models = set()
    for openrouter_id, token_prices in remote_data.items():
        if openrouter_id in openrouter_index_map:
            # Update existing model
            idx = openrouter_index_map[openrouter_id]
            models[idx]["token_prices"] = token_prices
            updated_models.add(openrouter_id)
        else:
            # Add new model if it doesn't exist
            new_model = {
                "name": openrouter_id,
                "name_pattern": f"(?i)^({openrouter_id})$",
                "token_prices": token_prices,
                "openrouter_id": openrouter_id,
            }
            models.append(new_model)
            updated_models.add(openrouter_id)

    merged["models"] = models
    print(f"Updated/added {len(updated_models)} models from OpenRouter")

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
    url = "https://openrouter.ai/api/v1/models"

    # Load existing local data
    data = load_local_data(local_file_path)

    # Fetch and transform remote data
    openrouter_models = asyncio.run(fetch_data(url))
    if not openrouter_models:
        print("Failed to fetch model data from API")
        return 1

    # Transform the fetched data into generic format
    transformed_data = transform_remote_data(openrouter_models)
    print(f"Found {len(transformed_data)} models with pricing from OpenRouter")

    # Merge with existing data
    merged_data = merge_data(data, transformed_data)

    # Write the updated data back to file if there are changes
    if has_diff(data, merged_data):
        write_to_file(local_file_path, merged_data)

    # Print summary
    print(f"Total models in file: {len(merged_data.get('models', []))}")
    print(f"Models from this sync: {len(transformed_data)}")

    return 0


# Entry point of the script
if __name__ == "__main__":
    exit(main())
