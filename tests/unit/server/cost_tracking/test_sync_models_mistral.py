"""
Regression tests for Mistral AI pricing sync in ``.github/.scripts/sync_models.py``.

Guards that first-party LiteLLM ``mistral/*`` IDs pass the provider-prefix filter, map to
the OpenInference provider ``mistralai``, and stay distinct from Together-hosted
``together_ai/mistralai/*`` entries. See Arize-ai/phoenix#16878.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

from phoenix.db import models
from phoenix.server.cost_tracking.cost_details_calculator import SpanCostDetailsCalculator


def _load_sync_models() -> ModuleType:
    script_path = Path(__file__).resolve().parents[4] / ".github" / ".scripts" / "sync_models.py"
    spec = importlib.util.spec_from_file_location("sync_models", script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Register before exec so dataclasses can resolve ``list[TokenPrice]`` annotations.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


sync_models = _load_sync_models()


class TestMistralProviderPrefix:
    def test_parse_provider_prefix_maps_to_openinference_mistralai(self) -> None:
        matched, provider, stripped = sync_models.parse_provider_prefix(
            "mistral/mistral-large-latest"
        )
        assert matched is True
        assert provider == "mistralai"
        assert stripped == "mistral-large-latest"

    def test_parse_provider_prefix_ignores_together_hosted_mistral(self) -> None:
        matched, provider, stripped = sync_models.parse_provider_prefix(
            "together_ai/mistralai/Mistral-7B-Instruct-v0.1"
        )
        assert matched is True
        assert provider == "together"
        assert stripped == "mistralai/Mistral-7B-Instruct-v0.1"

    def test_filter_models_includes_direct_mistral_prefix(self) -> None:
        filtered = sync_models.filter_models(
            [
                "mistral/mistral-large-latest",
                "mistral/codestral-latest",
                "openrouter/mistralai/mistral-large",
                "mistral.mistral-large-2402-v1:0",
            ]
        )
        assert filtered == [
            "mistral/mistral-large-latest",
            "mistral/codestral-latest",
        ]

    def test_filter_models_keeps_together_mistral_separate(self) -> None:
        filtered = sync_models.filter_models(
            [
                "mistral/mistral-small-latest",
                "together_ai/mistralai/Mistral-7B-Instruct-v0.1",
            ]
        )
        assert filtered == [
            "mistral/mistral-small-latest",
            "together_ai/mistralai/Mistral-7B-Instruct-v0.1",
        ]


class TestMistralExtractAndUpdate:
    def test_extract_litellm_entries_sets_provider_and_stripped_pattern(self) -> None:
        remote = {
            "mistral/mistral-large-latest": {
                "input_cost_per_token": 5e-7,
                "output_cost_per_token": 1.5e-6,
                "cache_read_input_token_cost": 5e-8,
                "litellm_provider": "mistral",
            },
            "together_ai/mistralai/Mistral-7B-Instruct-v0.1": {
                "input_cost_per_token": 2e-7,
                "output_cost_per_token": 2e-7,
                "litellm_provider": "together_ai",
            },
            "openrouter/mistralai/mistral-large": {
                "input_cost_per_token": 2e-6,
                "output_cost_per_token": 6e-6,
                "litellm_provider": "openrouter",
            },
        }
        entries = {entry.name: entry for entry in sync_models.extract_litellm_entries(remote)}

        assert "mistral/mistral-large-latest" in entries
        assert "together_ai/mistralai/Mistral-7B-Instruct-v0.1" in entries
        assert "openrouter/mistralai/mistral-large" not in entries

        mistral = entries["mistral/mistral-large-latest"]
        assert mistral.provider == "mistralai"
        assert mistral.name_pattern == "mistral-large-latest"
        rates = {
            (price.token_type, price.is_prompt): price.base_rate for price in mistral.token_prices
        }
        assert rates[("input", True)] == pytest.approx(5e-7)
        assert rates[("output", False)] == pytest.approx(1.5e-6)
        assert rates[("cache_read", True)] == pytest.approx(5e-8)

        together = entries["together_ai/mistralai/Mistral-7B-Instruct-v0.1"]
        assert together.provider == "together"
        assert together.name_pattern == "mistralai/Mistral-7B-Instruct-v0.1"

    def test_update_manifest_preserves_duplicate_names_across_providers(self) -> None:
        manifest = sync_models.ModelCostManifest(models=[])
        entries = sync_models.extract_litellm_entries(
            {
                "mistral/mistral-small-latest": {
                    "input_cost_per_token": 1.5e-7,
                    "output_cost_per_token": 6e-7,
                },
                "together_ai/mistralai/Mistral-Small-24B-Instruct-2501": {
                    "input_cost_per_token": 1e-7,
                    "output_cost_per_token": 3e-7,
                },
            }
        )
        updated = sync_models.update_manifest(manifest, entries)
        by_name = {model.name: model for model in updated.models}

        assert by_name["mistral/mistral-small-latest"].provider == "mistralai"
        assert (
            by_name["together_ai/mistralai/Mistral-Small-24B-Instruct-2501"].provider == "together"
        )
        assert by_name["mistral/mistral-small-latest"].name_pattern == "mistral-small-latest"
        assert (
            by_name["together_ai/mistralai/Mistral-Small-24B-Instruct-2501"].name_pattern
            == "mistralai/Mistral-Small-24B-Instruct-2501"
        )


class TestMistralCostCalculation:
    def test_input_and_output_token_costs(self) -> None:
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=5e-7),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=1.5e-6),
            ]
        )
        details = calculator.calculate_details(
            {"llm": {"token_count": {"prompt": 1000, "completion": 500}}}
        )
        prompt = {detail.token_type: detail for detail in details if detail.is_prompt}
        completion = {detail.token_type: detail for detail in details if not detail.is_prompt}
        assert prompt["input"].cost == pytest.approx(1000 * 5e-7)
        assert completion["output"].cost == pytest.approx(500 * 1.5e-6)

    def test_missing_completion_usage_bills_prompt_only(self) -> None:
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=5e-7),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=1.5e-6),
            ]
        )
        details = calculator.calculate_details({"llm": {"token_count": {"prompt": 1000}}})
        prompt = {detail.token_type: detail for detail in details if detail.is_prompt}
        completion = {detail.token_type: detail for detail in details if not detail.is_prompt}
        assert prompt["input"].cost == pytest.approx(1000 * 5e-7)
        assert "output" not in completion

    def test_missing_usage_metadata_yields_no_cost_details(self) -> None:
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=5e-7),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=1.5e-6),
            ]
        )
        assert calculator.calculate_details({}) == []
        assert calculator.calculate_details({"llm": {}}) == []
