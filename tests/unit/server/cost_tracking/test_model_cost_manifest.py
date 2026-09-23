"""
Regression tests for src/phoenix/server/cost_tracking/model_cost_manifest.json.

Guards that LiteLLM whole-prompt tier rates (``*_above_NNNk_tokens``) survive the
sync from LiteLLM through ``.github/.scripts/sync_models.py`` and land in the
manifest as ``threshold_based`` customizations. See Arize-ai/phoenix#14314.

Also guards that the current flagship lineup stays priced and, just as importantly,
stays distinguishable: several model IDs are prefixes of newer ones (``claude-opus-5``
of ``claude-opus-5-5``), so a span must bill against its own entry rather than the
older, pricier one it happens to be a prefix of.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from phoenix.db import models
from phoenix.server.cost_tracking.cost_model_lookup import CostModelLookup

MANIFEST_PATH = (
    Path(__file__).resolve().parents[4]
    / "src"
    / "phoenix"
    / "server"
    / "cost_tracking"
    / "model_cost_manifest.json"
)


@pytest.fixture(scope="module")
def manifest() -> dict[str, Any]:
    with MANIFEST_PATH.open() as source:
        data: dict[str, Any] = json.load(source)
        return data


@pytest.fixture(scope="module")
def models_by_name(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {model["name"]: model for model in manifest["models"]}


@pytest.mark.parametrize(
    "model_name, token_type, threshold, base_rate, elevated_rate",
    [
        ("claude-sonnet-4-5", "input", 200_000, 3e-6, 6e-6),
        ("claude-sonnet-4-5", "output", 200_000, 1.5e-5, 2.25e-5),
        ("claude-sonnet-4-5", "cache_read", 200_000, 3e-7, 6e-7),
        ("claude-sonnet-4-5", "cache_write", 200_000, 3.75e-6, 7.5e-6),
        ("gemini-2.5-pro", "input", 200_000, 1.25e-6, 2.5e-6),
        ("gemini-2.5-pro", "output", 200_000, 1e-5, 1.5e-5),
        ("gpt-5.4", "input", 272_000, 2.5e-6, 5e-6),
        ("gpt-5.4", "output", 272_000, 1.5e-5, 2.25e-5),
        ("gpt-5.5", "input", 272_000, 5e-6, 1e-5),
        ("gpt-5.5", "output", 272_000, 3e-5, 4.5e-5),
        ("gpt-6-sol", "input", 272_000, 2e-6, 4e-6),
        ("gpt-6-sol", "output", 272_000, 1e-5, 1.5e-5),
        ("gpt-6-sol", "cache_read", 272_000, 2e-7, 4e-7),
        ("gpt-6-sol", "cache_write", 272_000, 2.5e-6, 5e-6),
        ("gpt-6-luna", "input", 272_000, 1e-7, 2e-7),
        ("gpt-6-luna", "output", 272_000, 5e-7, 7.5e-7),
        ("gpt-6-luna", "cache_read", 272_000, 1e-8, 2e-8),
        ("gpt-6-luna", "cache_write", 272_000, 1.25e-7, 2.5e-7),
        ("gpt-5.6-terra", "input", 272_000, 2e-6, 4e-6),
        ("gpt-5.6-terra", "output", 272_000, 1.2e-5, 1.8e-5),
        ("gpt-5.6-terra", "cache_read", 272_000, 2e-7, 4e-7),
        ("gpt-5.6-terra", "cache_write", 272_000, 2.5e-6, 5e-6),
        ("minimax/MiniMax-M3", "input", 512_000, 3e-7, 6e-7),
        ("minimax/MiniMax-M3", "output", 512_000, 1.2e-6, 2.4e-6),
        ("minimax/MiniMax-M3", "cache_read", 512_000, 6e-8, 1.2e-7),
    ],
)
def test_flagship_models_carry_threshold_based_tier_rates(
    models_by_name: dict[str, dict[str, Any]],
    model_name: str,
    token_type: str,
    threshold: float,
    base_rate: float,
    elevated_rate: float,
) -> None:
    assert model_name in models_by_name, f"missing model entry: {model_name}"
    prices = models_by_name[model_name]["token_prices"]

    matching = [price for price in prices if price["token_type"] == token_type]
    assert matching, f"{model_name} is missing a {token_type!r} token_price row"
    price = matching[0]

    assert price["base_rate"] == pytest.approx(base_rate, rel=1e-9)

    customization = price.get("customization")
    assert customization is not None, (
        f"{model_name}/{token_type} is missing a threshold_based customization; "
        "LiteLLM tier rates were dropped by the sync"
    )
    assert customization["type"] == "threshold_based"
    assert customization["key"] == "llm.token_count.prompt"
    assert customization["threshold"] == pytest.approx(threshold, rel=1e-9)
    assert customization["new_rate"] == pytest.approx(elevated_rate, rel=1e-9)


@pytest.mark.parametrize(
    "model_name, input_rate, output_rate, image_input_rate, image_output_rate",
    [
        # LiteLLM prices image generation output only as ``output_cost_per_image_token``;
        # the sync must fall back to that rate rather than dropping the model.
        ("gpt-image-2", 5e-6, 3e-5, 8e-6, 3e-5),
        ("gpt-image-1", 5e-6, 4e-5, 1e-5, 4e-5),
        ("gpt-image-1-mini", 2e-6, 8e-6, 2.5e-6, 8e-6),
        # Manually maintained until LiteLLM publishes them (released 2026-09-08).
        ("gpt-image-2.5-flare", 5e-6, 3e-5, 8e-6, 3e-5),
        ("gpt-image-2.5-sunburst", 5e-6, 3e-5, 8e-6, 3e-5),
    ],
)
def test_image_generation_models_carry_output_and_image_token_rates(
    models_by_name: dict[str, dict[str, Any]],
    model_name: str,
    input_rate: float,
    output_rate: float,
    image_input_rate: float,
    image_output_rate: float,
) -> None:
    assert model_name in models_by_name, f"missing model entry: {model_name}"
    prices = {
        (price["token_type"], price["is_prompt"]): price["base_rate"]
        for price in models_by_name[model_name]["token_prices"]
    }
    assert prices[("input", True)] == pytest.approx(input_rate, rel=1e-9)
    assert prices[("output", False)] == pytest.approx(output_rate, rel=1e-9)
    assert prices[("image", True)] == pytest.approx(image_input_rate, rel=1e-9)
    assert prices[("image", False)] == pytest.approx(image_output_rate, rel=1e-9)


@pytest.mark.parametrize(
    "model_name, input_rate, output_rate, cache_read_rate, cache_write_rate",
    [
        # LiteLLM prices Claude Opus 5.5 without long-context tiers, so its rows carry no
        # threshold_based customization: $4/$20 per MTok, with cache reads at 5% of input.
        ("claude-opus-5-5", 4e-6, 2e-5, 2e-7, 5e-6),
        ("claude-opus-5", 5e-6, 2.5e-5, 5e-7, 6.25e-6),
    ],
)
def test_flat_rate_models_carry_every_token_rate(
    models_by_name: dict[str, dict[str, Any]],
    model_name: str,
    input_rate: float,
    output_rate: float,
    cache_read_rate: float,
    cache_write_rate: float,
) -> None:
    assert model_name in models_by_name, f"missing model entry: {model_name}"
    prices = {price["token_type"]: price for price in models_by_name[model_name]["token_prices"]}
    for token_type, expected_rate in (
        ("input", input_rate),
        ("output", output_rate),
        ("cache_read", cache_read_rate),
        ("cache_write", cache_write_rate),
    ):
        assert token_type in prices, f"{model_name} is missing a {token_type!r} token_price row"
        assert prices[token_type]["base_rate"] == pytest.approx(expected_rate, rel=1e-9)
        assert prices[token_type].get("customization") is None, (
            f"{model_name}/{token_type} gained a tier customization; LiteLLM does not publish one"
        )


@pytest.fixture(scope="module")
def built_in_lookup(manifest: dict[str, Any]) -> CostModelLookup:
    """A lookup over every built-in model, mirroring how the facilitator seeds them."""
    now = datetime.now(timezone.utc)
    return CostModelLookup(
        models.GenerativeModel(
            id=index,
            name=model["name"],
            provider=model.get("provider") or "",
            start_time=None,
            name_pattern=re.compile(model["name_pattern"]),
            is_built_in=True,
            created_at=now,
            updated_at=now,
        )
        # Enumerate from 1 so that the built-in tie-breaker (-id) stays ordered by
        # manifest position, as it is for database-assigned ids.
        for index, model in enumerate(manifest["models"], start=1)
    )


@pytest.mark.parametrize(
    "span_model_name, expected_entry",
    [
        # A model ID that is a prefix of a newer one must not bill at the newer model's rates,
        # and vice versa: claude-opus-5's pattern also matches claude-opus-5-5.
        ("claude-opus-5-5", "claude-opus-5-5"),
        ("claude-opus-5", "claude-opus-5"),
        # Platform-specific IDs for the same model resolve to the same entry.
        ("anthropic.claude-opus-5-5", "claude-opus-5-5"),
        ("claude-opus-5-5@default", "claude-opus-5-5"),
        # The GPT-6 tiers released alongside the flagship, plus the GPT-5.6 Terra tier
        # that has no GPT-6 counterpart.
        ("gpt-6-astra", "gpt-6-astra"),
        ("gpt-6-sol", "gpt-6-sol"),
        ("gpt-6-luna", "gpt-6-luna"),
        ("us.openai.gpt-6-luna", "gpt-6-luna"),
        ("gpt-5.6-sol", "gpt-5.6-sol"),
        ("gpt-5.6-terra", "gpt-5.6-terra"),
        ("gpt-5.6-luna", "gpt-5.6-luna"),
    ],
)
def test_current_lineup_resolves_to_its_own_manifest_entry(
    built_in_lookup: CostModelLookup,
    span_model_name: str,
    expected_entry: str,
) -> None:
    model = built_in_lookup.find_model(
        start_time=datetime.now(timezone.utc),
        attributes={"llm": {"model_name": span_model_name}},
    )
    assert model is not None, f"no built-in model priced {span_model_name}"
    assert model.name == expected_entry
