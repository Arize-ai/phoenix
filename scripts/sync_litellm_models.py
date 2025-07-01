import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any, TypedDict
from urllib.request import urlopen


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
        r"o3",
        r"o4",
    ]
    exclude_patterns = [
        r"/",
        r"ft",
        r"anthropic\.",
        r"mistral\.",
        r"claude-2.*",
        r"embedding",
        r"gemini-1.*",
        r"claude-instant.*",
        r"gemini-pro",
        r"gemini-pro-experimental",
        r"gemini-flash-experimental",
    ]
    include_regexes = [re.compile(pattern) for pattern in include_patterns]
    exclude_regexes = [re.compile(pattern) for pattern in exclude_patterns]
    filtered_models = []
    for model_id in model_ids:
        if any(regex.search(model_id) for regex in exclude_regexes):
            continue

        if any(regex.search(model_id) for regex in include_regexes):
            filtered_models.append(model_id)

    return filtered_models


def fetch_data(url: str) -> dict[str, Any]:
    try:
        with urlopen(url) as response:
            resp_text = response.read().decode("utf-8")
            resp_json = json.loads(resp_text)
            print("Fetched data from URL successfully.")
            assert isinstance(resp_json, dict)
            return resp_json
    except Exception as e:
        raise Exception(f"Error fetching data from URL: {e}")


def transform_remote_data(data: dict[str, Any]) -> dict[str, Any]:
    models_with_pricing = []
    for model_id, model_info in data.items():
        if (
            "input_cost_per_token" in model_info and "output_cost_per_token" in model_info
        ):  # both are required for pricing
            models_with_pricing.append(model_id)

    filtered_model_ids = filter_models(models_with_pricing)
    print(f"Total models with pricing: {len(models_with_pricing)}")
    print(f"Models after filtering: {len(filtered_model_ids)}")
    print("Filtered model IDs:")
    for model_id in filtered_model_ids:
        print(f"  - {model_id}")

    transformed = {}

    for model_id in filtered_model_ids:
        model_info = data[model_id]

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

        if input_audio_cost := float(model_info.get("input_cost_per_audio_token", 0)):
            token_prices.append(
                TokenPrice(
                    token_type="audio",
                    base_rate=input_audio_cost,
                    is_prompt=True,
                )
            )

        if output_audio_cost := float(model_info.get("output_cost_per_audio_token", 0)):
            token_prices.append(
                TokenPrice(
                    token_type="audio",
                    base_rate=output_audio_cost,
                    is_prompt=False,
                )
            )

        if token_prices:
            transformed[model_id] = token_prices

    return transformed


def merge_data(local_data: dict[str, Any], remote_data: dict[str, Any]) -> dict[str, Any]:
    """
    Merge remote data into local data, updating existing entries and adding new ones.
    """
    merged = deepcopy(local_data)
    models = merged.get("models", [])

    model_index_map = {}
    for idx, model in enumerate(models):
        model_index_map[model["name"]] = idx

    updated_models = set()
    for model_id, token_prices in remote_data.items():
        if model_id in model_index_map:
            idx = model_index_map[model_id]
            if "openrouter_id" not in models[idx]:
                models[idx]["token_prices"] = token_prices
                updated_models.add(model_id)
        else:
            new_model = {
                "name": model_id,
                "name_pattern": f"^{model_id}$",
                "token_prices": token_prices,
            }
            models.append(new_model)
            updated_models.add(model_id)

    models.sort(key=lambda model: model["name"])
    merged["models"] = models
    print(f"Updated/added {len(updated_models)} models from LiteLLM")
    return merged


def write_to_file(file_path: Path, data: dict[str, Any]) -> None:
    try:
        with open(file_path, "w") as file:
            json.dump(data, file, indent=2, sort_keys=False)
        print(f"Successfully updated {file_path}")
    except Exception as e:
        print(f"Error writing to file: {e}")
        raise


def load_local_data(file_path: Path) -> dict[str, Any]:
    try:
        with open(file_path, "r") as file:
            data = json.load(file)
            assert isinstance(data, dict)
            return data
    except FileNotFoundError:
        print(f"File not found: {file_path} - will create new file")
        return {"models": []}
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return {"models": []}


def has_diff(local_data: dict[str, Any], merged_data: dict[str, Any]) -> bool:
    return local_data != merged_data


def main() -> int:
    local_file_path = (
        Path(__file__).parent / "../src/phoenix/server/cost_tracking/model_cost_manifest.json"
    )
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

    data = load_local_data(local_file_path)

    try:
        litellm_models = fetch_data(url)
    except Exception as e:
        print(f"Error fetching model data from LiteLLM: {e}")
        return 1

    transformed_data = transform_remote_data(litellm_models)
    print(f"Found {len(transformed_data)} models with pricing from LiteLLM")

    merged_data = merge_data(data, transformed_data)

    if has_diff(data, merged_data):
        write_to_file(local_file_path, merged_data)
        print("Model data updated successfully")
    else:
        print("No changes detected")

    print(f"Total models in file: {len(merged_data.get('models', []))}")
    print(f"Models from this sync: {len(transformed_data)}")

    return 0


if __name__ == "__main__":
    exit(main())
