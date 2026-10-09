"""
Regression tests for ``scripts/cost_tracking/sync_models.py``.

Guards that first-party LiteLLM ``mistral/*`` IDs pass the provider-prefix filter, map to
the OpenInference provider ``mistralai``, and stay distinct from Together-hosted
``together_ai/mistralai/*`` entries (see Arize-ai/phoenix#16878), and that the checked-in
manifest still parses under the schema the sync writes.

These run with ``make test-sync-models`` rather than in the Unit Tests job: the script is
repository tooling, not part of the ``arize-phoenix`` package.
"""

import json

import pytest
import sync_models


class TestCheckedInManifest:
    def test_manifest_validates_against_sync_schema(self) -> None:
        with sync_models.MANIFEST_PATH.open() as source:
            manifest = sync_models.ModelCostManifest.model_validate(json.load(source))
        assert manifest.models


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
