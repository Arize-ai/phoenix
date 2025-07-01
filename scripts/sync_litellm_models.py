import json
import re
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from pydantic import BaseModel


class TokenPrice(BaseModel):
    base_rate: float
    is_prompt: bool
    token_type: str


class ModelConfig(BaseModel):
    name: str
    name_pattern: str
    token_prices: list[TokenPrice]


class ModelCostManifest(BaseModel):
    models: list[ModelConfig]


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


def transform_remote_data(data: dict[str, Any]) -> dict[str, list[TokenPrice]]:
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

    transformed: dict[str, list[TokenPrice]] = {}

    for model_id in filtered_model_ids:
        model_info = data[model_id]

        token_prices: list[TokenPrice] = []

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


def merge_manifests(
    local_manifest: ModelCostManifest, remote_data: dict[str, list[TokenPrice]]
) -> ModelCostManifest:
    models: list[ModelConfig] = local_manifest.models

    model_index_map: dict[str, int] = {}
    for idx, model in enumerate(models):
        model_index_map[model.name] = idx

    updated_models = set()
    for model_id, token_prices in remote_data.items():
        if model_id in model_index_map:
            idx = model_index_map[model_id]
            models[idx].token_prices = token_prices
            updated_models.add(model_id)
        else:
            new_model = ModelConfig(
                name=model_id,
                name_pattern=f"^{model_id}$",  # seed an initial name pattern
                token_prices=token_prices,
            )
            models.append(new_model)

    models.sort(key=lambda model: model.name)
    local_manifest.models = models
    print(f"Updated {len(updated_models)} models from LiteLLM")
    return local_manifest


def main() -> int:
    local_file_path = (
        Path(__file__).parent / "../src/phoenix/server/cost_tracking/model_cost_manifest.json"
    )
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

    try:
        litellm_models = fetch_data(url)
    except Exception as error:
        print(f"Error fetching model data from LiteLLM: {error}")
        return 1

    with open(local_file_path, "r") as file:
        data = json.load(file)
    local_model_cost_manifest = ModelCostManifest.model_validate(data)

    transformed_data = transform_remote_data(litellm_models)
    print(f"Found {len(transformed_data)} models with pricing from LiteLLM")

    merged_model_cost_manifest = merge_manifests(local_model_cost_manifest, transformed_data)

    if data != merged_model_cost_manifest:
        with open(local_file_path, "w") as file:
            file.write(merged_model_cost_manifest.model_dump_json(indent=2))
        print("Model data updated successfully")
    else:
        print("No changes detected")

    print(f"Total models in file: {len(merged_model_cost_manifest.models)}")
    print(f"Models from this sync: {len(transformed_data)}")

    return 0


if __name__ == "__main__":
    exit(main())
