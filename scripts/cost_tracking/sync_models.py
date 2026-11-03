import argparse
import json
import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union
from urllib.request import urlopen

from pydantic import AfterValidator, BaseModel, Field
from typing_extensions import TypeGuard

from phoenix.db.models import GenerativeModelType
from phoenix.server.cost_tracking.manifest import (
    BUNDLED_MANIFEST_PATH,
    SUPPORTED_SCHEMA_VERSION,
    compute_models_sha256,
)

# The span attribute that LiteLLM's whole-prompt tiers (``..._above_NNNk_tokens``) are keyed on,
# by model type: decision spans report their input tokens under their own attribute.
PROMPT_TOKEN_ATTRIBUTES: dict[GenerativeModelType, str] = {
    "LLM": "llm.token_count.prompt",
    "DECISION": "decision.token_count.input",
}

# LiteLLM's ``mode`` values that aren't priced as LLMs. Every other mode (chat, responses,
# completion, realtime, image_generation, ...) is synced as an LLM, as before types existed.
MODEL_TYPES_BY_MODE: dict[str, GenerativeModelType] = {
    "decisions": "DECISION",
    # TypeSafe's Jev, which is called through the Decisions API.
    "evaluation": "DECISION",
    "embedding": "EMBEDDING",
}

# Suffix of the LiteLLM fields that price a chat model's calls to the Decisions API, such as
# gpt-6-luna's ``input_cost_per_token_decisions``. Such a model gets a second, DECISION entry.
DECISIONS_FIELD_SUFFIX = "_decisions"


class ThresholdBasedTokenPriceCustomization(BaseModel):
    type: Literal["threshold_based"] = "threshold_based"
    key: str
    threshold: float
    new_rate: float


class TokenPrice(BaseModel):
    base_rate: float
    is_prompt: bool
    token_type: str
    customization: Optional[ThresholdBasedTokenPriceCustomization] = None


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
    provider: str | None = None
    # Left out for LLMs, which is what every entry in ``models`` is.
    type: Optional[GenerativeModelType] = None
    token_prices: list[TokenPrice]

    @property
    def key(self) -> tuple[str, GenerativeModelType]:
        return self.name, self.type or "LLM"


class ModelCostManifest(BaseModel):
    schema_version: int = SUPPORTED_SCHEMA_VERSION
    generated_at: Optional[datetime] = None
    # Digest of the models as of generated_at; see compute_models_sha256().
    models_sha256: Optional[str] = None
    models: list[ModelConfig]
    # Models of every other type. They are kept out of ``models`` because servers released
    # before types existed read every entry there as an LLM (see manifest.py).
    non_llm_models: list[ModelConfig] = Field(default_factory=list)

    def section(self, model_type: GenerativeModelType) -> list[ModelConfig]:
        return self.models if model_type == "LLM" else self.non_llm_models


PROVIDER_PREFIXES: dict[str, str | None] = {
    "cerebras/": "cerebras",
    "groq/": "groq",
    "minimax/": "minimax",
    "mistral/": "mistralai",
    "moonshot/": None,
    "perplexity/": None,
    "together_ai/": "together",
    "zai/": "zai",
    "meta/": "meta",
    "typesafe/": "typesafe",
}


def parse_provider_prefix(model_id: str) -> tuple[bool, str | None, str]:
    """Return (matched, provider, stripped_name) or (False, None, model_id) if no prefix match."""
    for prefix, provider in PROVIDER_PREFIXES.items():
        if model_id.startswith(prefix):
            return True, provider, model_id[len(prefix) :]
    return False, None, model_id


@dataclass
class LiteLLMPricingEntry:
    name: str  # Full LiteLLM ID (e.g., "groq/llama-3.3-70b-versatile")
    provider: str | None  # Phoenix provider string (e.g., "groq") or None
    name_pattern: str  # Stripped name for regex (e.g., "llama-3.3-70b-versatile")
    token_prices: list[TokenPrice]
    type: GenerativeModelType = "LLM"


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
        # Models with known provider prefixes bypass include/exclude filtering
        matched, _, stripped_name = parse_provider_prefix(model_id)
        if matched:
            if not stripped_name or stripped_name.endswith("/"):
                continue
            # Perplexity: only include sonar models (skip proxied models like
            # perplexity/openai/... and deprecated models)
            if model_id.startswith("perplexity/") and not stripped_name.startswith("sonar"):
                continue
            # Together: skip embedding models
            if model_id.startswith("together_ai/") and "bge" in stripped_name.lower():
                continue
            filtered_models.append(model_id)
            continue

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


def _tier_customization(
    model_info: dict[str, Any],
    base_field: str,
    prompt_token_attribute: str = PROMPT_TOKEN_ATTRIBUTES["LLM"],
) -> Optional[ThresholdBasedTokenPriceCustomization]:
    """
    LiteLLM publishes whole-prompt tier rates as ``<base_field>_above_NNNk_tokens`` variants
    (e.g. ``input_cost_per_token_above_200k_tokens``). Emit the lowest configured tier as a
    ThresholdBasedTokenPriceCustomization keyed on the prompt token count, so that once the
    prompt strictly exceeds the threshold every token bills at the elevated rate. Only a
    single tier per model is emitted today; no publicly-priced model in the LiteLLM manifest
    configures more than one tier for the same base field.
    """
    tier_field = re.compile(rf"{re.escape(base_field)}_above_(?P<thousands>\d+)k_tokens")

    rates_by_threshold: dict[float, float] = {}
    for field, rate in model_info.items():
        match = tier_field.fullmatch(field)
        if match is None or not _is_non_negative_number(rate):
            continue
        threshold = float(match["thousands"]) * 1000
        rates_by_threshold[threshold] = float(rate)

    if not rates_by_threshold:
        return None
    lowest_threshold = min(rates_by_threshold)
    return ThresholdBasedTokenPriceCustomization(
        key=prompt_token_attribute,
        threshold=lowest_threshold,
        new_rate=rates_by_threshold[lowest_threshold],
    )


OUTPUT_RATE_FIELDS: tuple[str, ...] = (
    "output_cost_per_token",
    "output_cost_per_image_token",
)


def _output_rate_field(model_info: dict[str, Any]) -> Optional[str]:
    """
    Resolve which LiteLLM field prices Phoenix's ``output`` token type.

    Phoenix bills every completion token that has no more specific price at the ``output``
    rate, and the cost calculator requires that rate whenever any completion price is
    configured. LiteLLM publishes a text rate (``output_cost_per_token``) for chat models,
    but image generation models such as gpt-image-2 emit only image tokens and carry just
    ``output_cost_per_image_token``. Prefer the text rate when published and fall back to
    the image-token rate otherwise. The image-token rate is always emitted as an explicit
    ``image`` price as well, so instrumentation that reports image tokens separately bills
    them exactly regardless of which field backs ``output``.

    A positive rate is preferred so that a published 0 text rate never shadows a real
    image-token rate. A published 0 is used otherwise, so free models are priced at $0
    rather than dropped, unless the model publishes a positive non-token price: then the 0
    only means it isn't billed per token, not that it's free.
    """
    for field in OUTPUT_RATE_FIELDS:
        if _is_positive_number(model_info.get(field)):
            return field
    if _has_positive_non_token_price(model_info):
        return None
    for field in OUTPUT_RATE_FIELDS:
        if _is_non_negative_number(model_info.get(field)):
            return field
    return None


# LiteLLM fields that price a model by something other than tokens. A model that publishes a
# positive rate in any of these is billed that way, so a 0 per-token rate next to it doesn't
# mean the model is free (e.g. gemini-2.0-flash-exp-image-generation publishes 0 per token
# and 0.039 per image). Size- and resolution-specific variants such as
# ``output_cost_per_image_1K`` or ``output_cost_per_second_720p`` are only published alongside
# the base field, so the base field is enough.
NON_TOKEN_PRICE_FIELDS: tuple[str, ...] = (
    # per image
    "input_cost_per_image",
    "output_cost_per_image",
    # per pixel
    "input_cost_per_pixel",
    "output_cost_per_pixel",
    # per second of audio or video
    "cost_per_second",
    "input_cost_per_second",
    "output_cost_per_second",
    "input_cost_per_audio_per_second",
    "input_cost_per_video_per_second",
    "output_cost_per_video_per_second",
    # per character
    "input_cost_per_character",
    "output_cost_per_character",
    # per query (rerankers) or per request
    "input_cost_per_query",
    "input_cost_per_request",
)


def _has_positive_non_token_price(model_info: dict[str, Any]) -> bool:
    return any(_is_positive_number(model_info.get(field)) for field in NON_TOKEN_PRICE_FIELDS)


def _to_finite_float(value: Any) -> Optional[float]:
    """Returns the value as a finite float, or None for bools, non-numbers, NaN and infinity."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _is_positive_number(value: Any) -> TypeGuard[Union[float, int, str]]:
    return (number := _to_finite_float(value)) is not None and number > 0


def _is_non_negative_number(value: Any) -> TypeGuard[Union[float, int, str]]:
    return (number := _to_finite_float(value)) is not None and number >= 0


def next_generated_at(
    previous: ModelCostManifest,
    updated: ModelCostManifest,
    now: Optional[datetime] = None,
) -> datetime:
    """
    Keeps the previous ``generated_at`` unless the models changed, so that a sync with no price
    changes leaves the manifest untouched. Models edited by hand since ``generated_at`` was set
    count as changed: their digest no longer matches ``models_sha256``.
    """
    if (
        previous.generated_at is not None
        and previous.models_sha256 == compute_models_sha256(_dump_models(previous))
        and _dump_models(previous) == _dump_models(updated)
    ):
        return previous.generated_at
    candidate = (now or datetime.now(timezone.utc)).replace(microsecond=0)
    # Applied only when generated_at is strictly later than the previous stamp.
    if previous.generated_at is not None and candidate <= previous.generated_at:
        candidate = previous.generated_at + timedelta(seconds=1)
    return candidate


def move_to_their_lists(manifest: ModelCostManifest) -> None:
    """
    Moves entries edited by hand into the list for their type, and sorts both lists. Servers
    that predate types read every entry in ``models`` as an LLM, and newer ones skip an entry
    in the wrong list.
    """
    entries = [*manifest.models, *manifest.non_llm_models]
    for model in entries:
        if model.type == "LLM":
            model.type = None
    moved = [model.name for model in manifest.models if model.type is not None]
    moved += [model.name for model in manifest.non_llm_models if model.type is None]
    for name in moved:
        print(f"Moved model to the list for its type: {name}")
    manifest.models = [model for model in entries if model.type is None]
    manifest.non_llm_models = [model for model in entries if model.type is not None]
    for models in (manifest.models, manifest.non_llm_models):
        models.sort(key=lambda model: ("/" in model.name, model.name, model.type or ""))


def stamp(manifest: ModelCostManifest, previous: ModelCostManifest) -> None:
    """Sets the schema version, ``generated_at`` and ``models_sha256`` for the models."""
    move_to_their_lists(manifest)
    manifest.schema_version = SUPPORTED_SCHEMA_VERSION
    manifest.generated_at = next_generated_at(previous, manifest)
    manifest.models_sha256 = compute_models_sha256(_dump_models(manifest))


def _dump_models(manifest: ModelCostManifest) -> list[dict[str, Any]]:
    """The entries of every type: ``models`` followed by ``non_llm_models``."""
    dumped = manifest.model_dump(mode="json", exclude_none=True)
    models: list[dict[str, Any]] = [*dumped["models"], *dumped["non_llm_models"]]
    return models


def serialize_manifest(manifest: ModelCostManifest) -> str:
    return manifest.model_dump_json(indent=2, exclude_none=True)


def _has_pricing(model_info: dict[str, Any]) -> bool:
    """Both an input and an output rate are required for pricing."""
    return (
        _is_non_negative_number(model_info.get("input_cost_per_token"))
        and _output_rate_field(model_info) is not None
    )


def model_type_for_mode(mode: Any) -> GenerativeModelType:
    return MODEL_TYPES_BY_MODE.get(mode, "LLM") if isinstance(mode, str) else "LLM"


def _decisions_pricing(model_info: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    The prices of a chat model's calls to the Decisions API, under the plain field names
    (``input_cost_per_token_decisions`` becomes ``input_cost_per_token``), or None if it has
    none. Only the ``_decisions`` fields are used, so a rate LiteLLM doesn't publish for
    decisions isn't borrowed from chat.
    """
    pricing = {
        field.removesuffix(DECISIONS_FIELD_SUFFIX): value
        for field, value in model_info.items()
        if field.endswith(DECISIONS_FIELD_SUFFIX)
    }
    return pricing if _has_pricing(pricing) else None


def extract_litellm_entries(data: dict[str, Any]) -> list[LiteLLMPricingEntry]:
    models_with_pricing = [
        model_id for model_id, model_info in data.items() if _has_pricing(model_info)
    ]

    filtered_model_ids = filter_models(models_with_pricing)
    print(f"Total models with pricing: {len(models_with_pricing)}")
    print(f"Models after filtering: {len(filtered_model_ids)}")
    print("Filtered model IDs:")
    for model_id in filtered_model_ids:
        print(f"  - {model_id}")

    pricing_entries: list[LiteLLMPricingEntry] = []

    for model_id in filtered_model_ids:
        model_info = data[model_id]
        model_type = model_type_for_mode(model_info.get("mode"))
        if model_type == "EMBEDDING":
            # Embedding spans aren't priced yet (#17305).
            continue
        pricings: list[tuple[GenerativeModelType, dict[str, Any]]] = [(model_type, model_info)]
        if model_type == "LLM" and (decisions := _decisions_pricing(model_info)) is not None:
            pricings.append(("DECISION", decisions))
        _, provider, stripped_name = parse_provider_prefix(model_id)
        for priced_type, pricing in pricings:
            if token_prices := _token_prices(pricing, PROMPT_TOKEN_ATTRIBUTES[priced_type]):
                pricing_entries.append(
                    LiteLLMPricingEntry(
                        name=model_id,
                        provider=provider,
                        name_pattern=stripped_name,
                        token_prices=token_prices,
                        type=priced_type,
                    )
                )

    return pricing_entries


def _token_prices(model_info: dict[str, Any], prompt_token_attribute: str) -> list[TokenPrice]:
    token_prices: list[TokenPrice] = []

    if _is_non_negative_number(raw_input_cost := model_info.get("input_cost_per_token")):
        token_prices.append(
            TokenPrice(
                token_type="input",
                base_rate=float(raw_input_cost),
                is_prompt=True,
                customization=_tier_customization(
                    model_info, "input_cost_per_token", prompt_token_attribute
                ),
            )
        )

    if (output_field := _output_rate_field(model_info)) is not None:
        token_prices.append(
            TokenPrice(
                token_type="output",
                base_rate=float(model_info[output_field]),
                is_prompt=False,
                customization=_tier_customization(model_info, output_field, prompt_token_attribute),
            )
        )

    if _is_non_negative_number(
        raw_cache_read_cost := model_info.get("cache_read_input_token_cost")
    ):
        token_prices.append(
            TokenPrice(
                token_type="cache_read",
                base_rate=float(raw_cache_read_cost),
                is_prompt=True,
                customization=_tier_customization(
                    model_info, "cache_read_input_token_cost", prompt_token_attribute
                ),
            )
        )

    if _is_non_negative_number(
        raw_cache_creation_cost := model_info.get("cache_creation_input_token_cost")
    ):
        token_prices.append(
            TokenPrice(
                token_type="cache_write",
                base_rate=float(raw_cache_creation_cost),
                is_prompt=True,
                customization=_tier_customization(
                    model_info, "cache_creation_input_token_cost", prompt_token_attribute
                ),
            )
        )

    if _is_non_negative_number(
        raw_input_audio_cost := model_info.get("input_cost_per_audio_token")
    ):
        token_prices.append(
            TokenPrice(
                token_type="audio",
                base_rate=float(raw_input_audio_cost),
                is_prompt=True,
            )
        )

    if _is_non_negative_number(
        raw_output_audio_cost := model_info.get("output_cost_per_audio_token")
    ):
        token_prices.append(
            TokenPrice(
                token_type="audio",
                base_rate=float(raw_output_audio_cost),
                is_prompt=False,
            )
        )

    if _is_non_negative_number(
        raw_input_image_cost := model_info.get("input_cost_per_image_token")
    ):
        token_prices.append(
            TokenPrice(
                token_type="image",
                base_rate=float(raw_input_image_cost),
                is_prompt=True,
            )
        )

    if _is_non_negative_number(
        raw_output_image_cost := model_info.get("output_cost_per_image_token")
    ):
        token_prices.append(
            TokenPrice(
                token_type="image",
                base_rate=float(raw_output_image_cost),
                is_prompt=False,
            )
        )

    if _is_non_negative_number(
        raw_reasoning_cost := model_info.get("output_cost_per_reasoning_token")
    ):
        token_prices.append(
            TokenPrice(
                token_type="reasoning",
                base_rate=float(raw_reasoning_cost),
                is_prompt=False,
            )
        )

    return token_prices


def update_manifest(
    manifest: ModelCostManifest,
    litellm_entries: list[LiteLLMPricingEntry],
) -> ModelCostManifest:
    entries_by_key: dict[tuple[str, GenerativeModelType], LiteLLMPricingEntry] = {
        (entry.name, entry.type): entry for entry in litellm_entries
    }

    # Remove LiteLLM models that are no longer in the remote data
    for models in (manifest.models, manifest.non_llm_models):
        for index in reversed(range(len(models))):
            model = models[index]
            if model.source == ModelSource.LITELLM and model.key not in entries_by_key:
                removed_model = models.pop(index)
                print(
                    "Removed LiteLLM model no longer in remote data: "
                    f"{removed_model.name} ({model.key[1]})"
                )

    existing_models = {model.key: model for model in (*manifest.models, *manifest.non_llm_models)}

    num_updated = 0
    for entry in litellm_entries:
        if (existing_model := existing_models.get((entry.name, entry.type))) is not None:
            existing_model.token_prices = entry.token_prices
            existing_model.provider = entry.provider
            num_updated += 1
        else:
            escaped_name_pattern = re.escape(entry.name_pattern).replace("\\-", "-")
            new_model = ModelConfig(
                name=entry.name,
                name_pattern=escaped_name_pattern,
                source=ModelSource.LITELLM,
                provider=entry.provider,
                type=None if entry.type == "LLM" else entry.type,
                token_prices=entry.token_prices,
            )
            manifest.section(entry.type).append(new_model)

    move_to_their_lists(manifest)
    print(f"Updated {num_updated} models from LiteLLM")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync the model cost manifest with LiteLLM.")
    parser.add_argument(
        "--bump-generated-at",
        action="store_true",
        help=(
            "Don't fetch from LiteLLM; only update generated_at and models_sha256 if the models "
            "were edited by hand. Run this after editing the manifest's models."
        ),
    )
    args = parser.parse_args()

    with open(BUNDLED_MANIFEST_PATH, "r") as file:
        manifest_text = file.read()
    manifest = ModelCostManifest.model_validate_json(manifest_text)
    previous_manifest = manifest.model_copy(deep=True)

    if args.bump_generated_at:
        updated_manifest = manifest
        litellm_entries = None
    else:
        url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
        try:
            remote_data = fetch_data(url)
        except Exception as error:
            print(f"Error fetching model data from LiteLLM: {error}")
            return 1
        litellm_entries = extract_litellm_entries(remote_data)
        print(f"Found {len(litellm_entries)} models with pricing from LiteLLM")
        updated_manifest = update_manifest(manifest, litellm_entries)
    stamp(updated_manifest, previous_manifest)

    updated_text = serialize_manifest(updated_manifest)
    if updated_text != manifest_text:
        with open(BUNDLED_MANIFEST_PATH, "w") as file:
            file.write(updated_text)
        print("Model data updated successfully")
    else:
        print("No changes detected")

    print(
        f"Total models in file: {len(updated_manifest.models)} LLM, "
        f"{len(updated_manifest.non_llm_models)} other types"
    )
    if litellm_entries is not None:
        print(f"Models from this sync: {len(litellm_entries)}")

    return 0


if __name__ == "__main__":
    exit(main())
