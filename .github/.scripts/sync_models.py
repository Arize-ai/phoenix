import json
import re
from enum import Enum
from pathlib import Path
from typing import Annotated, Any
from urllib.request import urlopen

from pydantic import AfterValidator, BaseModel


class TokenPrice(BaseModel):
    base_rate: float
    is_prompt: bool
    token_type: str


def validate_regular_expression(value: str) -> str:
    try:
        re.compile(value)
        return value
    except re.error as error:
        raise ValueError(f"Invalid regular expression '{value}': {error}")


class ModelSource(Enum):
    """
    Describes the source from which token prices are synced, or MANUAL if the model token prices
    are manually maintained.
    """

    LITELLM = "litellm"
    MANUAL = "manual"


class ModelConfig(BaseModel):
    name: str
    name_pattern: Annotated[str, AfterValidator(validate_regular_expression)]
    source: ModelSource
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
        r"o1",
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


def update_manifest(
    manifest: ModelCostManifest,
    update_token_prices: dict[str, list[TokenPrice]],
) -> ModelCostManifest:
    # Remove LiteLLM models that are no longer in the remote data
    for index in reversed(range(len(manifest.models))):
        model = manifest.models[index]
        if model.source == ModelSource.LITELLM and model.name not in update_token_prices:
            removed_model = manifest.models.pop(index)
            print(f"Removed LiteLLM model no longer in remote data: {removed_model.name}")

    model_name_to_index: dict[str, int] = {}
    for index, model in enumerate(manifest.models):
        model_name_to_index[model.name] = index

    num_updated_models = 0
    for model_name, token_prices in update_token_prices.items():
        if model_name in model_name_to_index:
            index = model_name_to_index[model_name]
            manifest.models[index].token_prices = token_prices
            num_updated_models += 1
        else:
            escaped_model_name = re.escape(model_name).replace("\\-", "-")
            new_model = ModelConfig(
                name=model_name,
                name_pattern=escaped_model_name,  # seed an initial name pattern
                source=ModelSource.LITELLM,
                token_prices=token_prices,
            )
            manifest.models.append(new_model)

    manifest.models.sort(key=lambda model: model.name)
    print(f"Updated {num_updated_models} models from LiteLLM")
    return manifest


def main() -> int:
    local_file_path = (
        Path(__file__).parent / "../../src/phoenix/server/cost_tracking/model_cost_manifest.json"
    )
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

    try:
        litellm_models = fetch_data(url)
    except Exception as error:
        print(f"Error fetching model data from LiteLLM: {error}")
        return 1

    with open(local_file_path, "r") as file:
        data = json.load(file)
    manifest = ModelCostManifest.model_validate(data)

    transformed_data = transform_remote_data(litellm_models)
    print(f"Found {len(transformed_data)} models with pricing from LiteLLM")

    updated_manifest = update_manifest(manifest, transformed_data)

    if data != updated_manifest:
        with open(local_file_path, "w") as file:
            file.write(updated_manifest.model_dump_json(indent=2))
        print("Model data updated successfully")
    else:
        print("No changes detected")

    print(f"Total models in file: {len(updated_manifest.models)}")
    print(f"Models from this sync: {len(transformed_data)}")

    return 0


if __name__ == "__main__":
    exit(main())
