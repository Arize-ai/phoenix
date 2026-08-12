"""
Regression tests for src/phoenix/server/cost_tracking/model_cost_manifest.json.

Guards that LiteLLM whole-prompt tier rates (``*_above_NNNk_tokens``) survive the
sync from LiteLLM through ``.github/.scripts/sync_models.py`` and land in the
manifest as ``threshold_based`` customizations. See Arize-ai/phoenix#14314.
"""

import json
from pathlib import Path
from typing import Any

import pytest

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
    "model_name, name_pattern, expected_prices",
    [
        (
            "minimax/MiniMax-M3",
            r"MiniMax-M3",
            {
                ("input", True): 6e-7,
                ("output", False): 2.4e-6,
                ("cache_read", True): 1.2e-7,
            },
        ),
        (
            "minimax/MiniMax-M2.7",
            r"MiniMax-M2\.7",
            {
                ("input", True): 3e-7,
                ("output", False): 1.2e-6,
                ("cache_read", True): 6e-8,
                ("cache_write", True): 3.75e-7,
            },
        ),
    ],
)
def test_minimax_models_have_current_token_prices(
    models_by_name: dict[str, dict[str, Any]],
    model_name: str,
    name_pattern: str,
    expected_prices: dict[tuple[str, bool], float],
) -> None:
    model = models_by_name[model_name]
    assert model["name_pattern"] == name_pattern
    assert model["source"] == "manual"
    assert model["provider"] == "minimax"

    actual_prices = {
        (price["token_type"], price["is_prompt"]): price["base_rate"]
        for price in model["token_prices"]
    }
    assert actual_prices.keys() == expected_prices.keys()
    for key, expected_rate in expected_prices.items():
        assert actual_prices[key] == pytest.approx(expected_rate, rel=1e-9)
