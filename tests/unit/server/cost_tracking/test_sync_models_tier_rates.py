"""Tests for tier-rate extraction in the LiteLLM sync script.

`.github/.scripts/sync_models.py` is a standalone script rather than a package
module, so it is loaded by path.
"""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).parents[4]
SYNC_SCRIPT = REPO_ROOT / ".github" / ".scripts" / "sync_models.py"


def _load_sync_models() -> ModuleType:
    spec = importlib.util.spec_from_file_location("sync_models", SYNC_SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["sync_models"] = module
    spec.loader.exec_module(module)
    return module


sync_models = _load_sync_models()
extract_threshold_customization = sync_models.extract_threshold_customization
PROMPT_TOKEN_COUNT_KEY = sync_models.PROMPT_TOKEN_COUNT_KEY


class TestExtractThresholdCustomization:
    def test_returns_none_when_no_tier_published(self) -> None:
        model_info = {"input_cost_per_token": 1.25e-6, "output_cost_per_token": 1e-5}
        assert extract_threshold_customization(model_info, "input_cost_per_token") is None

    @pytest.mark.parametrize(
        "field,tier_field,threshold",
        [
            ("input_cost_per_token", "input_cost_per_token_above_200k_tokens", 200_000),
            ("output_cost_per_token", "output_cost_per_token_above_272k_tokens", 272_000),
            ("input_cost_per_token", "input_cost_per_token_above_128k_tokens", 128_000),
            (
                "cache_read_input_token_cost",
                "cache_read_input_token_cost_above_200k_tokens",
                200_000,
            ),
            (
                "cache_creation_input_token_cost",
                "cache_creation_input_token_cost_above_200k_tokens",
                200_000,
            ),
        ],
    )
    def test_extracts_tier_for_each_priced_field(
        self, field: str, tier_field: str, threshold: int
    ) -> None:
        model_info = {field: 1.25e-6, tier_field: 2.5e-6}
        customization = extract_threshold_customization(model_info, field)
        assert customization == {
            "type": "threshold_based",
            "key": PROMPT_TOKEN_COUNT_KEY,
            "threshold": threshold,
            "new_rate": 2.5e-6,
        }

    def test_thresholds_key_off_prompt_length_not_the_priced_token(self) -> None:
        """Tier breakpoints are a function of prompt size even for output rates."""
        model_info = {
            "output_cost_per_token": 1e-5,
            "output_cost_per_token_above_200k_tokens": 1.5e-5,
        }
        customization = extract_threshold_customization(model_info, "output_cost_per_token")
        assert customization is not None
        assert customization["key"] == PROMPT_TOKEN_COUNT_KEY

    def test_does_not_leak_across_fields(self) -> None:
        """An input tier must not be picked up when extracting the output rate."""
        model_info = {
            "input_cost_per_token": 1.25e-6,
            "input_cost_per_token_above_200k_tokens": 2.5e-6,
            "output_cost_per_token": 1e-5,
        }
        assert extract_threshold_customization(model_info, "output_cost_per_token") is None

    def test_audio_field_is_not_matched_by_the_plain_input_field(self) -> None:
        model_info = {
            "input_cost_per_audio_token": 1e-6,
            "input_cost_per_audio_token_above_200k_tokens": 2e-6,
        }
        assert extract_threshold_customization(model_info, "input_cost_per_token") is None
        assert extract_threshold_customization(model_info, "input_cost_per_audio_token") == {
            "type": "threshold_based",
            "key": PROMPT_TOKEN_COUNT_KEY,
            "threshold": 200_000,
            "new_rate": 2e-6,
        }

    def test_lowest_threshold_wins_when_several_tiers_published(self) -> None:
        """The lowest breakpoint is where billing first diverges from the base rate."""
        model_info = {
            "input_cost_per_token": 1e-6,
            "input_cost_per_token_above_272k_tokens": 4e-6,
            "input_cost_per_token_above_128k_tokens": 2e-6,
        }
        customization = extract_threshold_customization(model_info, "input_cost_per_token")
        assert customization is not None
        assert customization["threshold"] == 128_000
        assert customization["new_rate"] == 2e-6

    @pytest.mark.parametrize("value", [0, 0.0, None, "", "not-a-number"])
    def test_unusable_tier_values_are_ignored(self, value: object) -> None:
        model_info = {
            "input_cost_per_token": 1.25e-6,
            "input_cost_per_token_above_200k_tokens": value,
        }
        assert extract_threshold_customization(model_info, "input_cost_per_token") is None


class TestManifestReflectsTierRates:
    """Guards the regenerated manifest against silently losing tier rates again."""

    def test_flagship_models_carry_tier_customizations(self) -> None:
        import json

        manifest_path = (
            REPO_ROOT / "src" / "phoenix" / "server" / "cost_tracking" / "model_cost_manifest.json"
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        customized = {
            model["name"]
            for model in manifest["models"]
            for price in model["token_prices"]
            if price.get("customization")
        }
        # Before this fix the manifest carried zero threshold_based customizations
        # across every model, so any regression here drops back to an empty set.
        assert customized, "manifest has no tier rates at all"
        assert "gemini-2.5-pro" in customized
        assert "claude-sonnet-4-5" in customized

    def test_customizations_are_well_formed(self) -> None:
        import json

        from phoenix.db.types.token_price_customization import TokenPriceCustomizationParser

        manifest_path = (
            REPO_ROOT / "src" / "phoenix" / "server" / "cost_tracking" / "model_cost_manifest.json"
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        seen = 0
        for model in manifest["models"]:
            for price in model["token_prices"]:
                if not (raw := price.get("customization")):
                    continue
                seen += 1
                parsed = TokenPriceCustomizationParser.parse(raw)
                assert parsed is not None
                assert parsed.type == "threshold_based"  # type: ignore[union-attr]
                assert parsed.threshold > 0  # type: ignore[union-attr]
                assert parsed.new_rate > 0  # type: ignore[union-attr]
        assert seen > 0
